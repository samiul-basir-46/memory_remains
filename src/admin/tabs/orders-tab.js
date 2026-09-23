import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';
import { openOrderDetailModal } from '../dialogs/order-detail-modal.js';
import { createSteadfastOrder } from '../../services/steadfast-service.js';
import { 
  formatOrderCopySummary, 
  generateAllUrgentSummary, 
  orderHasProduct 
} from '../summary-helper.js';

export function renderOrdersTab(container, statusKey) {
  let ordersList = [];
  let selectedOrderIds = new Set();
  let searchQuery = '';
  let paidStageFilter = 'all'; // 'all' | 'confirmed' | 'preparing' | 'shipped' | 'delivered'
  let productFilter = 'all'; // 'all' | 'magazine' | 'polaroid' | 'frame' | 'mini_mag'
  let urgencyFilter = 'all'; // 'all' | 'urgent' | 'overdue' | 'standard'

  const statusConfig = {
    pending: { title: 'Pending Orders', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-500' },
    paid: { title: 'Paid Orders', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-500' },
    flagged: { title: 'Flagged Orders', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-500' },
    completed: { title: 'Completed Orders', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-500' },
    cancelled: { title: 'Cancelled Orders', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-500' },
  };

  const config = statusConfig[statusKey] || { title: 'Orders', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-teal-500' };

  container.innerHTML = `
    <div class="relative w-full h-full overflow-hidden flex flex-col">
      <!-- Scrollable Container: Whole page scrolls up smoothly, freeing maximum space for orders -->
      <div id="orders-scroll-container" class="w-full h-full overflow-y-auto admin-custom-scroll flex flex-col bg-[#F8FAFC]">
        
        <!-- Top Filter & Search Bar (Responsive Mobile & Desktop) -->
        <div class="p-3 sm:p-4 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <div class="relative flex-1 sm:w-64">
              <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input 
                type="text" 
                id="orders-search-input" 
                placeholder="Search by ID, name, phone, trxID..." 
                class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white transition-all placeholder:text-slate-400"
              >
            </div>
            <button id="orders-refresh-btn" class="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50/50 flex items-center justify-center transition-all flex-shrink-0" title="Refresh Orders">
              <i class="fa-solid fa-rotate text-xs"></i>
            </button>

            <!-- ⚡ Copy All Urgent Orders Summary Button (One-Click) -->
            <button id="copy-urgent-summary-btn" class="px-3 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95" title="Copy all urgent orders in production summary format">
              <i class="fa-solid fa-bolt text-amber-300 text-xs"></i>
              <span>Copy Urgent (<strong id="urgent-badge-count">0</strong>)</span>
            </button>

            <button id="preview-urgent-modal-btn" class="w-9 h-9 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center transition-all flex-shrink-0 shadow-2xs" title="Preview all urgent orders summary text">
              <i class="fa-regular fa-eye text-xs"></i>
            </button>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            <!-- Pending Tab Quick Action: Auto-Approve All -->
            ${statusKey === 'pending' ? `
              <button id="auto-approve-all-btn" class="px-3.5 py-2 bg-[#0F766E] hover:bg-[#0D9488] active:bg-[#115E59] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 flex-1 sm:flex-none justify-center">
                <i class="fa-solid fa-check-double text-xs"></i>
                <span>Approve All Pending</span>
              </button>
            ` : ''}

            <!-- Bulk Action Toolbar (When orders are selected) -->
            <div id="bulk-actions-toolbar" class="hidden flex items-center gap-2">
              <span class="text-xs font-semibold text-slate-600 mr-1"><strong id="selected-count-label" class="text-teal-700">0</strong> selected</span>
              ${statusKey === 'pending' ? `
                <button id="bulk-approve-btn" class="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                  <i class="fa-solid fa-check text-xs"></i> Approve
                </button>
              ` : ''}
              <button id="bulk-clear-btn" class="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 transition-colors">
                Clear
              </button>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
              <span class="text-xs font-semibold text-slate-500">Total in queue:</span>
              <span id="queue-total-badge" class="px-2.5 py-0.5 rounded-full text-xs font-bold ${config.bg} ${config.color} border border-slate-200">
                0
              </span>
            </div>
          </div>
        </div>

        <!-- Urgency Filter Pills Bar (Matching Form Admin: All, Overdue, Urgent, Standard) -->
        <div class="px-3 sm:px-5 py-2 bg-slate-50/90 border-b border-slate-200/70 flex items-center gap-1.5 overflow-x-auto admin-custom-scroll flex-shrink-0">
          <span class="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex-shrink-0">
            <i class="fa-solid fa-clock-rotate-left mr-0.5 text-slate-400"></i> Urgency:
          </span>
          <button data-urgency="all" class="urgency-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-teal-50 text-teal-800 border border-teal-200">
            ⚡ All Deliveries (<span id="count-urgency-all">0</span>)
          </button>
          <button data-urgency="overdue" class="urgency-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent">
            🚨 Overdue (<span id="count-urgency-overdue">0</span>)
          </button>
          <button data-urgency="urgent" class="urgency-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-transparent">
            🔥 Urgent (<span id="count-urgency-urgent">0</span>)
          </button>
          <button data-urgency="standard" class="urgency-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent">
            📅 Standard (<span id="count-urgency-standard">0</span>)
          </button>
        </div>

        <!-- Product Category Filter Bar (Polaroid, Frame, Mini Mag, Magazine, All) -->
        <div class="px-3 sm:px-5 py-2 bg-white border-b border-slate-200/70 flex items-center gap-1.5 overflow-x-auto admin-custom-scroll flex-shrink-0">
          <span class="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex-shrink-0">
            <i class="fa-solid fa-layer-group mr-0.5 text-slate-400"></i> Product:
          </span>
          <button data-product="all" class="product-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-teal-50 text-teal-800 border border-teal-200">
            🌟 All Products (<span id="count-prod-all">0</span>)
          </button>
          <button data-product="magazine" class="product-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-pink-700 hover:bg-pink-50 border border-transparent">
            📰 Magazine (<span id="count-prod-magazine">0</span>)
          </button>
          <button data-product="polaroid" class="product-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-transparent">
            📸 Polaroid (<span id="count-prod-polaroid">0</span>)
          </button>
          <button data-product="frame" class="product-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent">
            🖼️ Frame (<span id="count-prod-frame">0</span>)
          </button>
          <button data-product="mini_mag" class="product-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent">
            📖 Mini Mag (<span id="count-prod-mini">0</span>)
          </button>
        </div>

        <!-- Paid Orders Sub-Status Filter Pills (Smooth Horizontal Scroll, Never Line Breaks) -->
        ${statusKey === 'paid' ? `
          <div class="px-3 sm:px-5 py-2 sm:py-2.5 bg-slate-50/70 border-b border-slate-200/60 flex items-center gap-1.5 overflow-x-auto admin-custom-scroll flex-shrink-0">
            <span class="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex-shrink-0">Stage:</span>
            <button data-stage="all" class="stage-pill-btn whitespace-nowrap flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all bg-teal-50 text-teal-800 border border-teal-200">
              All Paid
            </button>
            <button data-stage="confirmed" class="stage-pill-btn whitespace-nowrap flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100">
              Confirmed
            </button>
            <button data-stage="preparing" class="stage-pill-btn whitespace-nowrap flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100">
              📦 Preparing
            </button>
            <button data-stage="shipped" class="stage-pill-btn whitespace-nowrap flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100">
              🚚 Shipped
            </button>
            <button data-stage="delivered" class="stage-pill-btn whitespace-nowrap flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100">
              ✓ Delivered
            </button>
          </div>
        ` : ''}

        <!-- Orders List Container -->
        <div id="orders-list-content" class="flex-1 p-4 sm:p-5 flex-shrink-0">
          <div class="flex items-center justify-center py-16 text-slate-400 text-xs">
            <i class="fa-solid fa-spinner animate-spin text-lg mr-2 text-teal-600"></i> Loading orders...
          </div>
        </div>

      </div>

      <!-- Quick Back-to-Top Floating Button (Appears when scrolled down) -->
      <button 
        id="orders-scroll-top-btn" 
        class="hidden absolute bottom-5 right-5 z-20 px-3.5 py-2 bg-slate-900/85 hover:bg-slate-900 text-white rounded-full shadow-lg hover:shadow-xl text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:scale-95 border border-white/10"
        title="Scroll to Filters & Search"
      >
        <i class="fa-solid fa-arrow-up text-xs text-teal-400"></i>
        <span>Filters & Search</span>
      </button>

    </div>
  `;

  const searchInput = container.querySelector('#orders-search-input');
  const refreshBtn = container.querySelector('#orders-refresh-btn');
  const listContainer = container.querySelector('#orders-list-content');
  const scrollContainer = container.querySelector('#orders-scroll-container');
  const scrollTopBtn = container.querySelector('#orders-scroll-top-btn');
  const queueTotalBadge = container.querySelector('#queue-total-badge');
  const bulkToolbar = container.querySelector('#bulk-actions-toolbar');
  const selectedCountLabel = container.querySelector('#selected-count-label');
  const bulkApproveBtn = container.querySelector('#bulk-approve-btn');
  const bulkClearBtn = container.querySelector('#bulk-clear-btn');
  const autoApproveAllBtn = container.querySelector('#auto-approve-all-btn');
  const stagePills = container.querySelectorAll('.stage-pill-btn');

  const copyUrgentSummaryBtn = container.querySelector('#copy-urgent-summary-btn');
  const previewUrgentModalBtn = container.querySelector('#preview-urgent-modal-btn');
  const urgentBadgeCount = container.querySelector('#urgent-badge-count');

  const countUrgencyAll = container.querySelector('#count-urgency-all');
  const countUrgencyOverdue = container.querySelector('#count-urgency-overdue');
  const countUrgencyUrgent = container.querySelector('#count-urgency-urgent');
  const countUrgencyStandard = container.querySelector('#count-urgency-standard');
  const urgencyPills = container.querySelectorAll('.urgency-pill-btn');

  const countProdAll = container.querySelector('#count-prod-all');
  const countProdMagazine = container.querySelector('#count-prod-magazine');
  const countProdPolaroid = container.querySelector('#count-prod-polaroid');
  const countProdFrame = container.querySelector('#count-prod-frame');
  const countProdMini = container.querySelector('#count-prod-mini');
  const productPills = container.querySelectorAll('.product-pill-btn');

  const updateBulkToolbar = () => {
    if (selectedOrderIds.size > 0) {
      bulkToolbar.classList.remove('hidden');
      selectedCountLabel.textContent = selectedOrderIds.size;
    } else {
      bulkToolbar.classList.add('hidden');
    }
  };

  const renderCards = () => {
    // 1. Calculate live counts for badges
    const totalUrgent = ordersList.filter(o => o.urgency?.isUrgent || o.urgency?.isOverdue).length;
    if (urgentBadgeCount) urgentBadgeCount.textContent = totalUrgent;

    if (countUrgencyAll) countUrgencyAll.textContent = ordersList.length;
    if (countUrgencyOverdue) countUrgencyOverdue.textContent = ordersList.filter(o => o.urgency?.isOverdue).length;
    if (countUrgencyUrgent) countUrgencyUrgent.textContent = ordersList.filter(o => o.urgency?.isUrgent && !o.urgency?.isOverdue).length;
    if (countUrgencyStandard) countUrgencyStandard.textContent = ordersList.filter(o => !o.urgency?.isUrgent && !o.urgency?.isOverdue).length;

    if (countProdAll) countProdAll.textContent = ordersList.length;
    if (countProdMagazine) countProdMagazine.textContent = ordersList.filter(o => orderHasProduct(o, 'magazine')).length;
    if (countProdPolaroid) countProdPolaroid.textContent = ordersList.filter(o => orderHasProduct(o, 'polaroid')).length;
    if (countProdFrame) countProdFrame.textContent = ordersList.filter(o => orderHasProduct(o, 'frame')).length;
    if (countProdMini) countProdMini.textContent = ordersList.filter(o => orderHasProduct(o, 'mini_mag')).length;

    let filtered = [...ordersList];

    // Apply paid stage filter
    if (statusKey === 'paid' && paidStageFilter !== 'all') {
      if (paidStageFilter === 'confirmed') {
        filtered = filtered.filter(o => o.status === 'confirmed' || o.status === 'paid');
      } else if (paidStageFilter === 'preparing') {
        filtered = filtered.filter(o => o.status === 'preparing');
      } else if (paidStageFilter === 'shipped') {
        filtered = filtered.filter(o => o.status === 'shipped');
      } else if (paidStageFilter === 'delivered') {
        filtered = filtered.filter(o => o.status === 'delivered' || o.status === 'completed');
      }
    }

    // Apply urgency filter
    if (urgencyFilter !== 'all') {
      if (urgencyFilter === 'overdue') {
        filtered = filtered.filter(o => o.urgency?.isOverdue);
      } else if (urgencyFilter === 'urgent') {
        filtered = filtered.filter(o => o.urgency?.isUrgent && !o.urgency?.isOverdue);
      } else if (urgencyFilter === 'standard') {
        filtered = filtered.filter(o => !o.urgency?.isUrgent && !o.urgency?.isOverdue);
      }
    }

    // Apply product category filter
    if (productFilter !== 'all') {
      filtered = filtered.filter(o => orderHasProduct(o, productFilter));
    }

    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(o => 
        (o.orderId && o.orderId.toLowerCase().includes(q)) ||
        (o.orderCode && o.orderCode.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q)) ||
        (o.whatsappNumber && o.whatsappNumber.includes(q)) ||
        (o.contactNumber && o.contactNumber.includes(q)) ||
        (o.igUsername && o.igUsername.toLowerCase().includes(q)) ||
        (o.trxId && o.trxId.toLowerCase().includes(q)) ||
        (o.shippingAddress && o.shippingAddress.toLowerCase().includes(q)) ||
        (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
        (o.items && o.items.some(i => i.templateName && i.templateName.toLowerCase().includes(q)))
      );
    }

    // Sort: Overdue first, Urgent second, Standard third; then by delivery date ascending
    filtered.sort((a, b) => {
      const getPriority = (o) => {
        if (o.urgency?.isOverdue) return 0;
        if (o.urgency?.isUrgent) return 1;
        return 2;
      };
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;

      const tA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 9999999999999;
      const tB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 9999999999999;
      if (tA !== tB) return tA - tB;

      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cB - cA;
    });

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

          const hasPhotos = photoPreviews.length > 0 || order.photosUploaded;

          // Clean phone for WhatsApp URL
          const rawPhone = order.whatsappNumber || order.customerPhone || '';
          const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
          const waPhone = digitsOnly.length > 11 && digitsOnly.startsWith('8801')
            ? digitsOnly
            : digitsOnly.startsWith('88') && digitsOnly.length === 13
            ? digitsOnly
            : digitsOnly.length === 11
            ? `88${digitsOnly}`
            : digitsOnly;
          const waLink = waPhone.length >= 11 ? `https://wa.me/${waPhone}` : null;

          const isOverdue = order.urgency?.isOverdue;
          const isUrgent = order.urgency?.isUrgent && !isOverdue;
          let cardBorderClass = 'bg-white border-slate-200/90 hover:border-teal-500/50';
          if (isOverdue) {
            cardBorderClass = 'bg-rose-50/25 border-rose-300 hover:border-rose-500 shadow-rose-100/50 ring-1 ring-rose-200/50';
          } else if (isUrgent) {
            cardBorderClass = 'bg-amber-50/20 border-amber-300 hover:border-amber-500 shadow-amber-100/50 ring-1 ring-amber-200/50';
          }

          return `
            <div class="${cardBorderClass} border rounded-2xl p-3.5 sm:p-5 shadow-xs transition-all relative flex flex-col gap-3 group">
              
              <!-- Card Top Row: Checkbox, Customer Name (Prominent), Order Code Badge, Status Badge, Source, Date -->
              <div class="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                <div class="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-wrap">
                  <input 
                    type="checkbox" 
                    data-order-id="${order.orderId}" 
                    class="order-checkbox w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer flex-shrink-0"
                    ${isChecked ? 'checked' : ''}
                  >
                  
                  <!-- Prominent Customer Name as Order Header -->
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate max-w-[190px] sm:max-w-[280px]" title="${order.customerName}">
                      ${order.customerName}
                    </span>
                    ${order.recipientName && order.recipientName !== order.customerName ? `
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 whitespace-nowrap flex-shrink-0" title="Gift Recipient: ${order.recipientName}">
                        <i class="fa-solid fa-gift text-[9px] text-indigo-500"></i> For: ${order.recipientName}
                      </span>
                    ` : ''}
                  </div>

                  <!-- Clean Order Code Badge with 1-click Copy -->
                  <button 
                    data-action="copy-id" 
                    data-order-id="${order.orderId}" 
                    class="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono text-[11px] font-bold border border-slate-200/80 flex items-center gap-1.5 flex-shrink-0 transition-colors group/code"
                    title="Order Code #${order.orderCode} (Click to copy full ID: ${order.orderId})"
                  >
                    <span>#${order.orderCode}</span>
                    <i class="fa-regular fa-copy text-[10px] text-slate-400 group-hover/code:text-teal-600 transition-colors"></i>
                  </button>
                  
                  <!-- Stage Status Chip -->
                  <div class="flex-shrink-0">
                    ${renderStatusChipHtml(order.status)}
                  </div>

                  <!-- Source Badge (Form vs Web) -->
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${order.orderSource === 'form' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-slate-100 text-slate-700 border border-slate-200'} flex items-center gap-1 flex-shrink-0">
                    <i class="fa-solid ${order.orderSource === 'form' ? 'fa-shapes text-pink-500' : 'fa-globe text-slate-500'} text-[9px]"></i>
                    ${order.orderSource === 'form' ? 'Custom Form' : 'Web Store'}
                  </span>
                </div>

                <div class="text-[11px] text-slate-400 font-medium whitespace-nowrap flex-shrink-0 ml-auto">
                  ${dateFormatted}
                </div>
              </div>

              <!-- Sub-Badges Line: Product Pills, Instagram, WhatsApp, Delivery Urgency, TrxID, Tracking -->
              <div class="flex flex-wrap items-center gap-1.5 -mt-0.5">
                <!-- Product Breakdown Pills -->
                ${order.items && order.items.length > 0 ? order.items.map(it => {
                  let icon = 'fa-box';
                  let color = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (it.productType === 'magazine') { icon = 'fa-newspaper text-pink-600'; color = 'bg-pink-50/80 text-pink-800 border-pink-200'; }
                  else if (it.productType === 'polaroid') { icon = 'fa-camera text-amber-600'; color = 'bg-amber-50/80 text-amber-800 border-amber-200'; }
                  else if (it.productType === 'frame') { icon = 'fa-image text-blue-600'; color = 'bg-blue-50/80 text-blue-800 border-blue-200'; }
                  else if (it.productType === 'mini_mag') { icon = 'fa-book-open text-emerald-600'; color = 'bg-emerald-50/80 text-emerald-800 border-emerald-200'; }
                  return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${color} border flex items-center gap-1 flex-shrink-0"><i class="fa-solid ${icon} text-[9px]"></i>${it.templateName}</span>`;
                }).join('') : `
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider flex-shrink-0">
                    ${order.productType || 'Prints'}
                  </span>
                `}

                <!-- Instagram Handle Badge -->
                ${order.igUsername ? `
                  <a href="https://instagram.com/${order.igUsername}" target="_blank" rel="noopener noreferrer" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-purple-50 to-pink-50 text-pink-700 border border-pink-200 hover:border-pink-300 flex items-center gap-1 flex-shrink-0 transition-colors" title="Instagram: @${order.igUsername}">
                    <i class="fa-brands fa-instagram text-[10px] text-pink-600"></i>
                    <span>@${order.igUsername}</span>
                  </a>
                ` : ''}

                <!-- Delivery Date & Urgency Pill -->
                ${order.deliveryDate ? `
                  ${order.urgency?.isOverdue ? `
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 flex-shrink-0 animate-pulse" title="Delivery Deadline: ${order.deliveryDate}">
                      <i class="fa-solid fa-triangle-exclamation text-[9px] text-rose-600"></i> ${order.urgency?.text || `OVERDUE (${order.deliveryDate})`}
                    </span>
                  ` : order.urgency?.isUrgent ? `
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 flex-shrink-0" title="Delivery Deadline: ${order.deliveryDate}">
                      <i class="fa-solid fa-fire text-[9px] text-amber-600"></i> ${order.urgency?.text || `URGENT (${order.deliveryDate})`}
                    </span>
                  ` : `
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 flex-shrink-0" title="Delivery Deadline: ${order.deliveryDate}">
                      <i class="fa-regular fa-calendar text-[9px]"></i> ${order.urgency?.text || order.deliveryDate}
                    </span>
                  `}
                ` : ''}

                <!-- Photo Count Pill -->
                ${photoPreviews.length > 0 ? `
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 flex-shrink-0">
                    <i class="fa-solid fa-images text-[9px]"></i> ${photoPreviews.length} Photos
                  </span>
                ` : ''}

                <!-- TrxID -->
                ${order.trxId ? `
                  <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold flex items-center gap-1 flex-shrink-0 truncate max-w-[220px]" title="Trx: ${order.trxId}">
                    <i class="fa-solid fa-receipt text-[9px] text-slate-400"></i> ${order.trxId}
                  </span>
                ` : ''}

                <!-- Steadfast Tracking -->
                ${order.trackingNumber ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1 flex-shrink-0">
                    <i class="fa-solid fa-truck-fast text-[9px]"></i> ${order.trackingNumber}
                  </span>
                ` : ''}
              </div>

              <!-- Card Middle: Customer Details & Order Summary Box -->
              <div class="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div class="space-y-1.5 min-w-0">
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    ${order.customerPhone ? `
                      <a href="tel:${order.customerPhone}" class="text-teal-700 font-bold text-xs hover:underline flex items-center gap-1.5 flex-shrink-0">
                        <i class="fa-solid fa-phone text-[10px]"></i> ${order.customerPhone}
                      </a>
                    ` : ''}

                    ${order.contactNumber && order.contactNumber !== order.customerPhone ? `
                      <a href="tel:${order.contactNumber}" class="text-slate-600 font-medium text-xs hover:underline flex items-center gap-1 flex-shrink-0" title="Alternative Contact">
                        <i class="fa-solid fa-phone-flip text-[10px] text-slate-400"></i> Alt: ${order.contactNumber}
                      </a>
                    ` : ''}

                    ${waLink ? `
                      <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100/80 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 flex items-center gap-1 flex-shrink-0 transition-colors shadow-2xs" title="Chat with ${order.customerName} on WhatsApp">
                        <i class="fa-brands fa-whatsapp text-emerald-600 text-xs"></i> WhatsApp
                      </a>
                    ` : ''}

                    ${order.city ? `
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200/70 text-slate-700 flex items-center gap-1 flex-shrink-0">
                        <i class="fa-solid fa-city text-[9px] text-slate-400"></i> ${order.city}
                      </span>
                    ` : ''}
                  </div>
                  
                  ${order.shippingAddress ? `
                    <div class="text-[11px] text-slate-600 flex items-center gap-1.5 truncate" title="${order.shippingAddress}">
                      <i class="fa-solid fa-location-dot text-teal-600 flex-shrink-0 text-[11px]"></i>
                      <span class="truncate font-medium">${order.shippingAddress}</span>
                    </div>
                  ` : ''}
                </div>

                <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 flex-shrink-0">
                  <div class="text-left sm:text-right">
                    <div class="text-base sm:text-lg font-extrabold text-[#0F766E] leading-tight">৳${order.expectedAmount}</div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">${order.paymentMethod}</div>
                  </div>
                </div>
              </div>

              <!-- Flags or Notes Notice -->
              ${order.flagReason ? `
                <div class="text-xs text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 flex items-center gap-2">
                  <i class="fa-solid fa-triangle-exclamation text-rose-600"></i>
                  <span><strong>Flagged Reason:</strong> ${order.flagReason}</span>
                </div>
              ` : ''}
              ${order.adminNote ? `
                <div class="text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2">
                  <i class="fa-solid fa-note-sticky text-slate-400"></i>
                  <span><strong>Admin Note:</strong> ${order.adminNote}</span>
                </div>
              ` : ''}

              <!-- Shipped Courier Stage Banner (If Shipped) -->
              ${order.status === 'shipped' ? `
                <div class="bg-sky-50 border border-sky-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-sky-800">
                  <div class="flex items-center gap-2">
                    <i class="fa-solid fa-truck-fast text-sky-600"></i>
                    <span class="font-bold">Shipped Stage</span>
                    <span>• Courier: <strong>${order.courierName || 'Steadfast Courier'}</strong></span>
                    ${order.trackingNumber ? `<span>• Tracking: <strong class="font-mono text-sky-900">${order.trackingNumber}</strong></span>` : ''}
                  </div>
                </div>
              ` : ''}

              <!-- Card Action Bar: Lifecycle Buttons, Copy Summary & Download ZIP (Fully Responsive) -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <!-- Quick Copy Summary Button -->
                  <button 
                    data-action="copy-summary" 
                    data-order-id="${order.orderId}" 
                    class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                    title="Copy Order Summary to Clipboard"
                  >
                    <i class="fa-regular fa-copy text-slate-500 text-xs"></i>
                    <span>Copy Summary</span>
                  </button>

                  ${hasPhotos ? `
                    <button 
                      data-action="download-zip" 
                      data-order-id="${order.orderId}" 
                      class="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold rounded-xl border border-teal-200 transition-colors flex items-center gap-1 whitespace-nowrap"
                      title="Download All Photos as ZIP"
                    >
                      <i class="fa-solid fa-download text-xs text-teal-700"></i>
                      <span>ZIP (${photoPreviews.length})</span>
                    </button>
                  ` : ''}
                  
                  <button 
                    data-action="details" 
                    data-order-id="${order.orderId}" 
                    class="px-3 py-1.5 border border-slate-200 hover:border-teal-500/50 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <i class="fa-regular fa-eye text-xs"></i>
                    <span>View Details</span>
                  </button>
                </div>

                <!-- Stage-Specific Lifecycle Action Buttons -->
                <div class="flex items-center gap-2 w-full sm:w-auto">
                  ${renderLifecycleButtonsHtml(order, statusKey)}
                </div>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    // Wire Card Checkboxes
    listContainer.querySelectorAll('.order-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-order-id');
        if (e.target.checked) selectedOrderIds.add(id);
        else selectedOrderIds.delete(id);
        updateBulkToolbar();
      });
    });

    // Wire Action Buttons
    listContainer.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const orderId = btn.getAttribute('data-order-id');
        const order = ordersList.find(o => o.orderId === orderId);
        if (!order) return;

        if (action === 'copy-id') {
          try {
            await navigator.clipboard.writeText(order.orderId);
            adminState.showToast('success', `Order ID #${order.orderId} copied!`);
          } catch (_) {
            adminState.showToast('info', 'ID: ' + order.orderId);
          }
          return;
        }

        if (action === 'copy-summary') {
          const summaryText = formatOrderCopySummary(order);
          try {
            await navigator.clipboard.writeText(summaryText);
            adminState.showToast('success', `Copied: ${summaryText}`);
          } catch (_) {
            adminState.showToast('info', summaryText);
          }
        } else if (action === 'details') {
          openOrderDetailModal(order, () => {});
        } else if (action === 'download-zip') {
          btn.disabled = true;
          const origHtml = btn.innerHTML;
          btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Zipping...';
          try {
            await adminApi.downloadOrderPhotosZip(order, (p) => {
              btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> ${(p * 100).toFixed(0)}%`;
            });
            adminState.showToast('success', `Photos for Order #${order.orderId} downloaded!`);
          } catch (err) {
            adminState.showToast('error', 'Download error: ' + err.message);
          } finally {
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        } else if (action === 'prepare-order') {
          btn.disabled = true;
          try {
            await adminApi.updateOrderStatus(order.orderId, 'preparing', 'Order marked as Preparing!');
            adminState.showToast('success', `Order #${order.orderId} marked as Preparing!`);
          } catch (err) {
            adminState.showToast('error', 'Update error: ' + err.message);
          } finally {
            btn.disabled = false;
          }
        } else if (action === 'ship-order') {
          openShippedModal(order);
        } else if (action === 'mark-delivered') {
          if (!confirm(`Mark Order #${order.orderId} as Delivered & Completed?`)) return;
          try {
            await adminApi.updateOrderStatus(order.orderId, 'completed', 'Delivered successfully');
            adminState.showToast('success', `Order #${order.orderId} completed successfully!`);
          } catch (err) {
            adminState.showToast('error', 'Update error: ' + err.message);
          }
        } else if (action === 'cancel-order') {
          openCancelOrderModal(order);
        } else if (action === 'approve-order') {
          openApproveOrderModal(order);
        } else if (action === 'flag-order') {
          openFlagOrderModal(order);
        } else if (action === 'restore-to-paid') {
          if (!confirm(`Do you want to restore Order #${order.orderId} and mark it as Paid?`)) return;
          try {
            await adminApi.updateOrderStatus(order.orderId, 'paid', 'Restored from cancelled orders by admin');
            adminState.showToast('success', `Order #${order.orderId} restored to Paid Orders!`);
          } catch (err) {
            adminState.showToast('error', 'Restore failed: ' + err.message);
          }
        }
      });
    });
  };

  // Wire Paid Stage Pills
  if (stagePills.length > 0) {
    stagePills.forEach(pill => {
      pill.addEventListener('click', () => {
        paidStageFilter = pill.getAttribute('data-stage');
        stagePills.forEach(p => {
          if (p.getAttribute('data-stage') === paidStageFilter) {
            p.className = 'stage-pill-btn px-3 py-1 rounded-lg text-xs font-bold transition-all bg-teal-50 text-teal-800 border border-teal-200';
          } else {
            p.className = 'stage-pill-btn px-3 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100';
          }
        });
        renderCards();
      });
    });
  }

  // Wire Urgency Filter Pills (All, Overdue, Urgent, Standard)
  if (urgencyPills && urgencyPills.length > 0) {
    urgencyPills.forEach(pill => {
      pill.addEventListener('click', () => {
        urgencyFilter = pill.getAttribute('data-urgency');
        urgencyPills.forEach(p => {
          if (p.getAttribute('data-urgency') === urgencyFilter) {
            p.className = 'urgency-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-teal-50 text-teal-800 border border-teal-200';
          } else {
            p.className = 'urgency-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent';
          }
        });
        renderCards();
      });
    });
  }

  // Wire Product Category Filter Pills (All, Magazine, Polaroid, Frame, Mini Mag)
  if (productPills && productPills.length > 0) {
    productPills.forEach(pill => {
      pill.addEventListener('click', () => {
        productFilter = pill.getAttribute('data-product');
        productPills.forEach(p => {
          if (p.getAttribute('data-product') === productFilter) {
            p.className = 'product-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all bg-teal-50 text-teal-800 border border-teal-200';
          } else {
            p.className = 'product-pill-btn whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent';
          }
        });
        renderCards();
      });
    });
  }

  // Wire Top Copy All Urgent Orders Summary Button (One-Click)
  if (copyUrgentSummaryBtn) {
    copyUrgentSummaryBtn.addEventListener('click', async () => {
      const urgentOrders = ordersList.filter(o => o.urgency?.isUrgent || o.urgency?.isOverdue);
      if (urgentOrders.length === 0) {
        adminState.showToast('info', 'No urgent or overdue orders currently in this queue.');
        return;
      }
      const summaryText = generateAllUrgentSummary(ordersList);
      try {
        await navigator.clipboard.writeText(summaryText);
        adminState.showToast('success', `⚡ Copied ${urgentOrders.length} urgent orders summary to clipboard!`);
      } catch (err) {
        openUrgentSummaryPreviewModal(ordersList);
      }
    });
  }

  // Wire Preview Urgent Summary Button
  if (previewUrgentModalBtn) {
    previewUrgentModalBtn.addEventListener('click', () => {
      openUrgentSummaryPreviewModal(ordersList);
    });
  }

  // Auto-Approve All Pending Orders
  if (autoApproveAllBtn) {
    autoApproveAllBtn.addEventListener('click', () => {
      if (ordersList.length === 0) {
        adminState.showToast('info', 'No pending orders to approve.');
        return;
      }
      openBulkApproveAllModal(ordersList);
    });
  }

  // Bulk Actions
  if (bulkApproveBtn) {
    bulkApproveBtn.addEventListener('click', async () => {
      if (selectedOrderIds.size === 0) return;
      if (!confirm(`Bulk approve ${selectedOrderIds.size} selected orders as PAID?`)) return;

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

  // Search input handler
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderCards();
  });

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

  // Wire Floating Scroll-To-Top Button
  if (scrollContainer && scrollTopBtn) {
    scrollContainer.addEventListener('scroll', () => {
      if (scrollContainer.scrollTop > 180) {
        scrollTopBtn.classList.remove('hidden');
      } else {
        scrollTopBtn.classList.add('hidden');
      }
    });

    scrollTopBtn.addEventListener('click', () => {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/**
 * Status Chip renderer matching Flutter badges (Compact & whitespace-nowrap)
 */
function renderStatusChipHtml(status) {
  const s = (status || 'pending').toLowerCase();
  if (s === 'paid' || s === 'confirmed') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap flex-shrink-0">CONFIRMED</span>`;
  } else if (s === 'preparing') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap flex-shrink-0">PREPARING</span>`;
  } else if (s === 'shipped') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap flex-shrink-0">SHIPPED</span>`;
  } else if (s === 'completed' || s === 'delivered') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap flex-shrink-0">✓ DELIVERED</span>`;
  } else if (s === 'flagged') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap flex-shrink-0">FLAGGED</span>`;
  } else if (s === 'cancelled' || s === 'rejected') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap flex-shrink-0">CANCELLED</span>`;
  }
  return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap flex-shrink-0">${s.toUpperCase()}</span>`;
}

