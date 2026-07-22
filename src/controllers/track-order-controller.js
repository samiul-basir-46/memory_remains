import { escapeHtml, qs } from '../utils/ui.js';
import { getFirebaseServices } from '../services/firebase-service.js';
import { renderPhotoUploadUI } from '../components/photo-upload.js';

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
      <div class="mb-6 p-4 rounded-xl bg-pink-50 border border-pink-200 text-xs text-[#2A2A2A] flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-circle-info text-primary text-base"></i>
          <span>Log in to view all your orders and upload photos directly from your account dashboard.</span>
        </div>
        <a href="/pages/profile#orders" class="flex-shrink-0 px-3.5 py-2 bg-primary hover:bg-primary-strong text-white font-bold rounded-lg no-underline text-xs shadow-sm transition-colors">My Orders</a>
      </div>

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
    console.warn('API track-order notice:', err);
  }

  if (ordersList.length === 0) {
    try {
      const { db } = getFirebaseServices();
      if (db) {
        const seenMap = new Map();

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
      console.error('Firestore tracking search notice:', fsErr);
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
    completed: { label: 'Delivered & Completed', bg: 'bg-emerald-100 border-emerald-300 text-emerald-800', icon: 'fa-box-open' },
    pending: { label: 'Awaiting Payment Verification', bg: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'fa-clock' },
    awaiting_trx: { label: 'Awaiting Payment Verification', bg: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'fa-clock' },
    flagged: { label: 'Under Review', bg: 'bg-rose-50 border-rose-200 text-rose-700', icon: 'fa-triangle-exclamation' },
    cancelled: { label: 'Cancelled', bg: 'bg-gray-100 border-gray-300 text-gray-700', icon: 'fa-ban' }
  };

  const uploadMountTasks = [];
  const copyCanvaTasks = [];

  const html = orders.map(order => {
    const rawStatus = (order.status || 'pending').toLowerCase();
    const badge = statusBadges[rawStatus] || statusBadges['pending'];
    const orderDate = order.created_at || order.purchaseDate || order.updated_at;

    const actualOrderId = order.order_id || order.id || 'N/A';
    const safeOrderId = actualOrderId.replace(/[^a-zA-Z0-9_-]/g, '');

    const productType = order.product_type || (order.canva_link || order.canvaUrl ? 'template' : 'magazine');
    const photosUploaded = Boolean(order.photos_uploaded || order.photosUploaded);
    const requiredPhotoCount = Number(order.required_photo_count || order.photo_count || order.requiredPhotoCount || 10);
    const canvaLink = order.canva_link || order.canvaUrl || order.canva_url || order.canvaLink || '';

    let statusBannerHtml = '';

    if (productType === 'template') {
      if ((rawStatus === 'delivered' || rawStatus === 'completed') && canvaLink) {
        statusBannerHtml = `
          <div class="bg-gradient-to-r from-pink-50 to-purple-50 p-6 rounded-2xl border border-pink-200 text-center space-y-4 shadow-sm">
            <div class="w-12 h-12 bg-pink-100 text-primary rounded-full flex items-center justify-center text-xl mx-auto">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <h4 class="font-heading text-xl font-bold text-[#2A2A2A]">🎉 Your template is ready!</h4>
            <div class="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <a href="${escapeHtml(canvaLink)}" target="_blank" rel="noopener noreferrer" class="px-6 py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors no-underline inline-flex items-center justify-center gap-2">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                <span>Open in Canva</span>
              </a>
              <button type="button" id="copy-canva-btn-${safeOrderId}" class="px-6 py-3.5 bg-white border border-gray-300 hover:bg-gray-50 text-[#2A2A2A] font-bold text-sm rounded-xl shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center gap-2">
                <i class="fa-regular fa-copy"></i>
                <span id="copy-canva-text-${safeOrderId}">Copy Link</span>
              </button>
            </div>
          </div>
        `;
        copyCanvaTasks.push({ safeOrderId, canvaLink });
      } else if (rawStatus === 'paid') {
        statusBannerHtml = `
          <div class="p-4 rounded-xl bg-pink-50 border border-pink-200 text-primary font-bold text-sm text-center flex items-center justify-center gap-2">
            <i class="fa-solid fa-circle-check text-primary text-lg"></i>
            <span>✅ Payment confirmed! We're preparing your Canva template link.</span>
          </div>
        `;
      }
    } else {
      if (rawStatus === 'completed') {
        statusBannerHtml = `
          <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm text-center flex items-center justify-center gap-2">
            <i class="fa-solid fa-circle-check text-emerald-500 text-lg"></i>
            <span>✅ Your magazine order is complete!</span>
          </div>
        `;
      } else if (photosUploaded) {
        statusBannerHtml = `
          <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm text-center flex items-center justify-center gap-2">
            <i class="fa-solid fa-circle-check text-emerald-500 text-lg"></i>
            <span>✅ Photos received — your magazine is being prepared</span>
          </div>
        `;
      } else if (rawStatus === 'paid') {
        const mountId = `track-upload-mount-${safeOrderId}`;
        statusBannerHtml = `<div id="${mountId}" class="mt-4"></div>`;
        uploadMountTasks.push({
          mountId,
          orderId: actualOrderId,
          requiredPhotoCount,
          orderObj: order
        });
      }
    }

    return `
      <div class="bg-white p-6 rounded-2xl border border-pink-100 shadow-md mb-6 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <span class="text-xs text-gray-500 font-semibold block">Order ID</span>
            <span class="font-mono text-base font-bold text-[#2A2A2A]">${escapeHtml(actualOrderId)}</span>
          </div>
          <div class="px-3 py-1.5 rounded-full border ${badge.bg} text-xs font-bold flex items-center gap-1.5">
            <i class="fa-solid ${badge.icon}"></i>
            <span>${badge.label}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span class="text-gray-500 font-medium block">Customer Name</span>
            <span class="font-semibold text-[#2A2A2A]">${escapeHtml(order.customer_name || order.customerName || 'Valued Customer')}</span>
          </div>
          <div>
            <span class="text-gray-500 font-medium block">Phone Number</span>
            <span class="font-semibold text-[#2A2A2A]">${escapeHtml(order.customer_phone || order.customerPhone || 'N/A')}</span>
          </div>
          <div>
            <span class="text-gray-500 font-medium block">Date Placed</span>
            <span class="font-semibold text-[#2A2A2A]">${formatDate(orderDate)}</span>
          </div>
          <div>
            <span class="text-gray-500 font-medium block">Expected Advance</span>
            <span class="font-bold text-primary">৳${order.expected_amount || order.amount || 30}</span>
          </div>
        </div>

        ${order.trx_id || order.transactionId ? `
          <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
            <span class="text-gray-500">bKash Transaction ID</span>
            <span class="font-mono font-bold text-[#2A2A2A]">${escapeHtml(order.trx_id || order.transactionId)}</span>
          </div>
        ` : ''}

        ${statusBannerHtml}
      </div>
    `;
  }).join('');

  resultBox.innerHTML = html;

  copyCanvaTasks.forEach(task => {
    const btn = resultBox.querySelector(`#copy-canva-btn-${task.safeOrderId}`);
    if (btn) {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(task.canvaLink);
        const txt = resultBox.querySelector(`#copy-canva-text-${task.safeOrderId}`);
        if (txt) txt.textContent = 'Link Copied!';
        setTimeout(() => { if (txt) txt.textContent = 'Copy Link'; }, 2000);
      });
    }
  });

  uploadMountTasks.forEach(task => {
    const mountEl = resultBox.querySelector(`#${task.mountId}`);
    if (mountEl) {
      renderPhotoUploadUI(mountEl, {
        orderId: task.orderId,
        requiredPhotoCount: task.requiredPhotoCount,
        onSuccess: () => {
          task.orderObj.photos_uploaded = true;
          task.orderObj.photosUploaded = true;
          renderTrackingResult(orders);
        }
      });
    }
  });
}
