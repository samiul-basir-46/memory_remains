import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';
import { createSteadfastOrder, checkSteadfastStatusByTrackingCode } from '../../services/steadfast-service.js';

export function openOrderDetailModal(order, onStatusChange) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const statusColorMap = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pending' },
    paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Paid' },
    confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Confirmed' },
    preparing: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Preparing' },
    shipped: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: 'Shipped' },
    delivered: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', label: 'Delivered' },
    completed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Completed' },
    flagged: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Flagged' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Cancelled' },
  };

  const currentStatus = (order.status || 'pending').toLowerCase();
  const statusStyle = statusColorMap[currentStatus] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: currentStatus.toUpperCase() };

  // Format date
  const dateStr = order.createdAt ? new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(order.createdAt) : 'Unknown Date';

  // Photo list
  const allPhotos = [...(order.photoUrls || [])];
  (order.items || []).forEach(item => {
    if (item.coverPhotoUrl && !allPhotos.includes(item.coverPhotoUrl)) allPhotos.push(item.coverPhotoUrl);
    if (item.backPhotoUrl && !allPhotos.includes(item.backPhotoUrl)) allPhotos.push(item.backPhotoUrl);
    (item.photoUrls || []).forEach(p => { if (p && !allPhotos.includes(p)) allPhotos.push(p); });
    (item.innerPhotoUrls || []).forEach(p => { if (p && !allPhotos.includes(p)) allPhotos.push(p); });
  });

  // Extract Occasion Info from raw / items
  const occasionData = order.raw?.occasion_data || order.raw?.occasionData || order.items?.[0]?.raw?.occasion_data || {};
  const recipientName = order.items?.[0]?.recipientName || order.raw?.recipient_name || occasionData.recipient_name || occasionData.recipientName || '';
  const occasionName = order.items?.[0]?.occasion || order.raw?.occasion || occasionData.occasion || '';
  const personalWishes = order.raw?.personal_wishes || order.raw?.wishes || occasionData.personal_wishes || occasionData.wishes || '';
  const dateOfOccasion = order.raw?.date_of_occasion || occasionData.date_of_occasion || '';
  const relationship = order.raw?.relationship || occasionData.relationship || '';
  const coverTitle = order.raw?.cover_title || occasionData.cover_title || '';
  const customQuestions = order.raw?.custom_questions || occasionData.custom_questions || null;

  const hasOccasionCard = Boolean(recipientName || occasionName || personalWishes || dateOfOccasion || relationship || coverTitle);

  let occasionEmoji = '✨';
  const occLower = (occasionName || '').toLowerCase();
  if (occLower.includes('birth')) occasionEmoji = '🎂';
  else if (occLower.includes('bf') || occLower.includes('gf') || occLower.includes('couple') || occLower.includes('love')) occasionEmoji = '💑';
  else if (occLower.includes('anniversary') || occLower.includes('marriage')) occasionEmoji = '💍';
  else if (occLower.includes('personal')) occasionEmoji = '👤';
  else if (occLower.includes('farewell')) occasionEmoji = '🎓';

  const modalHtml = `
    <div id="order-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div class="admin-modal-card w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[92vh]">
        
        <!-- Modal Top Header -->
        <div class="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70 flex-shrink-0">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold flex-shrink-0">
              <i class="fa-solid fa-receipt text-sm sm:text-base"></i>
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 class="text-sm sm:text-base font-bold text-slate-900 truncate">Order #${order.orderId}</h3>
                <button class="text-slate-400 hover:text-teal-600 transition-colors text-xs flex-shrink-0" title="Copy Order ID" onclick="navigator.clipboard.writeText('${order.orderId}'); adminState.showToast('info', 'Order ID copied!');">
                  <i class="fa-regular fa-copy"></i>
                </button>
                <span class="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border} whitespace-nowrap flex-shrink-0">
                  ${statusStyle.label}
                </span>
              </div>
              <p class="text-[11px] sm:text-xs text-slate-500 font-medium truncate">${dateStr}</p>
            </div>
          </div>
          <button id="close-order-modal-btn" class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0">
            <i class="fa-solid fa-xmark text-base sm:text-lg"></i>
          </button>
        </div>

        <!-- Modal Body Scrollable -->
        <div class="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 admin-custom-scroll">
          
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

          <!-- Occasion & Personalization Card (Matching Flutter OrderDetailScreen) -->
          ${hasOccasionCard ? `
            <div class="border border-amber-200/90 bg-amber-50/40 rounded-xl p-4 space-y-3">
              <div class="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <span class="text-base">${occasionEmoji}</span>
                <span>Occasion & Personalization Details</span>
                ${occasionName ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">${occasionName}</span>` : ''}
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                ${recipientName ? `
                  <div class="bg-white p-2.5 rounded-lg border border-amber-200/60">
                    <span class="text-slate-400 block text-[10px] uppercase font-bold">Recipient Name</span>
                    <span class="font-bold text-slate-800 text-sm">${recipientName}</span>
                  </div>
                ` : ''}
                ${relationship ? `
                  <div class="bg-white p-2.5 rounded-lg border border-amber-200/60">
                    <span class="text-slate-400 block text-[10px] uppercase font-bold">Relationship</span>
                    <span class="font-semibold text-slate-800">${relationship}</span>
                  </div>
                ` : ''}
                ${dateOfOccasion ? `
                  <div class="bg-white p-2.5 rounded-lg border border-amber-200/60">
                    <span class="text-slate-400 block text-[10px] uppercase font-bold">Date of Occasion</span>
                    <span class="font-semibold text-slate-800">${dateOfOccasion}</span>
                  </div>
                ` : ''}
                ${coverTitle ? `
                  <div class="bg-white p-2.5 rounded-lg border border-amber-200/60">
                    <span class="text-slate-400 block text-[10px] uppercase font-bold">Cover Title Text</span>
                    <span class="font-semibold text-slate-800">${coverTitle}</span>
                  </div>
                ` : ''}
              </div>

              ${personalWishes ? `
                <div class="bg-white p-3 rounded-lg border border-amber-200/60">
                  <span class="text-slate-400 block text-[10px] uppercase font-bold mb-1">Personal Message / Wishes</span>
                  <p class="text-slate-700 italic leading-relaxed select-all">${personalWishes}</p>
                </div>
              ` : ''}

              ${customQuestions && typeof customQuestions === 'object' ? `
                <div class="bg-white p-3 rounded-lg border border-amber-200/60 space-y-1.5">
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Custom Q&A</span>
                  ${Object.entries(customQuestions).map(([q, a]) => `
                    <div class="text-xs">
                      <strong class="text-slate-700">${q}:</strong> <span class="text-slate-600">${a}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Items Ordered Section -->
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                <i class="fa-solid fa-box text-teal-600 mr-1.5"></i> Order Items (${order.items?.length || 1})
              </span>
              <span class="text-xs font-medium text-slate-500">Product: <strong>${order.productType || 'Custom'}</strong></span>
            </div>
            
            <div class="divide-y divide-slate-100">
              ${order.items && order.items.length > 0 ? order.items.map(item => `
                <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="text-sm font-bold text-slate-900">${item.templateName}</h4>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 uppercase">
                        ${item.productType}
                      </span>
                    </div>
                    <div class="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      ${item.recipientName ? `<span>Recipient: <strong class="text-slate-700">${item.recipientName}</strong></span>` : ''}
                      ${item.pageCount ? `<span>Pages: <strong class="text-slate-700">${item.pageCount}</strong></span>` : ''}
                      ${item.requiredPhotoCount ? `<span>Photos: <strong class="text-slate-700">${item.photoUrls?.length || allPhotos.length}/${item.requiredPhotoCount}</strong></span>` : ''}
                      ${item.comboQuantity > 1 ? `<span>Quantity: <strong class="text-slate-700">${item.comboQuantity}</strong></span>` : ''}
                      ${item.occasion ? `<span>Occasion: <strong class="text-slate-700">${item.occasion}</strong></span>` : ''}
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    ${item.canvaLink ? `
                      <a href="${item.canvaLink}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-xs font-bold shadow-xs hover:opacity-90 transition-opacity flex items-center gap-1.5">
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

          <!-- Customer Uploaded Photos Preview Grid & Lightbox -->
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                <i class="fa-solid fa-images text-teal-600 mr-1.5"></i> Customer Photos (${allPhotos.length})
              </span>
              ${allPhotos.length > 0 ? `
                <button id="modal-download-photos-zip-btn" class="px-3 py-1 bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs">
                  <i class="fa-solid fa-file-zipper text-xs"></i> Download ZIP
                </button>
              ` : ''}
            </div>

            <div class="p-4">
              ${allPhotos.length > 0 ? `
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-72 overflow-y-auto p-1 admin-custom-scroll">
                  ${allPhotos.map((url, idx) => `
                    <div class="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs cursor-pointer photo-thumbnail" data-img="${url}">
                      <img src="${url}" alt="Photo ${idx + 1}" class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy">
                      <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm">
                        <i class="fa-solid fa-magnifying-glass-plus"></i>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div class="text-center py-8 text-slate-400 text-xs font-medium">
                  <i class="fa-regular fa-image text-3xl mb-1 text-slate-300 block"></i>
                  No photos uploaded for this order yet.
                </div>
              `}
            </div>
          </div>

          <!-- Courier Integration (Steadfast) -->
          <div class="bg-sky-50/70 border border-sky-200 rounded-xl p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 text-xs font-bold text-sky-900 uppercase tracking-wider">
                <i class="fa-solid fa-truck-fast text-sky-600"></i> Steadfast Courier Consignment
              </div>
              ${order.trackingNumber ? `
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300 font-mono">
                  ${order.trackingNumber}
                </span>
              ` : `
                <span class="text-xs text-slate-400 italic">Not Dispatched</span>
              `}
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="text-slate-600">
                ${order.trackingNumber ? `
                  <p class="font-medium text-slate-800">Consignment Code: <strong class="font-mono text-sky-700">${order.trackingNumber}</strong></p>
                  <div id="live-steadfast-status" class="text-slate-500 mt-1 font-medium">Click "Check Status" to query live courier tracking.</div>
                ` : `
                  <p class="text-slate-600">Register consignment with Steadfast Courier with 1 click.</p>
                `}
              </div>

              <div class="flex items-center gap-2">
                ${order.trackingNumber ? `
                  <button id="modal-check-tracking-btn" class="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs">
                    <i class="fa-solid fa-rotate text-xs"></i> Check Status
                  </button>
                ` : `
                  <button id="modal-dispatch-steadfast-btn" class="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-paper-plane text-xs"></i> Dispatch to Steadfast
                  </button>
                `}
              </div>
            </div>
          </div>

          <!-- Admin Notes Section -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Admin Internal Notes
              </label>
              <button id="modal-save-note-btn" class="text-xs text-teal-700 font-bold hover:underline">
                Save Note
              </button>
            </div>
            <textarea 
              id="modal-admin-note-input" 
              rows="2" 
              placeholder="Add internal notes about this order..."
              class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-800"
            >${order.adminNote || ''}</textarea>
          </div>

        </div>

        <!-- Modal Footer Lifecycle Action Bar (Responsive Mobile & Desktop) -->
        <div class="px-3.5 sm:px-6 py-3 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
          <button id="modal-delete-order-btn" class="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200 flex items-center justify-center gap-1 order-2 sm:order-1">
            <i class="fa-solid fa-trash-can"></i> Delete Order
          </button>

          <!-- Stage Transition Action Buttons -->
          <div class="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            ${currentStatus === 'pending' ? `
              <button id="modal-approve-btn" class="flex-1 sm:flex-none justify-center px-4 py-2 bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <i class="fa-solid fa-check text-xs"></i> Mark Paid
              </button>
              <button id="modal-flag-btn" class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 whitespace-nowrap">
                <i class="fa-solid fa-flag text-xs"></i> Flag
              </button>
              <button id="modal-cancel-btn" class="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors whitespace-nowrap">
                Cancel
              </button>
            ` : (currentStatus === 'paid' || currentStatus === 'confirmed') ? `
              <button id="modal-prepare-btn" class="flex-1 sm:flex-none justify-center px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <i class="fa-solid fa-box text-xs"></i> Prepare Order
              </button>
              <button id="modal-cancel-btn" class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors whitespace-nowrap">
                Cancel
              </button>
            ` : currentStatus === 'preparing' ? `
              <button id="modal-ship-btn" class="flex-1 sm:flex-none justify-center px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <i class="fa-solid fa-truck-fast text-xs"></i> Mark as Shipped
              </button>
              <button id="modal-cancel-btn" class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors whitespace-nowrap">
                Cancel
              </button>
            ` : currentStatus === 'shipped' ? `
              <button id="modal-delivered-btn" class="flex-1 sm:flex-none justify-center px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <i class="fa-solid fa-circle-check text-xs"></i> Mark as Delivered
              </button>
            ` : currentStatus === 'cancelled' ? `
              <button id="modal-restore-btn" class="flex-1 sm:flex-none justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <i class="fa-solid fa-rotate-left text-xs"></i> Restore Order to Paid
              </button>
            ` : currentStatus === 'flagged' ? `
              <button id="modal-approve-btn" class="flex-1 sm:flex-none justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <i class="fa-solid fa-check-double text-xs"></i> Resolve & Mark Paid
              </button>
              <button id="modal-cancel-btn" class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors whitespace-nowrap">
                Cancel
              </button>
            ` : ''}
          </div>
        </div>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('order-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-order-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  // Lightbox for Photo Thumbnails
  modalContainer.querySelectorAll('.photo-thumbnail').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const url = thumb.getAttribute('data-img');
      openLightbox(url);
    });
  });

  // Download Photos ZIP
  const downloadZipBtn = document.getElementById('modal-download-photos-zip-btn');
  if (downloadZipBtn) {
    downloadZipBtn.addEventListener('click', async () => {
      downloadZipBtn.disabled = true;
      downloadZipBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Zipping...';
      try {
        await adminApi.downloadOrderPhotosZip(order, (p) => {
          downloadZipBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> ${(p * 100).toFixed(0)}%`;
        });
        adminState.showToast('success', 'Photos downloaded successfully!');
      } catch (err) {
        adminState.showToast('error', 'Download error: ' + err.message);
      } finally {
        downloadZipBtn.disabled = false;
        downloadZipBtn.innerHTML = '<i class="fa-solid fa-file-zipper text-xs"></i> Download ZIP';
      }
    });
  }

  // Save Note Button
  const saveNoteBtn = document.getElementById('modal-save-note-btn');
  if (saveNoteBtn) {
    saveNoteBtn.addEventListener('click', async () => {
      const note = document.getElementById('modal-admin-note-input').value.trim();
      try {
        await adminApi.updateOrderStatus(order.orderId, order.status, note);
        adminState.showToast('success', 'Admin note saved!');
      } catch (err) {
        adminState.showToast('error', 'Failed to save note: ' + err.message);
      }
    });
  }

  // Steadfast Consignment Dispatch
  const dispatchBtn = document.getElementById('modal-dispatch-steadfast-btn');
  if (dispatchBtn) {
    dispatchBtn.addEventListener('click', async () => {
      if (!order.shippingAddress || !order.customerPhone) {
        adminState.showToast('error', 'Missing customer phone or delivery address!');
        return;
      }
      if (!confirm(`Dispatch Order #${order.orderId} to Steadfast Courier? COD: ৳${order.status === 'paid' ? 0 : order.expectedAmount}`)) return;

      dispatchBtn.disabled = true;
      try {
        const res = await createSteadfastOrder({
          invoice: order.orderId,
          recipient_name: order.customerName,
          recipient_phone: order.customerPhone,
          recipient_address: order.shippingAddress,
          cod_amount: (order.status === 'paid' || order.status === 'confirmed') ? 0 : order.expectedAmount,
          item_description: order.templateName || order.productType || 'Custom Prints',
          note: order.deliveryNote || ''
        });

        if (res.success && res.tracking_code) {
          await adminApi.updateOrderStatus(order.orderId, order.status, 'Dispatched to Steadfast', {
            trackingNumber: res.tracking_code,
            consignment_id: res.consignment_id,
            courierName: 'Steadfast Courier',
            steadfast_consignment: res.consignment
          });
          adminState.showToast('success', `Steadfast Consignment created! Tracking: ${res.tracking_code}`);
          closeModal();
        } else {
          adminState.showToast('error', res.message || 'Dispatch failed');
        }
      } catch (err) {
        adminState.showToast('error', 'Steadfast error: ' + err.message);
      } finally {
        dispatchBtn.disabled = false;
      }
    });
  }

  // Steadfast Live Tracking Status Check
  const checkTrackBtn = document.getElementById('modal-check-tracking-btn');
  if (checkTrackBtn) {
    checkTrackBtn.addEventListener('click', async () => {
      checkTrackBtn.disabled = true;
      const statusDiv = document.getElementById('live-steadfast-status');
      statusDiv.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Checking tracking status...';
      try {
        const res = await checkSteadfastStatusByTrackingCode(order.trackingNumber);
        if (res.status === 200 && res.delivery_status) {
          statusDiv.innerHTML = `Courier Status: <strong class="text-sky-700 font-bold uppercase">${res.delivery_status}</strong>`;
          adminState.showToast('info', `Steadfast Status: ${res.delivery_status}`);
        } else {
          statusDiv.innerHTML = `Response: ${res.message || 'No status updates'}`;
        }
      } catch (err) {
        statusDiv.innerHTML = `<span class="text-rose-500">Error: ${err.message}</span>`;
      } finally {
        checkTrackBtn.disabled = false;
      }
    });
  }

  // Lifecycle Buttons Wiring
  const prepareBtn = document.getElementById('modal-prepare-btn');
  if (prepareBtn) {
    prepareBtn.addEventListener('click', async () => {
      try {
        await adminApi.updateOrderStatus(order.orderId, 'preparing', 'Order marked as Preparing!');
        adminState.showToast('success', `Order #${order.orderId} marked as Preparing!`);
        closeModal();
      } catch (err) {
        adminState.showToast('error', err.message);
      }
    });
  }

  const shipBtn = document.getElementById('modal-ship-btn');
  if (shipBtn) {
    shipBtn.addEventListener('click', async () => {
      const tracking = prompt('Enter Tracking Code (leave blank to auto-book Steadfast):', order.trackingNumber || '');
      if (tracking === null) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'shipped', 'Order marked as Shipped', {
          courierName: 'Steadfast Courier',
          trackingNumber: tracking.trim()
        });
        adminState.showToast('success', `Order #${order.orderId} marked as Shipped!`);
        closeModal();
      } catch (err) {
        adminState.showToast('error', err.message);
      }
    });
  }

  const deliveredBtn = document.getElementById('modal-delivered-btn');
  if (deliveredBtn) {
    deliveredBtn.addEventListener('click', async () => {
      if (!confirm(`Mark Order #${order.orderId} as Delivered & Completed?`)) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'completed', 'Delivered successfully');
        adminState.showToast('success', `Order #${order.orderId} completed successfully!`);
        closeModal();
      } catch (err) {
        adminState.showToast('error', err.message);
      }
    });
  }

  const approveBtn = document.getElementById('modal-approve-btn');
  if (approveBtn) {
    approveBtn.addEventListener('click', async () => {
      const note = prompt('Admin approval note:', 'Manually verified & approved by admin');
      if (note === null) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'paid', note);
        adminState.showToast('success', `Order #${order.orderId} approved as Paid!`);
        closeModal();
      } catch (err) {
        adminState.showToast('error', err.message);
      }
    });
  }

  const flagBtn = document.getElementById('modal-flag-btn');
  if (flagBtn) {
    flagBtn.addEventListener('click', async () => {
      const reason = prompt('Reason for flagging order:', 'Payment verification mismatch');
      if (!reason) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'flagged', '', { flagReason: reason });
        adminState.showToast('warning', `Order #${order.orderId} moved to Flagged`);
        closeModal();
      } catch (err) {
        adminState.showToast('error', err.message);
      }
    });
  }

  const restoreBtn = document.getElementById('modal-restore-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', async () => {
      if (!confirm(`Restore Order #${order.orderId} to Paid Orders?`)) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'paid', 'Restored from cancelled orders by admin');
        adminState.showToast('success', `Order #${order.orderId} restored to Paid!`);
        closeModal();
      } catch (err) {
        adminState.showToast('error', err.message);
      }
    });
  }

  const cancelBtn = document.getElementById('modal-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      const reason = prompt('Reason for cancellation:', 'Cancelled by customer / admin request');
      if (reason === null) return;
      try {
        await adminApi.updateOrderStatus(order.orderId, 'cancelled', reason);
        adminState.showToast('success', `Order #${order.orderId} cancelled`);
        closeModal();
      } catch (err) {
        adminState.showToast('error', err.message);
      }
    });
  }

  const deleteBtn = document.getElementById('modal-delete-order-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Are you SURE you want to PERMANENTLY delete Order #${order.orderId}? This cannot be undone.`)) return;
      try {
        await adminApi.deleteOrder(order.orderId);
        adminState.showToast('info', `Order #${order.orderId} deleted permanently.`);
        closeModal();
      } catch (err) {
        adminState.showToast('error', err.message);
      }
    });
  }
}

/**
 * Lightbox modal for high-res photo viewing
 */
function openLightbox(imageUrl) {
  const lightbox = document.createElement('div');
  lightbox.className = 'fixed inset-0 bg-slate-950/85 z-[70] flex items-center justify-center p-4 cursor-pointer';
  lightbox.innerHTML = `
    <div class="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
      <img src="${imageUrl}" alt="Full Photo Preview" class="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl">
      <div class="mt-3 flex items-center gap-3">
        <a href="${imageUrl}" target="_blank" download class="px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold backdrop-blur-sm transition-colors flex items-center gap-1.5" onclick="event.stopPropagation()">
          <i class="fa-solid fa-download text-xs"></i> Download Photo
        </a>
        <button class="px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold backdrop-blur-sm transition-colors">
          Close (Esc)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(lightbox);
  lightbox.addEventListener('click', () => lightbox.remove());
}