/**
 * Lifecycle buttons renderer matching Flutter paid_orders_tab.dart (Responsive on Mobile)
 */
function renderLifecycleButtonsHtml(order, currentTabKey) {
  const s = (order.status || 'pending').toLowerCase();

  if (currentTabKey === 'pending') {
    return `
      <button 
        data-action="approve-order" 
        data-order-id="${order.orderId}" 
        class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-[#0F766E] hover:bg-[#0D9488] active:bg-[#115E59] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        <i class="fa-solid fa-check text-xs"></i> Mark Paid
      </button>
      <button 
        data-action="flag-order" 
        data-order-id="${order.orderId}" 
        class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
        title="Flag for Manual Review"
      >
        <i class="fa-solid fa-flag text-xs"></i> Flag
      </button>
      <button 
        data-action="cancel-order" 
        data-order-id="${order.orderId}" 
        class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center whitespace-nowrap"
      >
        Cancel
      </button>
    `;
  }

  if (currentTabKey === 'cancelled') {
    return `
      <button 
        data-action="restore-to-paid" 
        data-order-id="${order.orderId}" 
        class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        <i class="fa-solid fa-rotate-left text-xs"></i> Restore Order to Paid
      </button>
    `;
  }

  if (currentTabKey === 'flagged') {
    return `
      <button 
        data-action="approve-order" 
        data-order-id="${order.orderId}" 
        class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        <i class="fa-solid fa-check-double text-xs"></i> Resolve & Mark Paid
      </button>
      <button 
        data-action="cancel-order" 
        data-order-id="${order.orderId}" 
        class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
      >
        Cancel
      </button>
    `;
  }

  // Paid Tab Lifecycle
  if (s === 'paid' || s === 'confirmed') {
    return `
      <button 
        data-action="prepare-order" 
        data-order-id="${order.orderId}" 
        class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        <i class="fa-solid fa-box text-xs"></i> Prepare Order
      </button>
      <button 
        data-action="cancel-order" 
        data-order-id="${order.orderId}" 
        class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
      >
        Cancel
      </button>
    `;
  } else if (s === 'preparing') {
    return `
      <button 
        data-action="ship-order" 
        data-order-id="${order.orderId}" 
        class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        <i class="fa-solid fa-truck-fast text-xs"></i> Mark as Shipped
      </button>
      <button 
        data-action="cancel-order" 
        data-order-id="${order.orderId}" 
        class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
      >
        Cancel
      </button>
    `;
  } else if (s === 'shipped') {
    return `
      <button 
        data-action="mark-delivered" 
        data-order-id="${order.orderId}" 
        class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        <i class="fa-solid fa-circle-check text-xs"></i> Mark as Delivered
      </button>
    `;
  } else if (s === 'completed' || s === 'delivered') {
    return `
      <span class="text-xs font-bold text-emerald-700 flex items-center gap-1 whitespace-nowrap">
        <i class="fa-solid fa-circle-check"></i> Completed
      </span>
    `;
  }

  return '';
}

