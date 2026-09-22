import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

export function renderUnmatchedPaymentsTab(container) {
  let allPayments = [];
  let searchQuery = '';
  let activeUnsub = null;

  container.innerHTML = `
    <div class="flex flex-col h-full bg-[#F8FAFC]">
      
      <!-- Top Title & Search Bar -->
      <div class="p-4 sm:p-6 border-b border-slate-200/80 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Unmatched Payments</h2>
            <span id="unmatched-count-badge" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
              0
            </span>
          </div>
          <p class="text-xs text-slate-500 font-medium mt-0.5">
            bKash / Nagad / Rocket SMS transactions waiting to be matched with customer orders
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <div class="relative w-full sm:w-72">
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
              type="text" 
              id="unmatched-search-input" 
              placeholder="Search TrxID, SMS, amount..." 
              class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white transition-all placeholder:text-slate-400"
            >
          </div>
          <button id="unmatched-refresh-btn" class="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50/50 flex items-center justify-center transition-all flex-shrink-0" title="Refresh Payments">
            <i class="fa-solid fa-rotate text-xs"></i>
          </button>
        </div>
      </div>

      <!-- Payments List View -->
      <div id="unmatched-payments-content" class="flex-1 overflow-y-auto p-4 sm:p-6 admin-custom-scroll space-y-4">
        <div class="flex items-center justify-center py-16 text-slate-400 text-xs">
          <i class="fa-solid fa-spinner animate-spin text-lg mr-2 text-teal-600"></i> Loading unmatched payments...
        </div>
      </div>

    </div>
  `;

  const searchInput = container.querySelector('#unmatched-search-input');
  const refreshBtn = container.querySelector('#unmatched-refresh-btn');
  const countBadge = container.querySelector('#unmatched-count-badge');
  const listContainer = container.querySelector('#unmatched-payments-content');

  const renderCards = () => {
    let filtered = allPayments;
    if (searchQuery) {
      filtered = allPayments.filter(p =>
        p.trxId.toLowerCase().includes(searchQuery) ||
        p.provider.toLowerCase().includes(searchQuery) ||
        p.rawSms.toLowerCase().includes(searchQuery) ||
        p.amount.toString().includes(searchQuery) ||
        (p.sender && p.sender.includes(searchQuery))
      );
    }

    countBadge.textContent = allPayments.length;

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-3 border border-purple-100 shadow-xs">
            <i class="fa-solid fa-link-slash"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-800 mb-1">
            ${searchQuery ? 'No Matching Payment Transactions' : 'No Unmatched Payments'}
          </h4>
          <p class="text-xs text-slate-400 max-w-sm">
            ${searchQuery ? 'Try clearing your search query or check the TrxID.' : 'All incoming customer payments have been matched or dismissed!'}
          </p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(payment => {
      const isBkash = payment.provider.toLowerCase().includes('bkash');
      const isNagad = payment.provider.toLowerCase().includes('nagad');
      
      const badgeStyle = isBkash 
        ? 'bg-pink-50 text-pink-700 border-pink-200' 
        : (isNagad ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-purple-50 text-purple-700 border-purple-200');

      const dateStr = payment.receivedAt ? new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(payment.receivedAt) : 'Recently';

      return `
        <div class="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          
          <!-- Top Row: TrxID Badge, Provider Pill, Timestamp -->
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg">
                <i class="fa-solid fa-receipt text-slate-400 text-xs"></i>
                <span class="font-mono text-xs font-bold text-slate-800 tracking-wide">${payment.trxId}</span>
                <button class="text-slate-400 hover:text-teal-700 ml-1 copy-trx-btn" data-trx="${payment.trxId}" title="Copy TrxID">
                  <i class="fa-regular fa-copy text-xs"></i>
                </button>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle}">
                ${payment.provider.toUpperCase()}
              </span>
            </div>

            <div class="text-xs text-slate-400 font-medium flex items-center gap-1">
              <i class="fa-regular fa-clock text-[11px]"></i>
              <span>${dateStr}</span>
            </div>
          </div>

          <!-- Amount & Sender Info -->
          <div class="flex items-baseline gap-2 mb-3">
            <span class="text-2xl sm:text-3xl font-extrabold text-[#0F766E] tracking-tight">৳${payment.amount}</span>
            ${payment.sender ? `<span class="text-xs text-slate-500 font-medium">from ${payment.sender}</span>` : ''}
          </div>

          <!-- Raw SMS Content -->
          ${payment.rawSms ? `
            <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-4 select-all text-xs font-mono text-slate-700 leading-relaxed break-all">
              ${payment.rawSms}
            </div>
          ` : ''}

          <!-- Action Buttons Row -->
          <div class="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <button 
              data-action="match" 
              data-trx="${payment.trxId}" 
              data-amount="${payment.amount}"
              class="flex-1 min-w-[140px] px-4 py-2.5 bg-[#0F766E] hover:bg-[#0D9488] active:bg-[#115E59] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <i class="fa-solid fa-link text-xs"></i>
              <span>Match to Order</span>
            </button>

            <button 
              data-action="dismiss" 
              data-trx="${payment.trxId}" 
              data-amount="${payment.amount}"
              class="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <i class="fa-solid fa-trash text-xs"></i>
              <span>Delete / Ignore Trx</span>
            </button>
          </div>

        </div>
      `;
    }).join('');

    // Wire Card Events
    listContainer.querySelectorAll('.copy-trx-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const trx = btn.getAttribute('data-trx');
        navigator.clipboard.writeText(trx);
        adminState.showToast('info', `TrxID "${trx}" copied to clipboard`);
      });
    });

    listContainer.querySelectorAll('button[data-action="match"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const trxId = btn.getAttribute('data-trx');
        const amount = btn.getAttribute('data-amount');
        openMatchPaymentModal(trxId, amount);
      });
    });

    listContainer.querySelectorAll('button[data-action="dismiss"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const trxId = btn.getAttribute('data-trx');
        const amount = btn.getAttribute('data-amount');
        if (!confirm(`Are you sure you want to dismiss transaction "${trxId}" (৳${amount})?\n\nUse this for personal payments that are not related to customer orders.`)) return;
        
        try {
          await adminApi.dismissPayment(trxId);
          adminState.showToast('success', `Transaction ${trxId} dismissed`);
        } catch (err) {
          adminState.showToast('error', 'Failed to dismiss: ' + err.message);
        }
      });
    });
  };

  const subscribe = () => {
    if (activeUnsub) activeUnsub();
    activeUnsub = adminApi.watchUnmatchedPayments(
      payments => {
        allPayments = payments;
        renderCards();
      },
      err => {
        listContainer.innerHTML = `
          <div class="p-6 text-center text-rose-600 text-xs font-semibold">
            Failed to load payments: ${err.message}
          </div>
        `;
      }
    );
    adminState.addSubscription(activeUnsub);
  };

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderCards();
  });

  refreshBtn.addEventListener('click', () => {
    subscribe();
    adminState.showToast('info', 'Refreshing payments list...');
  });

  subscribe();
}

