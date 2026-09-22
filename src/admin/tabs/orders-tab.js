import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';
import { openOrderDetailModal } from '../dialogs/order-detail-modal.js';
import { createSteadfastOrder } from '../../services/steadfast-service.js';

export function renderOrdersTab(container, statusKey) {
  let ordersList = [];
  let selectedOrderIds = new Set();
  let searchQuery = '';

  const statusConfig = {
    pending: { title: 'Pending Orders', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-500' },
    paid: { title: 'Paid Orders', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-500' },
    flagged: { title: 'Flagged Orders', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-500' },
    unmatched: { title: 'Unmatched Payments', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-500' },
    completed: { title: 'Completed Orders', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-500' },
    cancelled: { title: 'Cancelled Orders', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-500' },
  };

  const config = statusConfig[statusKey] || { title: 'Orders', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-teal-500' };

  container.innerHTML = `
    <div class="flex flex-col h-full">
      
      <!-- Top Filter & Search Bar -->
      <div class="p-4 sm:p-5 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="relative w-64 sm:w-80">
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
              type="text" 
              id="orders-search-input" 
              placeholder="Search by ID, name, phone, trxID..." 
              class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white transition-all placeholder:text-slate-400"
            >
          </div>
          <button id="orders-refresh-btn" class="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50/50 flex items-center justify-center transition-all" title="Refresh Orders">
            <i class="fa-solid fa-rotate text-xs"></i>
          </button>
        </div>

        <!-- Bulk Action Toolbar (When orders are selected) -->
        <div id="bulk-actions-toolbar" class="hidden flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-600 mr-1"><strong id="selected-count-label" class="text-teal-700">0</strong> selected</span>
          ${statusKey === 'pending' ? `
            <button id="bulk-approve-btn" class="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
              <i class="fa-solid fa-check-double text-xs"></i> Bulk Approve
            </button>
          ` : ''}
          <button id="bulk-clear-btn" class="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors">
            Clear
          </button>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-500">Total in queue:</span>
          <span id="queue-total-badge" class="px-2.5 py-0.5 rounded-full text-xs font-bold ${config.bg} ${config.color} border border-slate-200">
            0
          </span>
        </div>
      </div>

      <!-- Orders List Container -->
      <div id="orders-list-content" class="flex-1 overflow-y-auto p-4 sm:p-5 admin-custom-scroll bg-[#F8FAFC]">
        <div class="flex items-center justify-center py-16 text-slate-400 text-xs">
          <i class="fa-solid fa-spinner animate-spin text-lg mr-2 text-teal-600"></i> Loading orders...
        </div>
      </div>

    </div>
  `;

  const searchInput = container.querySelector('#orders-search-input');
  const refreshBtn = container.querySelector('#orders-refresh-btn');
  const listContainer = container.querySelector('#orders-list-content');
  const queueTotalBadge = container.querySelector('#queue-total-badge');
  const bulkToolbar = container.querySelector('#bulk-actions-toolbar');
  const selectedCountLabel = container.querySelector('#selected-count-label');
  const bulkApproveBtn = container.querySelector('#bulk-approve-btn');
  const bulkClearBtn = container.querySelector('#bulk-clear-btn');

  const updateBulkToolbar = () => {
    if (selectedOrderIds.size > 0) {
      bulkToolbar.classList.remove('hidden');
      selectedCountLabel.textContent = selectedOrderIds.size;
    } else {
      bulkToolbar.classList.add('hidden');
    }
  };

  const renderCards = () => {
    let filtered = ordersList;
    if (searchQuery) {
      filtered = ordersList.filter(o => 
        (o.orderId && o.orderId.toLowerCase().includes(searchQuery)) ||
        (o.customerName && o.customerName.toLowerCase().includes(searchQuery)) ||
        (o.customerPhone && o.customerPhone.includes(searchQuery)) ||
        (o.trxId && o.trxId.toLowerCase().includes(searchQuery)) ||
        (o.shippingAddress && o.shippingAddress.toLowerCase().includes(searchQuery))
      );
    }

    queueTotalBadge.textContent = filtered.length;

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 text-2xl mb-3">
            <i class="fa-solid fa-inbox"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-700 mb-1">No Orders Found</h4>
          <p class="text-xs text-slate-400 max-w-xs">There are no orders matching your current queue criteria or search filter.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = `
      <div class="grid grid-cols-1 gap-3.5">
        ${filtered.map(order => {
          const isChecked = selectedOrderIds.has(order.orderId);
          const dateFormatted = order.createdAt ? new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }).format(order.createdAt) : '';

          const photoPreviews = [...order.photoUrls];
          order.items.forEach(it => {
            if (it.coverPhotoUrl && !photoPreviews.includes(it.coverPhotoUrl)) photoPreviews.push(it.coverPhotoUrl);
            (it.photoUrls || []).forEach(p => { if (!photoPreviews.includes(p)) photoPreviews.push(p); });
          });

          return `
            <div class="bg-white border border-slate-200/90 hover:border-teal-500/50 rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-200 relative group flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <!-- Checkbox & Main Info -->
              <div class="flex items-start gap-3.5 flex-1 min-w-0">
                <input 
                  type="checkbox" 
                  data-order-id="${order.orderId}" 
                  class="order-checkbox mt-1 w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  ${isChecked ? 'checked' : ''}
                >

                <div class="space-y-1.5 min-w-0 flex-1">
                  <!-- Row 1: Order ID, Date, Product Badge, TrxID -->
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-bold text-slate-900 font-mono tracking-wide">
                      #${order.orderId}
                    </span>
                    <span class="text-[11px] text-slate-400 font-medium">
                      • ${dateFormatted}
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 uppercase tracking-wider">
                      ${order.productType || 'Prints'}
                    </span>
                    ${order.trxId ? `
                      <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono font-medium flex items-center gap-1">
                        <i class="fa-solid fa-receipt text-[9px] text-slate-400"></i> ${order.trxId}
                      </span>
                    ` : ''}
                    ${order.trackingNumber ? `
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                        <i class="fa-solid fa-truck-fast text-[9px]"></i> ${order.trackingNumber}
                      </span>
                    ` : ''}
                  </div>

                  <!-- Row 2: Customer Name, Phone, Address -->
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span class="font-bold text-slate-800">${order.customerName}</span>
                    <a href="tel:${order.customerPhone}" class="text-teal-700 font-semibold hover:underline flex items-center gap-1">
                      <i class="fa-solid fa-phone text-[10px]"></i> ${order.customerPhone}
                    </a>
                    ${order.shippingAddress ? `
                      <span class="text-slate-500 truncate max-w-sm" title="${order.shippingAddress}">
                        <i class="fa-solid fa-location-dot text-[10px] text-slate-400 mr-0.5"></i> ${order.shippingAddress}
                      </span>
                    ` : ''}
                  </div>

                  <!-- Row 3: Flag reason or Admin Note if present -->
                  ${order.flagReason ? `
                    <div class="text-[11px] text-rose-700 font-medium bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-200/60 inline-flex items-center gap-1.5">
                      <i class="fa-solid fa-triangle-exclamation"></i>
                      <span><strong>Flagged:</strong> ${order.flagReason}</span>
                    </div>
                  ` : ''}
                  ${order.adminNote ? `
                    <div class="text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 inline-block">
                      <strong>Note:</strong> ${order.adminNote}
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Middle: Photos Preview Pill -->
              ${photoPreviews.length > 0 ? `
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <div class="flex -space-x-2 overflow-hidden py-1">
                    ${photoPreviews.slice(0, 3).map((url, i) => `
                      <img class="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover shadow-xs" src="${url}" alt="Preview ${i + 1}" loading="lazy">
                    `).join('')}
                  </div>
                  <span class="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    ${photoPreviews.length} ${photoPreviews.length === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
              ` : ''}

              <!-- Right: Pricing & Actions -->
              <div class="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div class="text-right">
                  <div class="text-sm font-bold text-slate-900">৳${order.expectedAmount}</div>
                  <div class="text-[10px] text-slate-400 font-medium">${order.paymentMethod}</div>
                </div>

                <div class="flex items-center gap-1.5">
                  ${statusKey === 'pending' ? `
                    <button 
                      data-action="approve" 
                      data-order-id="${order.orderId}" 
                      class="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D9488] active:bg-[#115E59] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1"
                      title="Approve Order"
                    >
                      <i class="fa-solid fa-check text-[11px]"></i> Approve
                    </button>
                    <button 
                      data-action="flag" 
                      data-order-id="${order.orderId}" 
                      class="w-8 h-8 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                      title="Flag Order"
                    >
                      <i class="fa-solid fa-flag text-xs"></i>
                    </button>
                  ` : statusKey === 'paid' ? `
                    ${!order.trackingNumber ? `
                      <button 
                        data-action="dispatch-steadfast" 
                        data-order-id="${order.orderId}" 
                        class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1"
                        title="Dispatch to Steadfast Courier"
                      >
                        <i class="fa-solid fa-truck-fast text-[11px]"></i> Dispatch
                      </button>
                    ` : ''}
                    <button 
                      data-action="complete" 
                      data-order-id="${order.orderId}" 
                      class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1"
                      title="Mark Completed"
                    >
                      <i class="fa-solid fa-square-check text-[11px]"></i> Complete
                    </button>
                  ` : statusKey === 'flagged' ? `
                    <button 
                      data-action="approve" 
                      data-order-id="${order.orderId}" 
                      class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1"
                      title="Resolve & Approve"
                    >
                      <i class="fa-solid fa-check-double text-[11px]"></i> Resolve
                    </button>
                  ` : ''}

                  <!-- View Details Button (Always Present) -->
                  <button 
                    data-action="details" 
                    data-order-id="${order.orderId}" 
                    class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  >
                    Details <i class="fa-solid fa-chevron-right text-[10px]"></i>
                  </button>
                </div>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    // Wire Card Events
    listContainer.querySelectorAll('.order-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-order-id');
        if (e.target.checked) selectedOrderIds.add(id);
        else selectedOrderIds.delete(id);
        updateBulkToolbar();
      });
    });

    listContainer.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const orderId = btn.getAttribute('data-order-id');
        const order = ordersList.find(o => o.orderId === orderId);
        if (!order) return;

        if (action === 'details') {
          openOrderDetailModal(order, () => {});
        } else if (action === 'approve') {
          if (!confirm(`Approve Order #${order.orderId}?`)) return;
          try {
            await adminApi.updateOrderStatus(order.orderId, 'paid', 'Quick approved from queue');
            adminState.showToast('success', `Order #${order.orderId} approved!`);
          } catch (err) {
            adminState.showToast('error', 'Approval failed: ' + err.message);
          }
        } else if (action === 'flag') {
          const reason = prompt('Enter flag reason:', 'Payment mismatch or invalid TrxID');
          if (!reason) return;
          try {
            await adminApi.updateOrderStatus(order.orderId, 'flagged', '', { flagReason: reason });
            adminState.showToast('warning', `Order #${order.orderId} flagged`);
          } catch (err) {
            adminState.showToast('error', 'Flag failed: ' + err.message);
          }
        } else if (action === 'complete') {
          if (!confirm(`Mark Order #${order.orderId} as completed?`)) return;
          try {
            await adminApi.updateOrderStatus(order.orderId, 'completed');
            adminState.showToast('success', `Order #${order.orderId} marked completed`);
          } catch (err) {
            adminState.showToast('error', 'Update failed: ' + err.message);
          }
        } else if (action === 'dispatch-steadfast') {
          if (!order.shippingAddress || !order.customerPhone) {
            adminState.showToast('error', 'Missing customer phone or delivery address!');
            return;
          }
          if (!confirm(`Dispatch Order #${order.orderId} to Steadfast? COD: ৳${order.status === 'paid' ? 0 : order.expectedAmount}`)) return;
          
          btn.disabled = true;
          try {
            const res = await createSteadfastOrder({
              invoice: order.orderId,
              recipient_name: order.customerName,
              recipient_phone: order.customerPhone,
              recipient_address: order.shippingAddress,
              cod_amount: order.status === 'paid' ? 0 : order.expectedAmount,
              item_description: order.templateName || order.productType || 'Custom Prints',
              note: order.deliveryNote || 'পার্সেল ডেলিভারির সময় রিসিভ করার অনুমতি দিন।'
            });

            if (res.success && res.tracking_code) {
              await adminApi.updateOrderStatus(order.orderId, order.status, 'Dispatched to Steadfast', {
                trackingNumber: res.tracking_code,
                consignment_id: res.consignment_id,
                courierName: 'Steadfast Courier',
                steadfast_consignment: res.consignment
              });
              adminState.showToast('success', `Consignment created! Tracking: ${res.tracking_code}`);
            } else {
              adminState.showToast('error', res.message || 'Dispatch failed');
            }
          } catch (err) {
            adminState.showToast('error', 'Steadfast error: ' + err.message);
          } finally {
            btn.disabled = false;
          }
        }
      });
    });
  };

  // Search input handler
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderCards();
  });

  // Bulk Actions
  if (bulkApproveBtn) {
    bulkApproveBtn.addEventListener('click', async () => {
      if (selectedOrderIds.size === 0) return;
      if (!confirm(`Bulk approve ${selectedOrderIds.size} selected orders?`)) return;

      bulkApproveBtn.disabled = true;
      let count = 0;
      for (const id of selectedOrderIds) {
        try {
          await adminApi.updateOrderStatus(id, 'paid', 'Bulk approved by admin');
          count++;
        } catch (e) {
          console.warn('Failed to approve order ' + id, e);
        }
      }
      adminState.showToast('success', `Successfully approved ${count} orders!`);
      selectedOrderIds.clear();
      updateBulkToolbar();
      bulkApproveBtn.disabled = false;
    });
  }

  if (bulkClearBtn) {
    bulkClearBtn.addEventListener('click', () => {
      selectedOrderIds.clear();
      updateBulkToolbar();
      renderCards();
    });
  }

  // Subscribe to real-time orders for this status
  const unsubscribe = adminApi.watchOrders(
    statusKey,
    orders => {
      ordersList = orders;
      renderCards();
    },
    err => {
      listContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <i class="fa-solid fa-circle-exclamation mr-1.5"></i> Error loading ${statusKey} orders: ${err.message}
        </div>
      `;
    }
  );

  adminState.addSubscription(unsubscribe);

  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('animate-spin');
    setTimeout(() => {
      refreshBtn.classList.remove('animate-spin');
      renderCards();
      adminState.showToast('info', 'Queue refreshed');
    }, 400);
  });
}