/**
 * Modal to Mark Order as Shipped (with Courier and optional tracking)
 */
function openShippedModal(order) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const modalHtml = `
    <div id="shipped-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-truck-fast text-base"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 truncate">Ship: ${order.customerName}</h3>
              <p class="text-xs text-slate-500 font-mono">Order #${order.orderCode || order.orderId} • Doorstep Delivery</p>
            </div>
          </div>
          <button id="close-shipped-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="shipped-form" class="p-6 space-y-4">
          
          <div class="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-1.5">
            <div class="flex items-center gap-1.5 text-xs font-bold text-sky-900">
              <i class="fa-solid fa-bolt text-sky-600"></i>
              <span>Steadfast Auto-Booking Active</span>
            </div>
            <p class="text-[11px] text-sky-800 leading-relaxed">
              Leaving Tracking Code blank will automatically call Steadfast API, assign tracking code, and notify delivery rider for pickup.
            </p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Courier Name</label>
            <input 
              type="text" 
              id="shipped-courier-input" 
              value="Steadfast Courier" 
              class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600"
            >
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
              Tracking Code (Optional)
            </label>
            <input 
              type="text" 
              id="shipped-tracking-input" 
              value="${order.trackingNumber || ''}" 
              placeholder="Leave blank to auto-book via Steadfast" 
              class="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600"
            >
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-shipped-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" id="submit-shipped-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-paper-plane text-xs"></i> Confirm Shipped & Book
            </button>
          </div>

        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('shipped-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-shipped-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-shipped-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const form = document.getElementById('shipped-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const courierName = document.getElementById('shipped-courier-input').value.trim() || 'Steadfast Courier';
    const trackingCode = document.getElementById('shipped-tracking-input').value.trim();

    const submitBtn = document.getElementById('submit-shipped-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Booking & Updating...';

    try {
      await adminApi.updateOrderStatus(order.orderId, 'shipped', 'Order marked as shipped', {
        courierName: courierName,
        trackingNumber: trackingCode
      });
      adminState.showToast('success', `Order #${order.orderId} marked as Shipped!`);
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Shipping update failed: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-xs"></i> Confirm Shipped & Book';
    }
  });
}

