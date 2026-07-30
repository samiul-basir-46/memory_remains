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

          <button type="submit" id="track-submit-btn" class="w-full py-3.5 bg-[#C97B5F] hover:bg-[#8B4A38] text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center">Track Order</button>
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
  const seenMap = new Map();

  // Query Firebase Firestore FIRST for real-time order status
  try {
    const { db } = getFirebaseServices();
    if (db) {
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

        const qP1 = await db.collection('purchases').where('orderId', '==', orderId).get();
        qP1.forEach(doc => seenMap.set(doc.id, { order_id: doc.id, ...doc.data() }));

        const qP2 = await db.collection('purchases').where('order_id', '==', orderId).get();
        qP2.forEach(doc => seenMap.set(doc.id, { order_id: doc.id, ...doc.data() }));
      }

      if (phone) {
        const qP = await db.collection('purchases').where('customer_phone', '==', phone).get();
        qP.forEach(doc => seenMap.set(doc.id, { order_id: doc.id, ...doc.data() }));

        const qPAlt = await db.collection('purchases').where('customerPhone', '==', phone).get();
        qPAlt.forEach(doc => seenMap.set(doc.id, { order_id: doc.id, ...doc.data() }));

        const qO = await db.collection('orders').where('customer_phone', '==', phone).get();
        qO.forEach(doc => seenMap.set(doc.id, { order_id: doc.id, ...doc.data() }));
      }
    }
  } catch (fsErr) {
    console.warn('Firestore tracking search notice:', fsErr);
  }

  // Fallback to API if Firestore yields nothing
  if (seenMap.size === 0) {
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
          data.orders.forEach(o => {
            const idKey = o.order_id || o.id;
            if (idKey && !seenMap.has(idKey)) {
              seenMap.set(idKey, o);
            }
          });
        }
      }
    } catch (err) {
      console.warn('API track-order notice:', err);
    }
  }

  ordersList = Array.from(seenMap.values());

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Track Order';
  }

  renderTrackingResult(ordersList);
}

