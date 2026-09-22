import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';
import { createSteadfastOrder, checkSteadfastStatusByTrackingCode } from '../../services/steadfast-service.js';

export function openOrderDetailModal(order, onStatusChange) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const statusColorMap = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pending' },
    paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Paid' },
    flagged: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Flagged' },
    unmatched: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Unmatched' },
    completed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Completed' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Cancelled' },
  };

  const statusStyle = statusColorMap[order.status] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: order.status };

  // Format date
  const dateStr = order.createdAt ? new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(order.createdAt) : 'Unknown Date';

  // Photo list
  const allPhotos = [...order.photoUrls];
  order.items.forEach(item => {
    if (item.coverPhotoUrl && !allPhotos.includes(item.coverPhotoUrl)) allPhotos.push(item.coverPhotoUrl);
    if (item.backPhotoUrl && !allPhotos.includes(item.backPhotoUrl)) allPhotos.push(item.backPhotoUrl);
    (item.photoUrls || []).forEach(p => { if (!allPhotos.includes(p)) allPhotos.push(p); });
    (item.innerPhotoUrls || []).forEach(p => { if (!allPhotos.includes(p)) allPhotos.push(p); });
  });

  const modalHtml = `
    <div id="order-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div class="admin-modal-card w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        <!-- Modal Top Header -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold">
              <i class="fa-solid fa-receipt text-base"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-bold text-slate-900">Order #${order.orderId}</h3>
                <button class="text-slate-400 hover:text-teal-600 transition-colors text-xs" title="Copy Order ID" onclick="navigator.clipboard.writeText('${order.orderId}'); adminState.showToast('info', 'Order ID copied!');">
                  <i class="fa-regular fa-copy"></i>
                </button>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}">
                  ${statusStyle.label}
                </span>
              </div>
              <p class="text-xs text-slate-500 font-medium">${dateStr}</p>
            </div>
          </div>
          <button id="close-order-modal-btn" class="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <!-- Modal Body Scrollable -->
        <div class="p-6 overflow-y-auto space-y-6 admin-custom-scroll">
          
          <!-- Two Columns: Customer Info & Financial Summary -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Customer Info Box -->
            <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div class="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <i class="fa-solid fa-user text-teal-600"></i> Customer Details
              </div>
              <div>
                <div class="text-sm font-bold text-slate-900">${order.customerName}</div>
                <div class="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                  <i class="fa-solid fa-phone text-slate-400 text-[10px]"></i>
                  <a href="tel:${order.customerPhone}" class="text-teal-700 font-semibold hover:underline">${order.customerPhone}</a>
                  <button class="text-slate-400 hover:text-slate-700 text-xs ml-1" title="Copy Phone" onclick="navigator.clipboard.writeText('${order.customerPhone}'); adminState.showToast('info', 'Phone number copied');">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                </div>
                ${order.customerEmail ? `<div class="text-xs text-slate-500 mt-0.5"><i class="fa-solid fa-envelope text-slate-400 text-[10px] mr-1"></i>${order.customerEmail}</div>` : ''}
              </div>

              <div class="pt-2 border-t border-slate-200/60">
                <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Delivery Address</span>
                <p class="text-xs text-slate-800 leading-relaxed font-medium bg-white p-2.5 rounded-lg border border-slate-200 select-all">
                  ${order.shippingAddress || '<span class="text-slate-400 italic">No delivery address provided</span>'}
                </p>
                ${order.deliveryNote ? `<p class="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-2"><i class="fa-solid fa-note-sticky mr-1"></i><strong>Note:</strong> ${order.deliveryNote}</p>` : ''}
              </div>
            </div>

            <!-- Payment & Financial Summary -->
            <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div class="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span><i class="fa-solid fa-credit-card text-teal-600 mr-1"></i> Payment Summary</span>
                <span class="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-semibold text-[11px]">${order.paymentMethod}</span>
              </div>

              <div class="space-y-1.5 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                <div class="flex justify-between">
                  <span>Product Amount:</span>
                  <span class="font-semibold text-slate-800">৳${order.productAmount}</span>
                </div>
                <div class="flex justify-between">
                  <span>Delivery Charge:</span>
                  <span class="font-semibold text-slate-800">৳${order.deliveryCharge}</span>
                </div>
                <div class="flex justify-between pt-1.5 border-t border-slate-100 font-bold text-sm text-slate-900">
                  <span>Total Payable:</span>
                  <span class="text-teal-700">৳${order.expectedAmount}</span>
                </div>
              </div>

              <div class="pt-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 font-medium">TrxID / Reference:</span>
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-slate-900 bg-slate-200/80 px-2 py-0.5 rounded text-xs">
                      ${order.trxId || 'N/A'}
                    </span>
                    ${order.trxId ? `
                      <button class="text-slate-400 hover:text-teal-600 text-xs" title="Copy TrxID" onclick="navigator.clipboard.writeText('${order.trxId}'); adminState.showToast('info', 'TrxID copied');">
                        <i class="fa-regular fa-copy"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>

              ${order.flagReason ? `
                <div class="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <i class="fa-solid fa-triangle-exclamation mr-1 text-rose-600"></i><strong>Flag Reason:</strong> ${order.flagReason}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Items Ordered Section -->
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                <i class="fa-solid fa-box text-teal-600 mr-1.5"></i> Order Items (${order.items.length || 1})
              </span>
              <span class="text-xs font-medium text-slate-500">Product: <strong>${order.productType || 'Custom'}</strong></span>
            </div>
            
            <div class="divide-y divide-slate-100">
              ${order.items.length > 0 ? order.items.map(item => `
                <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="text-sm font-bold text-slate-900">${item.templateName}</h4>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                        ${item.productType}
                      </span>
                    </div>
                    <div class="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      ${item.recipientName ? `<span>Recipient: <strong class="text-slate-700">${item.recipientName}</strong></span>` : ''}
                      ${item.requiredPhotoCount ? `<span>Photos: <strong class="text-slate-700">${item.photoUrls.length || order.photoUrls.length}/${item.requiredPhotoCount}</strong></span>` : ''}
                      ${item.comboQuantity > 1 ? `<span>Qty: <strong class="text-slate-700">${item.comboQuantity}</strong></span>` : ''}
                      ${item.occasion ? `<span>Occasion: <strong class="text-slate-700">${item.occasion}</strong></span>` : ''}
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    ${item.canvaLink ? `
                      <a href="${item.canvaLink}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5">
                        <i class="fa-solid fa-palette text-xs"></i> Open Canva
                      </a>
                    ` : ''}
                  </div>
                </div>
              `).join('') : `
                <div class="p-4 text-xs text-slate-600">
                  <p class="font-semibold text-slate-800">${order.templateName || 'Custom Print Bundle'}</p>
                  <p class="text-slate-500 mt-1">Product Type: ${order.productType}</p>
                </div>
              `}
            </div>
          </div>

          <!-- Customer Uploaded Photos Preview Grid -->
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                <i class="fa-solid fa-images text-teal-600 mr-1.5"></i> Customer Photos (${allPhotos.length})
              </span>
              ${allPhotos.length > 0 ? `
                <button id="download-order-photos-zip-btn" class="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1">
                  <i class="fa-solid fa-file-zipper text-xs"></i> Download ZIP
                </button>
              ` : ''}
            </div>

            <div class="p-4">
              ${allPhotos.length > 0 ? `
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-1 admin-custom-scroll">
                  ${allPhotos.map((url, idx) => `
                    <div class="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
                      <img src="${url}" alt="Photo ${idx + 1}" class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy">
                      <a href="${url}" target="_blank" download class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                      </a>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div class="text-center py-6 text-slate-400 text-xs font-medium">
                  <i class="fa-regular fa-image text-2xl mb-1 text-slate-300 block"></i>
                  No photos uploaded for this order yet.
                </div>
              `}
            </div>
          </div>

          <!-- Courier Integration (Steadfast) -->
          <div class="bg-sky-50/60 border border-sky-200 rounded-xl p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 text-xs font-bold text-sky-900 uppercase tracking-wider">
                <i class="fa-solid fa-truck-fast text-sky-600"></i> Steadfast Courier Consignment
              </div>
              ${order.trackingNumber ? `
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                  Tracking: ${order.trackingNumber}
                </span>
              ` : `
                <span class="text-xs text-slate-400 italic">Not Dispatched</span>
              `}
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="text-slate-600">
                ${order.trackingNumber ? `
                  <p class="font-medium text-slate-800">Consignment Code: <strong class="font-mono text-sky-700">${order.trackingNumber}</strong></p>
                  <div id="live-steadfast-status" class="text-slate-500 mt-1">Click check status to query Steadfast API.</div>
                ` : `
                  <p class="text-slate-600">Create a delivery consignment directly in Steadfast portal with 1 click.</p>
                `}
              </div>

              <div class="flex items-center gap-2">
                ${order.trackingNumber ? `
                  <button id="check-tracking-btn" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                    <i class="fa-solid fa-rotate text-xs"></i> Check Status
                  </button>
                ` : `
                  <button id="dispatch-steadfast-btn" class="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
                    <i class="fa-solid fa-paper-plane text-xs"></i> Dispatch to Steadfast
                  </button>
                `}
              </div>
            </div>
          </div>

          <!-- Admin Notes Section -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Notes & Instructions
            </label>
            <textarea 
              id="admin-order-note-input" 
              rows="2" 
              placeholder="Add internal notes about this order..."
              class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 placeholder:text-slate-400 text-slate-800"
            >${order.adminNote || ''}</textarea>
          </div>

        </div>

        <!-- Modal Footer Actions Bar -->
        <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <button id="modal-delete-order-btn" class="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 flex items-center gap-1">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>

          <div class="flex items-center gap-2">
            ${order.status === 'pending' ? `
              <button id="modal-flag-order-btn" class="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 flex items-center gap-1.5">
                <i class="fa-solid fa-flag"></i> Flag Order
              </button>
              <button id="modal-approve-order-btn" class="px-4 py-1.5 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-lg shadow-sm transition-all flex items-center gap-1.5">
                <i class="fa-solid fa-check"></i> Approve Order
              </button>
            ` : order.status === 'paid' ? `
              <button id="modal-complete-order-btn" class="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5">
                <i class="fa-solid fa-square-check"></i> Mark Completed
              </button>
            ` : order.status === 'flagged' ? `
              <button id="modal-approve-order-btn" class="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5">
                <i class="fa-solid fa-check-double"></i> Resolve & Approve
              </button>
            ` : ''}

            <button id="modal-cancel-order-btn" class="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors">
              Cancel Order
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('order-modal-backdrop');

  // Trigger animation
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
  });

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-order-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  // Note auto-save on change
  const noteInput = document.getElementById('admin-order-note-input');
  noteInput.addEventListener('blur', async () => {
    if (noteInput.value !== order.adminNote) {
      await adminApi.updateOrderStatus(order.orderId, order.status, noteInput.value.trim());
      adminState.showToast('info', 'Admin note updated');
    }
  });

  // Approve Order
  const approveBtn = document.getElementById('modal-approve-order-btn');
  if (approveBtn) {
    approveBtn.addEventListener('click', async () => {
      if (!confirm(`Are you sure you want to approve Order #${order.orderId}?`)) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'paid', noteInput.value.trim() || 'Approved by Admin');
        adminState.showToast('success', `Order #${order.orderId} approved successfully!`);
        closeModal();
        if (onStatusChange) onStatusChange();
      } catch (err) {
        adminState.showToast('error', 'Failed to approve order: ' + err.message);
      }
    });
  }

  // Flag Order
  const flagBtn = document.getElementById('modal-flag-order-btn');
  if (flagBtn) {
    flagBtn.addEventListener('click', async () => {
      const reason = prompt('Please enter flag reason (e.g. Invalid TrxID, Underpaid amount):', 'Payment mismatch or invalid TrxID');
      if (reason === null) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'flagged', noteInput.value.trim(), { flagReason: reason });
        adminState.showToast('warning', `Order #${order.orderId} has been flagged`);
        closeModal();
        if (onStatusChange) onStatusChange();
      } catch (err) {
        adminState.showToast('error', 'Failed to flag order: ' + err.message);
      }
    });
  }

  // Mark Completed
  const completeBtn = document.getElementById('modal-complete-order-btn');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      if (!confirm(`Mark Order #${order.orderId} as completed?`)) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'completed', noteInput.value.trim());
        adminState.showToast('success', `Order #${order.orderId} marked as completed!`);
        closeModal();
        if (onStatusChange) onStatusChange();
      } catch (err) {
        adminState.showToast('error', 'Failed to update order: ' + err.message);
      }
    });
  }

  // Cancel Order
  const cancelBtn = document.getElementById('modal-cancel-order-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (!confirm(`Are you sure you want to cancel Order #${order.orderId}?`)) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'cancelled', noteInput.value.trim());
        adminState.showToast('info', `Order #${order.orderId} cancelled`);
        closeModal();
        if (onStatusChange) onStatusChange();
      } catch (err) {
        adminState.showToast('error', 'Failed to cancel order: ' + err.message);
      }
    });
  }

  // Delete Order
  const deleteBtn = document.getElementById('modal-delete-order-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`CRITICAL: Permanently delete Order #${order.orderId}? This cannot be undone!`)) return;
      try {
        await adminApi.deleteOrder(order.orderId);
        adminState.showToast('error', `Order #${order.orderId} permanently deleted`);
        closeModal();
        if (onStatusChange) onStatusChange();
      } catch (err) {
        adminState.showToast('error', 'Failed to delete order: ' + err.message);
      }
    });
  }

  // Steadfast Dispatch
  const dispatchBtn = document.getElementById('dispatch-steadfast-btn');
  if (dispatchBtn) {
    dispatchBtn.addEventListener('click', async () => {
      if (!order.shippingAddress || !order.customerPhone) {
        adminState.showToast('error', 'Missing customer phone or delivery address!');
        return;
      }
      if (!confirm(`Dispatch Order #${order.orderId} to Steadfast Courier? COD Amount: ৳${order.status === 'paid' ? 0 : order.expectedAmount}`)) return;

      dispatchBtn.disabled = true;
      dispatchBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Dispatching...';

      try {
        const codAmount = order.status === 'paid' ? 0 : order.expectedAmount;
        const res = await createSteadfastOrder({
          invoice: order.orderId,
          recipient_name: order.customerName,
          recipient_phone: order.customerPhone,
          recipient_address: order.shippingAddress,
          cod_amount: codAmount,
          item_description: order.templateName || order.productType || 'Petty Bloom Customized Prints',
          note: order.deliveryNote || 'পার্সেল ডেলিভারির সময় রিসিভ করার অনুমতি দিন।'
        });

        if (res.success && res.tracking_code) {
          await adminApi.updateOrderStatus(order.orderId, order.status, noteInput.value.trim(), {
            trackingNumber: res.tracking_code,
            consignment_id: res.consignment_id,
            courierName: 'Steadfast Courier',
            steadfast_consignment: res.consignment
          });
          adminState.showToast('success', `Dispatched to Steadfast! Tracking: ${res.tracking_code}`);
          closeModal();
          if (onStatusChange) onStatusChange();
        } else {
          adminState.showToast('error', res.message || 'Steadfast dispatch failed');
        }
      } catch (err) {
        adminState.showToast('error', 'Steadfast error: ' + err.message);
      } finally {
        if (dispatchBtn) dispatchBtn.disabled = false;
      }
    });
  }

  // Check Steadfast Live Status
  const checkTrackingBtn = document.getElementById('check-tracking-btn');
  if (checkTrackingBtn) {
    checkTrackingBtn.addEventListener('click', async () => {
      const statusBox = document.getElementById('live-steadfast-status');
      statusBox.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-sky-600"></i> Checking status from Steadfast API...';
      try {
        const res = await checkSteadfastStatusByTrackingCode(order.trackingNumber);
        if (res.delivery_status) {
          statusBox.innerHTML = `<span class="font-bold text-sky-800">Status:</span> ${res.delivery_status.toUpperCase()}`;
        } else {
          statusBox.innerHTML = `Response: ${res.status || 'Received'}`;
        }
      } catch (err) {
        statusBox.innerHTML = `<span class="text-rose-600">Failed to fetch courier status: ${err.message}</span>`;
      }
    });
  }

  // Download Order Photos as ZIP
  const downloadZipBtn = document.getElementById('download-order-photos-zip-btn');
  if (downloadZipBtn && window.JSZip && window.saveAs) {
    downloadZipBtn.addEventListener('click', async () => {
      downloadZipBtn.disabled = true;
      downloadZipBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Creating ZIP...';

      try {
        const zip = new window.JSZip();
        const folder = zip.folder(`Order_${order.orderId}`);

        for (let i = 0; i < allPhotos.length; i++) {
          const url = allPhotos[i];
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const ext = url.split('.').pop().split('?')[0] || 'jpg';
            folder.file(`photo_${i + 1}.${ext}`, blob);
          } catch (e) {
            console.warn(`Failed to fetch photo ${i + 1}:`, e);
          }
        }

        const zipContent = await zip.generateAsync({ type: 'blob' });
        window.saveAs(zipContent, `Order_${order.orderId}_${order.customerName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
        adminState.showToast('success', 'Photos ZIP downloaded successfully!');
      } catch (err) {
        adminState.showToast('error', 'Failed to generate ZIP: ' + err.message);
      } finally {
        downloadZipBtn.disabled = false;
        downloadZipBtn.innerHTML = '<i class="fa-solid fa-file-zipper text-xs"></i> Download ZIP';
      }
    });
  }
}