/**
 * Modal to Cancel Order with Reason
 */
function openCancelOrderModal(order) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const modalHtml = `
    <div id="cancel-order-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-ban text-base"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 truncate">Cancel: ${order.customerName}</h3>
              <p class="text-xs text-slate-500 font-mono">Order #${order.orderCode || order.orderId} • Reason for cancellation</p>
            </div>
          </div>
          <button id="close-cancel-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="cancel-order-form" class="p-6 space-y-4">
          <p class="text-xs text-slate-600">
            Are you sure you want to cancel this order? This will move it to Cancelled Orders queue.
          </p>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
              Cancellation Reason / Note for Customer
            </label>
            <textarea 
              id="cancel-reason-input" 
              rows="3" 
              placeholder="e.g. Cancelled on customer request / Payment verification failed" 
              class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500 text-slate-800"
            ></textarea>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="back-cancel-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Back
            </button>
            <button type="submit" id="confirm-cancel-btn" class="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-ban text-xs"></i> Confirm Cancel
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('cancel-order-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-cancel-modal-btn').addEventListener('click', closeModal);
  document.getElementById('back-cancel-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const form = document.getElementById('cancel-order-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = document.getElementById('cancel-reason-input').value.trim() || 'Cancelled by admin / customer request';

    const submitBtn = document.getElementById('confirm-cancel-btn');
    submitBtn.disabled = true;

    try {
      await adminApi.updateOrderStatus(order.orderId, 'cancelled', reason);
      adminState.showToast('success', `Order #${order.orderId} cancelled successfully`);
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Cancellation failed: ' + err.message);
      submitBtn.disabled = false;
    }
  });
}