function renderAdminFlagNoteBanner(order) {
  const status = (order.status || '').toLowerCase();

  // STRICT RULE: ONLY show Action Required Banner IF status IS 'flagged'!
  if (status !== 'flagged') return '';

  const orderId = order.id || order.order_id || order.orderId || '';
  const expected = Number(order.expected_amount || order.expectedAmount || order.amount || 0);
  const received = order.received_amount !== undefined && order.received_amount !== null
    ? Number(order.received_amount)
    : (order.receivedAmount !== undefined && order.receivedAmount !== null ? Number(order.receivedAmount) : null);

  const dueAmount = (received !== null && expected > 0 && received < expected) ? (expected - received) : null;

  let reasonTitle = 'Payment Review & Action Required';
  if (flagReason === 'amount_mismatch' || (dueAmount !== null && dueAmount > 0)) {
    reasonTitle = 'Partial Payment Received — Additional Payment Required';
  } else if (flagReason === 'duplicate_trx_reuse') {
    reasonTitle = 'Duplicate Transaction ID — Review Required';
  } else if (flagReason === 'incorrect_trx') {
    reasonTitle = 'Invalid Transaction ID — Review Required';
  }

  const waText = encodeURIComponent(`Hi Petty Bloom! My Order ID ${orderId} is on hold. Admin Note: ${adminNote || 'Payment review'}`);
  const waUrl = `https://wa.me/8801622000471?text=${waText}`;

  return `
    <div class="my-3 p-4 rounded-2xl bg-rose-50/90 border-2 border-rose-200 text-rose-950 space-y-3 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/80 pb-2.5">
        <div class="flex items-center gap-2 text-rose-900 font-extrabold text-xs uppercase tracking-wide">
          <i class="fa-solid fa-triangle-exclamation text-rose-600 text-base animate-bounce"></i>
          <span>${escapeHtml(reasonTitle)}</span>
        </div>
        <span class="text-[10px] font-extrabold bg-rose-200 text-rose-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Action Required</span>
      </div>

      ${dueAmount !== null ? `
        <div class="flex flex-wrap items-center justify-between gap-2 bg-white/90 p-3 rounded-xl border border-rose-200 text-xs">
          <span class="text-gray-600 font-medium">Expected Amount: <strong class="text-gray-900">৳${expected}</strong></span>
          <span class="text-rose-700 font-bold">Received: ৳${received}</span>
          <span class="text-rose-950 font-extrabold bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg">Due Amount: ৳${dueAmount}</span>
        </div>
      ` : ''}

      ${adminNote ? `
        <div class="bg-white p-3.5 rounded-xl border border-rose-200 text-xs space-y-1.5 shadow-2xs">
          <span class="text-rose-900 font-bold flex items-center gap-1.5 text-xs">
            <i class="fa-solid fa-clipboard-user text-rose-600"></i> Note / Message from Petty Bloom Admin:
          </span>
          <p class="text-gray-900 font-semibold leading-relaxed m-0 text-xs sm:text-sm bg-rose-50/60 p-2.5 rounded-lg border border-rose-100">
            ${escapeHtml(adminNote)}
          </p>
        </div>
      ` : `
        <p class="text-xs text-rose-900 font-medium m-0 leading-relaxed">
          Your order is currently under review by our admin team. If additional payment is required, please check below or contact us directly on WhatsApp.
        </p>
      `}

      <!-- Direct Action / WhatsApp Button -->
      <div class="pt-1 flex flex-wrap items-center gap-2">
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs rounded-xl shadow-xs transition-all no-underline active:scale-95">
          <i class="fa-brands fa-whatsapp text-base"></i> Message us on WhatsApp to Resolve
        </a>
      </div>
    </div>
  `;
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
    paid: { label: 'Payment Verified', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: 'fa-circle-check' },
    confirmed: { label: 'Payment Verified', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: 'fa-circle-check' },
    preparing: { label: 'Preparing Order', bg: 'bg-purple-50 border-purple-200 text-purple-700', icon: 'fa-box-archive' },
    shipped: { label: 'Shipped', bg: 'bg-blue-50 border-blue-200 text-blue-700', icon: 'fa-truck-fast' },
    delivered: { label: 'Delivered Successfully', bg: 'bg-emerald-100 border-emerald-300 text-emerald-800', icon: 'fa-box-open' },
    completed: { label: 'Delivered Successfully', bg: 'bg-emerald-100 border-emerald-300 text-emerald-800', icon: 'fa-box-open' },
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

    const isConfirmed = ['paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed'].includes(rawStatus);
    const isPreparing = ['preparing', 'shipped', 'delivered', 'completed'].includes(rawStatus);
    const isShipped = ['shipped', 'delivered', 'completed'].includes(rawStatus);
    const isDelivered = ['delivered', 'completed'].includes(rawStatus);

    const actualOrderId = order.order_id || order.id || 'N/A';
    const safeOrderId = actualOrderId.replace(/[^a-zA-Z0-9_-]/g, '');

    let itemsList = Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [{
        item_id: actualOrderId,
        template_name: order.template_name || order.templateName || 'Custom Magazine',
        product_type: productType,
        required_photo_count: requiredPhotoCount,
        photos_uploaded: photosUploaded,
        canva_link: canvaLink
      }];

    let itemsSectionHtml = itemsList.map((item, idx) => {
      const itemPType = (item.product_type || 'magazine').toLowerCase();
      const isPhysicalNonMag = itemPType === 'poster' || itemPType === 'sticker' || itemPType === 'wall_frame' || itemPType === 'frame';
      const itemIsPaid = rawStatus === 'paid' || rawStatus === 'delivered' || rawStatus === 'completed';
      const itemUploaded = Boolean(item.photos_uploaded || item.photosUploaded);
      const itemReqCount = Number(item.required_photo_count || item.photo_count || 10);
      const itemCanva = item.canva_link || item.canvaUrl || canvaLink;

      let itemBannerHtml = '';
      if (itemPType === 'template') {
        if ((rawStatus === 'delivered' || rawStatus === 'completed') && itemCanva) {
          itemBannerHtml = `
            <div class="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-xl border border-pink-200 text-center space-y-3">
              <h5 class="font-bold text-sm text-[#2A2A2A]">🎉 ${escapeHtml(item.template_name || 'Template')} Ready</h5>
              <a href="${escapeHtml(itemCanva)}" target="_blank" rel="noopener noreferrer" class="px-4 py-2 bg-[#C97B5F] hover:bg-[#8B4A38] text-white font-bold text-xs rounded-lg inline-flex items-center gap-2">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Open in Canva
              </a>
            </div>
          `;
        } else {
          itemBannerHtml = `
            <div class="p-3 bg-pink-50 rounded-xl border border-pink-100 text-xs text-primary font-bold">
              ✅ Payment confirmed! Canva link will be delivered soon.
            </div>
          `;
        }
      } else if (isPhysicalNonMag) {
        const posterSpotsList = Array.isArray(item.selected_posters || item.selectedPosters) ? (item.selected_posters || item.selectedPosters) : [];
        if (itemPType === 'poster' && posterSpotsList.length > 0) {
          itemBannerHtml = `
            <div class="p-3 bg-blue-50/70 rounded-xl border border-blue-100 space-y-2">
              <div class="flex items-center justify-between text-xs text-blue-900 font-bold">
                <span>📦 ${posterSpotsList.length} Selected Poster Designs</span>
                <span class="text-[10px] text-blue-600 font-normal">Ready for Print</span>
              </div>
              <div class="grid grid-cols-5 gap-1.5 pt-1">
                ${posterSpotsList.map((spot, sIdx) => `
                  <div class="relative aspect-square rounded-lg overflow-hidden border border-blue-200 bg-white group shadow-2xs">
                    <img src="${escapeHtml(spot.imageUrl || '')}" class="w-full h-full object-cover">
                    <span class="absolute top-0.5 left-0.5 px-1 py-0.2 bg-black/75 text-white text-[8px] font-bold rounded">#${sIdx + 1}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        } else {
          itemBannerHtml = `
            <div class="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-900 font-medium">
              📦 Physical Order — Our team is printing and packaging your item for courier delivery.
            </div>
          `;
        }
      } else {
        if (rawStatus === 'completed') {
          itemBannerHtml = `
            <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold">
              ✅ Magazine order complete!
            </div>
          `;
        } else if (itemUploaded) {
          itemBannerHtml = `
            <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold">
              ✅ Photos received — magazine is being prepared
            </div>
          `;
        } else if (['paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed'].includes(rawStatus)) {
          const mountId = `track-upload-mount-${safeOrderId}-${idx}`;
          itemBannerHtml = `<div id="${mountId}" class="mt-3"></div>`;
          uploadMountTasks.push({
            mountId,
            orderId: actualOrderId,
            itemId: item.item_id || `${actualOrderId}-${idx + 1}`,
            itemIndex: idx,
            requiredPhotoCount: itemReqCount,
            orderObj: order,
            itemObj: item
          });
        } else {
          itemBannerHtml = `
            <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
              ⏳ Payment Verification Pending — Photo upload will unlock once payment is verified.
            </div>
          `;
        }
      }

      return `
        <div class="p-3 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2">
          <div class="flex justify-between items-center text-xs font-bold">
            <span class="text-[#2A2A2A]">${escapeHtml(item.template_name || 'Magazine Item')}</span>
            <span class="px-2 py-0.5 rounded text-[10px] ${itemPType === 'magazine' ? 'bg-purple-100 text-purple-800' : 'bg-teal-100 text-teal-800'}">${itemPType.toUpperCase()}</span>
          </div>
          ${itemBannerHtml}
        </div>
      `;
    }).join('');

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

        ${renderAdminFlagNoteBanner(order)}

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
            <span class="font-bold text-primary">৳${order.expected_amount || order.amount || 60}</span>
          </div>
        </div>

        ${order.trx_id || order.transactionId ? `
          <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
            <span class="text-gray-500">bKash Transaction ID</span>
            <span class="font-mono font-bold text-[#2A2A2A]">${escapeHtml(order.trx_id || order.transactionId)}</span>
          </div>
        ` : ''}

        ${rawStatus !== 'flagged' ? `
          <div class="p-4 bg-pink-50/40 rounded-xl border border-pink-100 space-y-2.5">
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Order Progression</span>
            <div class="relative flex items-center justify-between text-xs">
              <div class="absolute top-3.5 left-4 right-4 h-0.5 -translate-y-1/2 flex z-0">
                <div class="h-full flex-1 ${isPreparing ? 'bg-purple-500' : 'bg-gray-200'}"></div>
                <div class="h-full flex-1 ${isShipped ? 'bg-blue-500' : 'bg-gray-200'}"></div>
                <div class="h-full flex-1 ${isDelivered ? 'bg-emerald-500' : 'bg-gray-200'}"></div>
              </div>
              <div class="relative z-10 flex flex-col items-center text-center">
                <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${isConfirmed ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}">✓</div>
                <span class="text-[10px] font-bold mt-1.5 ${isConfirmed ? 'text-emerald-700' : 'text-gray-400'}">Verified</span>
              </div>
              <div class="relative z-10 flex flex-col items-center text-center">
                <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${isPreparing ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}">📦</div>
                <span class="text-[10px] font-bold mt-1.5 ${isPreparing ? 'text-purple-700' : 'text-gray-400'}">Preparing</span>
              </div>
              <div class="relative z-10 flex flex-col items-center text-center">
                <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${isShipped ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}">🚚</div>
                <span class="text-[10px] font-bold mt-1.5 ${isShipped ? 'text-blue-700' : 'text-gray-400'}">Shipped</span>
              </div>
              <div class="relative z-10 flex flex-col items-center text-center">
                <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${isDelivered ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}">🎉</div>
                <span class="text-[10px] font-bold mt-1.5 ${isDelivered ? 'text-emerald-700' : 'text-gray-400'}">Delivered</span>
              </div>
            </div>
            ${(order.courier_name || order.courierName || order.tracking_number || order.trackingNumber) ? `
              <div class="mt-2.5 p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-2.5">
                  <i class="fa-solid fa-truck-fast text-blue-600 text-base"></i>
                  <div>
                    <span class="font-bold text-blue-900 block">Courier: ${escapeHtml(order.courier_name || order.courierName || 'Courier Delivery')}</span>
                    ${(order.tracking_number || order.trackingNumber) ? `<span class="text-[11px] text-blue-700 font-medium">Tracking Code: <strong class="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">${escapeHtml(order.tracking_number || order.trackingNumber)}</strong></span>` : ''}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="space-y-3 pt-2">
          <h5 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Order Items (${itemsList.length})</h5>
          ${itemsSectionHtml}
        </div>
      </div>
    `;
  }).join('');

  resultBox.innerHTML = html;

  uploadMountTasks.forEach(task => {
    const mountEl = resultBox.querySelector(`#${task.mountId}`);
    if (mountEl) {
      renderPhotoUploadUI(mountEl, {
        orderId: task.orderId,
        itemId: task.itemId,
        itemIndex: task.itemIndex,
        requiredPhotoCount: task.requiredPhotoCount,
        onSuccess: () => {
          if (task.itemObj) task.itemObj.photos_uploaded = true;
          task.orderObj.photos_uploaded = true;
          task.orderObj.photosUploaded = true;
          renderTrackingResult(orders);
        }
      });
    }
  });
}
