import { getSteadfastBalance, checkSteadfastStatusByTrackingCode, checkSteadfastStatusByInvoice, createSteadfastOrder } from '../../services/steadfast-service.js';
import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

export function renderSteadfastTab(container) {
  let activeSubTab = 'search'; // 'search' | 'bulk' | 'dispatched'
  let ordersList = [];
  let selectedBulkOrderIds = new Set();

  container.innerHTML = `
    <div class="flex flex-col h-full overflow-y-auto admin-custom-scroll bg-[#F8FAFC] p-5 space-y-5">
      
      <!-- Steadfast Hero Card -->
      <div class="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F766E] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <!-- Glow Orbs -->
        <div class="absolute -top-16 -right-16 w-52 h-52 bg-teal-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-16 -left-16 w-52 h-52 bg-sky-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-xs font-bold uppercase tracking-widest text-teal-300">Steadfast Courier API Hub</span>
            </div>
            <div class="text-3xl sm:text-4xl font-extrabold tracking-tight" id="steadfast-balance-display">
              ৳0.00
            </div>
            <p class="text-xs text-slate-300 font-medium mt-1">Current Available Merchant Account Balance</p>
          </div>

          <div class="flex items-center gap-3">
            <button id="refresh-balance-btn" class="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
              <i class="fa-solid fa-rotate text-xs" id="refresh-balance-icon"></i>
              <span>Refresh Balance</span>
            </button>
            <a href="https://portal.packzy.com" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-900/30 transition-all flex items-center gap-2">
              <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
              <span>Open Merchant Portal</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Navigation Segment -->
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <div class="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
          <button data-sub="search" class="sf-subtab-btn px-4 py-2 rounded-lg text-xs font-bold transition-all bg-white text-sky-800 shadow-xs">
            <i class="fa-solid fa-magnifying-glass mr-1.5"></i> Consignment Search
          </button>
          <button data-sub="bulk" class="sf-subtab-btn px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900">
            <i class="fa-solid fa-boxes-packing mr-1.5"></i> Bulk Dispatch
          </button>
          <button data-sub="dispatched" class="sf-subtab-btn px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900">
            <i class="fa-solid fa-truck-fast mr-1.5"></i> Dispatched Parcels
          </button>
        </div>
      </div>

      <!-- Subtab 1: Consignment Search Sandbox -->
      <div id="sf-search-panel" class="space-y-4">
        <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h4 class="text-sm font-bold text-slate-900 mb-1">Consignment Search Sandbox</h4>
          <p class="text-xs text-slate-500 mb-4">Query live Steadfast server by Consignment Tracking Code or Invoice ID</p>

          <form id="sf-search-form" class="flex flex-col sm:flex-row gap-3">
            <div class="relative flex-1">
              <i class="fa-solid fa-barcode absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input 
                type="text" 
                id="sf-query-input" 
                required
                placeholder="e.g. 19B1A4 or INV-1001" 
                class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-600 focus:bg-white"
              >
            </div>
            <select id="sf-query-type" class="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none">
              <option value="tracking">Search by Tracking Code</option>
              <option value="invoice">Search by Invoice ID</option>
            </select>
            <button type="submit" id="sf-search-submit" class="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              <i class="fa-solid fa-magnifying-glass"></i> Search
            </button>
          </form>
        </div>

        <div id="sf-search-result-container"></div>
      </div>

      <!-- Subtab 2: Bulk Dispatch -->
      <div id="sf-bulk-panel" class="hidden space-y-4">
        <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-bold text-slate-900">Bulk Consignment Dispatch</h4>
              <p class="text-xs text-slate-500">Dispatch multiple ready orders to Steadfast Courier in 1 single batch</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-slate-600">Selected: <strong id="bulk-sf-count" class="text-sky-700">0</strong></span>
              <button id="dispatch-selected-sf-btn" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5" disabled>
                <i class="fa-solid fa-paper-plane text-xs"></i> Dispatch Selected to Steadfast
              </button>
            </div>
          </div>
        </div>

        <div id="sf-bulk-orders-list" class="space-y-3"></div>
      </div>

      <!-- Subtab 3: Dispatched Parcels -->
      <div id="sf-dispatched-panel" class="hidden space-y-4">
        <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h4 class="text-sm font-bold text-slate-900 mb-1">Dispatched Orders with Tracking Codes</h4>
          <p class="text-xs text-slate-500">Live parcels actively being processed or delivered by Steadfast Courier</p>
        </div>

        <div id="sf-dispatched-orders-list" class="space-y-3"></div>
      </div>

    </div>
  `;

  // Elements
  const balanceDisplay = container.querySelector('#steadfast-balance-display');
  const refreshBalanceBtn = container.querySelector('#refresh-balance-btn');
  const refreshBalanceIcon = container.querySelector('#refresh-balance-icon');

  const subTabBtns = container.querySelectorAll('.sf-subtab-btn');
  const searchPanel = container.querySelector('#sf-search-panel');
  const bulkPanel = container.querySelector('#sf-bulk-panel');
  const dispatchedPanel = container.querySelector('#sf-dispatched-panel');

  const searchForm = container.querySelector('#sf-search-form');
  const queryInput = container.querySelector('#sf-query-input');
  const queryType = container.querySelector('#sf-query-type');
  const searchResultContainer = container.querySelector('#sf-search-result-container');

  const bulkCountDisplay = container.querySelector('#bulk-sf-count');
  const dispatchSelectedBtn = container.querySelector('#dispatch-selected-sf-btn');
  const bulkOrdersList = container.querySelector('#sf-bulk-orders-list');
  const dispatchedOrdersList = container.querySelector('#sf-dispatched-orders-list');

  // Load Balance function
  const fetchBalance = async () => {
    refreshBalanceIcon.classList.add('animate-spin');
    try {
      const res = await getSteadfastBalance();
      if (res && res.current_balance !== undefined) {
        balanceDisplay.textContent = `৳${Number(res.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      } else {
        balanceDisplay.textContent = '৳0.00';
      }
    } catch (err) {
      console.warn('Failed to fetch Steadfast balance:', err);
    } finally {
      refreshBalanceIcon.classList.remove('animate-spin');
    }
  };

  refreshBalanceBtn.addEventListener('click', fetchBalance);
  fetchBalance();

  // Switch Subtabs
  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.getAttribute('data-sub');
      subTabBtns.forEach(b => {
        const isCurrent = b.getAttribute('data-sub') === activeSubTab;
        b.className = `sf-subtab-btn px-4 py-2 rounded-lg text-xs font-bold transition-all ${isCurrent ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`;
      });

      searchPanel.classList.toggle('hidden', activeSubTab !== 'search');
      bulkPanel.classList.toggle('hidden', activeSubTab !== 'bulk');
      dispatchedPanel.classList.toggle('hidden', activeSubTab !== 'dispatched');

      if (activeSubTab === 'bulk') renderBulkOrders();
      if (activeSubTab === 'dispatched') renderDispatchedOrders();
    });
  });

  // Consignment Search
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput.value.trim();
    const type = queryType.value;
    const submitBtn = container.querySelector('#sf-search-submit');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Searching...';
    searchResultContainer.innerHTML = '';

    try {
      const res = type === 'tracking' 
        ? await checkSteadfastStatusByTrackingCode(query)
        : await checkSteadfastStatusByInvoice(query);

      if (res && res.status === 200 && res.delivery_status) {
        searchResultContainer.innerHTML = `
          <div class="bg-white border border-sky-200 rounded-2xl p-6 shadow-sm">
            <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-sky-500"></span>
                <span class="text-sm font-bold text-slate-900">Consignment Found</span>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 uppercase tracking-wider">
                ${res.delivery_status}
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span class="text-slate-400 block font-medium">Tracking Code</span>
                <span class="text-slate-900 font-bold font-mono text-sm">${query}</span>
              </div>
              <div>
                <span class="text-slate-400 block font-medium">Delivery Status</span>
                <span class="text-sky-700 font-bold capitalize">${res.delivery_status}</span>
              </div>
              <div>
                <span class="text-slate-400 block font-medium">COD Amount</span>
                <span class="text-slate-900 font-bold">৳${res.cod_amount ?? 'N/A'}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        searchResultContainer.innerHTML = `
          <div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
            <i class="fa-solid fa-circle-info text-2xl text-slate-300 mb-2 block"></i>
            No consignment record found for "<strong>${query}</strong>" in Steadfast Courier server.
          </div>
        `;
      }
    } catch (err) {
      searchResultContainer.innerHTML = `
        <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          <i class="fa-solid fa-triangle-exclamation mr-1"></i> ${err.message}
        </div>
      `;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Search';
    }
  });

  // Render Bulk Ready Orders
  const renderBulkOrders = () => {
    const readyOrders = ordersList.filter(o => !o.trackingNumber && (o.status === 'paid' || o.status === 'pending') && o.shippingAddress);

    if (readyOrders.length === 0) {
      bulkOrdersList.innerHTML = `
        <div class="p-12 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-400">
          <i class="fa-solid fa-circle-check text-3xl text-emerald-400 mb-2 block"></i>
          All eligible orders are already dispatched to Steadfast!
        </div>
      `;
      return;
    }

    bulkOrdersList.innerHTML = readyOrders.map(order => {
      const isChecked = selectedBulkOrderIds.has(order.orderId);
      const codAmt = order.status === 'paid' ? 0 : order.expectedAmount;

      return `
        <div class="bg-white border border-slate-200/90 rounded-xl p-4 flex items-center justify-between gap-4 shadow-xs">
          <div class="flex items-center gap-3">
            <input 
              type="checkbox" 
              data-sf-order-id="${order.orderId}" 
              class="sf-bulk-checkbox w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              ${isChecked ? 'checked' : ''}
            >
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-slate-900 font-mono">#${order.orderId}</span>
                <span class="text-xs font-semibold text-slate-700">${order.customerName}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${order.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}">
                  ${order.status}
                </span>
              </div>
              <p class="text-xs text-slate-500 truncate max-w-md mt-0.5">${order.shippingAddress} • ${order.customerPhone}</p>
            </div>
          </div>

          <div class="text-right">
            <div class="text-xs font-bold text-slate-900">COD: ৳${codAmt}</div>
            <div class="text-[10px] text-slate-400">Parcel: ${order.productType}</div>
          </div>
        </div>
      `;
    }).join('');

    bulkOrdersList.querySelectorAll('.sf-bulk-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-sf-order-id');
        if (e.target.checked) selectedBulkOrderIds.add(id);
        else selectedBulkOrderIds.delete(id);

        bulkCountDisplay.textContent = selectedBulkOrderIds.size;
        dispatchSelectedBtn.disabled = selectedBulkOrderIds.size === 0;
      });
    });
  };

  // Bulk Dispatch Handler
  dispatchSelectedBtn.addEventListener('click', async () => {
    if (selectedBulkOrderIds.size === 0) return;
    if (!confirm(`Dispatch ${selectedBulkOrderIds.size} orders to Steadfast Courier?`)) return;

    dispatchSelectedBtn.disabled = true;
    dispatchSelectedBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Dispatching Batch...';

    let successCount = 0;
    for (const orderId of selectedBulkOrderIds) {
      const order = ordersList.find(o => o.orderId === orderId);
      if (!order) continue;

      try {
        const codAmount = order.status === 'paid' ? 0 : order.expectedAmount;
        const res = await createSteadfastOrder({
          invoice: order.orderId,
          recipient_name: order.customerName,
          recipient_phone: order.customerPhone,
          recipient_address: order.shippingAddress,
          cod_amount: codAmount,
          item_description: order.templateName || order.productType || 'Custom Prints'
        });

        if (res.success && res.tracking_code) {
          await adminApi.updateOrderStatus(order.orderId, order.status, 'Bulk Dispatched to Steadfast', {
            trackingNumber: res.tracking_code,
            consignment_id: res.consignment_id,
            courierName: 'Steadfast Courier',
            steadfast_consignment: res.consignment
          });
          successCount++;
        }
      } catch (err) {
        console.warn('Dispatch failed for ' + orderId, err);
      }
    }

    adminState.showToast('success', `Successfully dispatched ${successCount} orders to Steadfast Courier!`);
    selectedBulkOrderIds.clear();
    bulkCountDisplay.textContent = '0';
    renderBulkOrders();
    fetchBalance();
  });

  // Render Dispatched Orders
  const renderDispatchedOrders = () => {
    const dispatched = ordersList.filter(o => o.trackingNumber);

    if (dispatched.length === 0) {
      dispatchedOrdersList.innerHTML = `
        <div class="p-12 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-400">
          <i class="fa-solid fa-truck text-3xl text-slate-300 mb-2 block"></i>
          No dispatched parcels found yet.
        </div>
      `;
      return;
    }

    dispatchedOrdersList.innerHTML = dispatched.map(order => `
      <div class="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 font-mono">
              ${order.trackingNumber}
            </span>
            <span class="text-xs font-bold text-slate-900">#${order.orderId}</span>
            <span class="text-xs text-slate-600">${order.customerName}</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">${order.shippingAddress} • ${order.customerPhone}</p>
        </div>

        <div class="flex items-center gap-2">
          <button 
            data-action="track" 
            data-tracking="${order.trackingNumber}" 
            class="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
          >
            <i class="fa-solid fa-rotate text-xs"></i> Check Live Status
          </button>
        </div>
      </div>
    `).join('');

    dispatchedOrdersList.querySelectorAll('button[data-action="track"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.getAttribute('data-tracking');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Checking...';
        try {
          const res = await checkSteadfastStatusByTrackingCode(code);
          adminState.showToast('info', `Steadfast Status: ${(res.delivery_status || res.status || 'Received').toUpperCase()}`);
        } catch (err) {
          adminState.showToast('error', 'Courier query error: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-rotate text-xs"></i> Check Live Status';
        }
      });
    });
  };

  // Watch all orders to power bulk & dispatched subtabs
  const unsub = adminApi.watchOrders('all', list => {
    ordersList = list;
    if (activeSubTab === 'bulk') renderBulkOrders();
    if (activeSubTab === 'dispatched') renderDispatchedOrders();
  });
  adminState.addSubscription(unsub);
}