/**
 * Modal to Approve Single Order as Paid
 */
function openApproveOrderModal(order) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const modalHtml = `
    <div id="approve-order-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-circle-check text-base"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 truncate">Approve: ${order.customerName}</h3>
              <p class="text-xs text-slate-500 font-mono">Order #${order.orderCode || order.orderId} • Mark as Paid & Confirmed</p>
            </div>
          </div>
          <button id="close-approve-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="approve-order-form" class="p-6 space-y-4">
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-700">
            <div>Customer: <strong>${order.customerName}</strong> (${order.customerPhone})</div>
            <div>Amount: <strong class="text-teal-700 font-extrabold text-sm">৳${order.expectedAmount}</strong> (${order.paymentMethod})</div>
            ${order.trxId ? `<div>TrxID: <strong class="font-mono text-slate-900">${order.trxId}</strong></div>` : ''}
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Admin Note</label>
            <input 
              type="text" 
              id="approve-note-input" 
              value="Manually verified & approved by admin" 
              class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600 text-slate-800"
            >
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-approve-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" id="confirm-approve-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-xl transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-check text-xs"></i> Mark Paid
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('approve-order-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-approve-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-approve-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const form = document.getElementById('approve-order-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = document.getElementById('approve-note-input').value.trim();

    const submitBtn = document.getElementById('confirm-approve-btn');
    submitBtn.disabled = true;

    try {
      await adminApi.updateOrderStatus(order.orderId, 'paid', note);
      adminState.showToast('success', `Order #${order.orderId} approved as Paid!`);
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Approval failed: ' + err.message);
      submitBtn.disabled = false;
    }
  });
}

