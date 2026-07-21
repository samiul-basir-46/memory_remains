import { escapeHtml, qs } from '../utils/ui.js';
import { getFirebaseServices } from '../services/firebase-service.js';

const API_BASE = "https://bkash-sms-gateway.onrender.com";

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(dateStr);
  }
}

export async function renderTrackOrderPage() {
  const container = qs('#track-order-app');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const initialOrderId = urlParams.get('order_id') || '';

  container.innerHTML = `
    <div class="max-w-2xl mx-auto py-10 px-4">
      <div class="text-center mb-8">
        <h1 class="font-heading text-3xl md:text-4xl text-[#2A2A2A] font-bold mb-2">Track Your Order</h1>
        <p class="text-text-soft text-sm">Track your order live using your Phone Number or Order ID</p>
      </div>

      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl mb-8">
        <form id="track-order-form" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-[#2A2A2A] mb-1.5">Phone Number (Required if no Order ID)</label>
            <input type="tel" id="track-phone" placeholder="e.g. 01712345678" class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
          </div>

          <div class="relative flex py-1 items-center">
            <div class="flex-grow border-t border-gray-200"></div>
            <span class="flex-shrink mx-4 text-xs font-bold text-gray-400">OR</span>
            <div class="flex-grow border-t border-gray-200"></div>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#2A2A2A] mb-1.5">Order ID (Optional)</label>
            <input type="text" id="track-order-id" value="${escapeHtml(initialOrderId)}" placeholder="e.g. ORD-84188" class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary uppercase">
          </div>

          <p id="track-error" class="text-xs text-rose-600 mt-1 hidden font-semibold">Please enter your Phone Number or Order ID to search.</p>

          <button type="submit" id="track-submit-btn" class="w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center">Track Order</button>
        </form>
      </div>

      <div id="track-result-container"></div>
    </div>
  `;

  if (initialOrderId) {
    doTrackOrder('', initialOrderId);
  }

  qs('#track-order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = qs('#track-order-id').value.trim();
    const phone = qs('#track-phone').value.trim();

    if (!orderId && !phone) {
      const errEl = qs('#track-error');
      if (errEl) errEl.classList.remove('hidden');
      return;
    }

    qs('#track-error')?.classList.add('hidden');
    doTrackOrder(phone, orderId);
  });
}

async function doTrackOrder(phone, orderId) {
  const submitBtn = qs('#track-submit-btn');
  const resultBox = qs('#track-result-container');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Searching...';
  }

  let ordersList = [];

  try {
    const res = await fetch(`${API_BASE}/track-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId || null,
        customer_phone: phone || null
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'found' && Array.isArray(data.orders)) {
        ordersList = data.orders;
      }
    }
  } catch (err) {
    console.warn('API track-order error, falling back to Firestore:', err);
  }

  // FIRESTORE FALLBACK IF API RETURNED EMPTY OR ERRORED
  if (ordersList.length === 0) {
    try {
      const { db } = getFirebaseServices();
      if (db) {
        const seenMap = new Map();

        // Search by Order ID if given
        if (orderId) {
          const docP = await db.collection('purchases').doc(orderId).get();
          if (docP.exists) {
            seenMap.set(docP.id, { order_id: docP.id, ...docP.data() });
          } else {
            const docO = await db.collection('orders').doc(orderId).get();
            if (docO.exists) {
              seenMap.set(docO.id, { order_id: docO.id, ...docO.data() });
            }
          }
        }

        // Search by Phone if given
        if (phone) {
          const qP = await db.collection('purchases').where('customer_phone', '==', phone).get();
          qP.forEach(doc => {
            if (!seenMap.has(doc.id)) {
              seenMap.set(doc.id, { order_id: doc.id, ...doc.data() });
            }
          });

          const qO = await db.collection('orders').where('customer_phone', '==', phone).get();
          qO.forEach(doc => {
            if (!seenMap.has(doc.id)) {
              seenMap.set(doc.id, { order_id: doc.id, ...doc.data() });
            }
          });
        }

        ordersList = Array.from(seenMap.values());
      }
    } catch (fsErr) {
      console.error('Firestore tracking search error:', fsErr);
    }
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Track Order';
  }

  renderTrackingResult(ordersList);
}

function renderTrackingResult(orders) {
  const resultBox = qs('#track-result-container');
  if (!resultBox) return;

  if (!orders || orders.length === 0) {
    resultBox.innerHTML = `
      <div class="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm text-center leading-relaxed font-medium">
        No order found for the provided details. Please check your phone number or Order ID.
      </div>
    `;
    return;
  }

  const statusBadges = {
    paid: { label: 'Paid & Processing', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: 'fa-circle-check' },
    shipped: { label: 'Out for Delivery', bg: 'bg-blue-50 border-blue-200 text-blue-700', icon: 'fa-truck' },
    delivered: { label: 'Delivered & Completed', bg: 'bg-emerald-100 border-emerald-300 text-emerald-800', icon: 'fa-box-open' },
    pending: { label: 'Awaiting Payment Verification', bg: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'fa-clock' },
    awaiting_trx: { label: 'Awaiting Payment Verification', bg: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'fa-clock' },
    flagged: { label: 'Under Review', bg: 'bg-rose-50 border-rose-200 text-rose-700', icon: 'fa-triangle-exclamation' },
    cancelled: { label: 'Cancelled', bg: 'bg-gray-100 border-gray-300 text-gray-700', icon: 'fa-ban' }
  };

  const html = orders.map(order => {
    const rawStatus = (order.status || 'pending').toLowerCase();
    const badge = statusBadges[rawStatus] || statusBadges['pending'];
    const orderDate = order.created_at || order.purchaseDate || order.updated_at;

    return `
      <div class="bg-white p-6 rounded-2xl border border-pink-100 shadow-md mb-4 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <span class="text-xs text-gray-500 font-semibold block">Order ID</span>
            <span class="font-mono text-base font-bold text-[#2A2A2A]">${escapeHtml(order.order_id || order.id || 'N/A')}</span>
          </div>
          <div class="px-3 py-1.5 rounded-full border ${badge.bg} text-xs font-bold flex items-center gap-1.5">
            <i class="fa-solid ${badge.icon}"></i>
            <span>${badge.label}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span class="text-gray-500 font-medium block">Customer Name</span>
            <span class="font-semibold text-[#2A2A2A]">${escapeHtml(order.customer_name || 'Valued Customer')}</span>
          </div>
          <div>
            <span class="text-gray-500 font-medium block">Phone Number</span>
            <span class="font-semibold text-[#2A2A2A]">${escapeHtml(order.customer_phone || 'N/A')}</span>
          </div>
          <div>
            <span class="text-gray-500 font-medium block">Date Placed</span>
            <span class="font-semibold text-[#2A2A2A]">${formatDate(orderDate)}</span>
          </div>
          <div>
            <span class="text-gray-500 font-medium block">Expected Advance</span>
            <span class="font-bold text-primary">৳${order.expected_amount || 30}</span>
          </div>
        </div>

        ${order.trx_id ? `
          <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
            <span class="text-gray-500">bKash Transaction ID</span>
            <span class="font-mono font-bold text-[#2A2A2A]">${escapeHtml(order.trx_id)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  resultBox.innerHTML = html;
}