/**
 * Modal to Match Payment to Order ID
 */
function openMatchPaymentModal(trxId, amount) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const modalHtml = `
    <div id="match-payment-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-link text-base"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Match Payment to Order</h3>
              <p class="text-xs text-slate-500">Link transaction to target order</p>
            </div>
          </div>
          <button id="close-match-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="match-payment-form" class="p-6 space-y-4">
          
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Transaction</span>
              <span class="font-mono font-bold text-slate-800">${trxId}</span>
            </div>
            <div class="text-right">
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Amount</span>
              <span class="font-extrabold text-[#0F766E] text-sm">৳${amount}</span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
              Target Order ID *
            </label>
            <input 
              type="text" 
              id="match-order-id-input" 
              required 
              placeholder="e.g. ORD-1024 or full order ID" 
              class="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            >
            <p class="text-[11px] text-slate-400 mt-1">
              Entering the Order ID will link this TrxID and mark the order as <strong>PAID</strong>.
            </p>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-match-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" id="submit-match-modal-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-xl transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-check text-xs"></i> Confirm Match
            </button>
          </div>

        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('match-payment-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-match-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-match-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const form = document.getElementById('match-payment-form');
  const input = document.getElementById('match-order-id-input');
  setTimeout(() => input.focus(), 100);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetOrderId = input.value.trim();
    if (!targetOrderId) return;

    const submitBtn = document.getElementById('submit-match-modal-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Matching...';

    try {
      await adminApi.manualMatchPayment(trxId, targetOrderId);
      adminState.showToast('success', `Payment ${trxId} matched to Order #${targetOrderId}! Order marked as Paid.`);
      closeModal();
    } catch (err) {
      adminState.showToast('error', err.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-check text-xs"></i> Confirm Match';
    }
  });
}