/**
 * Modal to Flag Order for Manual Review
 */
function openFlagOrderModal(order) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const modalHtml = `
    <div id="flag-order-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-flag text-base"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 truncate">Flag: ${order.customerName}</h3>
              <p class="text-xs text-slate-500 font-mono">Order #${order.orderCode || order.orderId} • Reason for manual review</p>
            </div>
          </div>
          <button id="close-flag-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="flag-order-form" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
              Reason for Flagging *
            </label>
            <textarea 
              id="flag-reason-input" 
              required 
              rows="3" 
              placeholder="e.g. Invalid TrxID / Received amount does not match / Phone unreachable" 
              class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500 text-slate-800"
            ></textarea>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-flag-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" id="confirm-flag-btn" class="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-flag text-xs"></i> Flag Order
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('flag-order-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-flag-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-flag-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const form = document.getElementById('flag-order-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = document.getElementById('flag-reason-input').value.trim();
    if (!reason) return;

    const submitBtn = document.getElementById('confirm-flag-btn');
    submitBtn.disabled = true;

    try {
      await adminApi.updateOrderStatus(order.orderId, 'flagged', '', { flagReason: reason });
      adminState.showToast('warning', `Order #${order.orderId} moved to Flagged queue`);
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Flagging failed: ' + err.message);
      submitBtn.disabled = false;
    }
  });
}

/**
 * Modal to Auto-Approve All Pending Orders (Matching Flutter PendingOrdersTab)
 */
function openBulkApproveAllModal(pendingOrders) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const totalRevenue = pendingOrders.reduce((sum, o) => sum + (o.expectedAmount || 0), 0);

  const modalHtml = `
    <div id="bulk-all-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-done-all text-base"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Auto-Approve All Pending Orders?</h3>
              <p class="text-xs text-slate-500">Bulk approval verification</p>
            </div>
          </div>
          <button id="close-bulk-all-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="p-6 space-y-4">
          <p class="text-xs font-semibold text-slate-800">
            You are about to mark ALL <strong>${pendingOrders.length}</strong> pending orders as <strong>PAID</strong>.
          </p>

          <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-1">
            <div class="text-xs text-emerald-800">Total Pending Orders: <strong>${pendingOrders.length}</strong></div>
            <div class="text-sm font-bold text-emerald-900">
              Total Expected Revenue: ৳${totalRevenue.toLocaleString()}
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-bulk-all-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="button" id="confirm-bulk-all-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-xl transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-check-double text-xs"></i> Approve All (${pendingOrders.length})
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('bulk-all-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-bulk-all-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-bulk-all-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const confirmBtn = document.getElementById('confirm-bulk-all-btn');
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Approving...';

    let successCount = 0;
    for (const order of pendingOrders) {
      try {
        await adminApi.updateOrderStatus(order.orderId, 'paid', 'Bulk approved by admin');
        successCount++;
      } catch (e) {
        console.warn('Bulk approve failed for ' + order.orderId, e);
      }
    }

    adminState.showToast('success', `Successfully approved ${successCount} / ${pendingOrders.length} orders!`);
    closeModal();
  });
}

/**
 * Modal to Preview & Copy All Urgent/Overdue Orders in Requested Format
 */
function openUrgentSummaryPreviewModal(ordersList) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const urgentOrders = ordersList.filter(o => 
    o.status !== 'completed' && 
    o.status !== 'cancelled' && 
    (o.urgency?.isUrgent || o.urgency?.isOverdue)
  );
  const summaryText = generateAllUrgentSummary(ordersList);

  const modalHtml = `
    <div id="urgent-preview-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center font-bold">
              <i class="fa-solid fa-bolt text-base"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Urgent Delivery Summaries</h3>
              <p class="text-xs text-slate-500">${urgentOrders.length} urgent/overdue orders ready for production copy</p>
            </div>
          </div>
          <button id="close-urgent-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="p-5 flex-1 overflow-y-auto space-y-4">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-700">Production Summary Preview:</span>
            <span class="text-slate-400 font-semibold">${urgentOrders.length} orders</span>
          </div>

          <textarea 
            id="urgent-summary-textarea" 
            readonly 
            rows="10" 
            class="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-teal-500 select-all resize-y"
          >${summaryText}</textarea>

          <div class="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
            <i class="fa-solid fa-circle-info text-amber-600 mr-1"></i>
            <strong>Format:</strong> <code>Phone (IG) - Products - Theme - Price - need Date - City</code>. Multiple items joined by <code> ,, </code>.
          </div>
        </div>

        <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button type="button" id="cancel-urgent-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors">
            Close
          </button>
          <button type="button" id="copy-urgent-modal-btn" class="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-95">
            <i class="fa-regular fa-copy text-xs"></i>
            <span>Copy All Summaries</span>
          </button>
        </div>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('urgent-preview-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-urgent-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-urgent-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const copyBtn = document.getElementById('copy-urgent-modal-btn');
  copyBtn.addEventListener('click', async () => {
    const textarea = document.getElementById('urgent-summary-textarea');
    try {
      await navigator.clipboard.writeText(textarea.value);
      adminState.showToast('success', `Copied ${urgentOrders.length} urgent summaries!`);
      closeModal();
    } catch (_) {
      textarea.select();
      document.execCommand('copy');
      adminState.showToast('success', 'Copied to clipboard!');
      closeModal();
    }
  });
}

