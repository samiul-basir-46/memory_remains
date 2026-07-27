import { getFirebaseServices } from '../services/firebase-service.js';
import { updateUserProfileInfo, openAuthModal } from '../services/auth-service.js';
import { renderPhotoUploadUI } from '../components/photo-upload.js';
import { createToast, qs, escapeHtml } from '../utils/ui.js';

let currentActiveUser = null;

export function initProfileController() {
  const { auth } = getFirebaseServices();
  if (!auth) return;

  auth.onAuthStateChanged((user) => {
    currentActiveUser = user;
    const authRequired = qs('#profile-auth-required');
    const profileContent = qs('#profile-content-container');

    if (!user) {
      if (authRequired) authRequired.classList.remove('hidden');
      if (profileContent) profileContent.classList.add('hidden');
      qs('#profile-login-trigger')?.addEventListener('click', () => openAuthModal());
      return;
    }

    if (authRequired) authRequired.classList.add('hidden');
    if (profileContent) profileContent.classList.remove('hidden');

    setupTabs();
    populateProfileData(user);
    bindProfileForm(user);
    loadUserOrders(user);
  });
}

function setupTabs() {
  const tabBtnProfile = qs('#tab-btn-profile');
  const tabBtnOrders = qs('#tab-btn-orders');
  const tabContentProfile = qs('#tab-content-profile');
  const tabContentOrders = qs('#tab-content-orders');

  function switchTab(activeTab) {
    if (activeTab === 'orders') {
      tabBtnOrders?.classList.remove('bg-gray-100', 'text-gray-700');
      tabBtnOrders?.classList.add('bg-primary', 'text-white', 'shadow-sm');

      tabBtnProfile?.classList.remove('bg-primary', 'text-white', 'shadow-sm');
      tabBtnProfile?.classList.add('bg-gray-100', 'text-gray-700');

      tabContentOrders?.classList.remove('hidden');
      tabContentProfile?.classList.add('hidden');
    } else {
      tabBtnProfile?.classList.remove('bg-gray-100', 'text-gray-700');
      tabBtnProfile?.classList.add('bg-primary', 'text-white', 'shadow-sm');

      tabBtnOrders?.classList.remove('bg-primary', 'text-white', 'shadow-sm');
      tabBtnOrders?.classList.add('bg-gray-100', 'text-gray-700');

      tabContentProfile?.classList.remove('hidden');
      tabContentOrders?.classList.add('hidden');
    }
  }

  tabBtnProfile?.addEventListener('click', () => switchTab('profile'));
  tabBtnOrders?.addEventListener('click', () => switchTab('orders'));

  if (window.location.hash === '#orders') {
    switchTab('orders');
  }
}

function populateProfileData(user) {
  const displayNameHeader = qs('#profile-display-name-header');
  const emailHeader = qs('#profile-display-email-header');
  const nameInput = qs('#profile-name');
  const emailInput = qs('#profile-email');
  const phoneInput = qs('#profile-phone');
  const avatarImg = qs('#profile-avatar-img');
  const avatarInitials = qs('#profile-avatar-initials');

  const name = user.displayName || user.email?.split('@')[0] || 'User';
  if (displayNameHeader) displayNameHeader.textContent = name;
  if (emailHeader) emailHeader.textContent = user.email || '';
  if (nameInput) nameInput.value = user.displayName || '';
  if (emailInput) emailInput.value = user.email || '';
  if (phoneInput) phoneInput.value = user.phoneNumber || '';

  if (avatarInitials) {
    avatarInitials.textContent = name.charAt(0).toUpperCase();
  }

  if (user.photoURL) {
    if (avatarImg) {
      avatarImg.src = user.photoURL;
      avatarImg.onerror = () => {
        avatarImg.classList.add('hidden');
        if (avatarInitials) avatarInitials.classList.remove('hidden');
      };
      avatarImg.onload = () => {
        avatarImg.classList.remove('hidden');
        if (avatarInitials) avatarInitials.classList.add('hidden');
      };
      avatarImg.classList.remove('hidden');
    }
    if (avatarInitials) avatarInitials.classList.add('hidden');
  } else {
    if (avatarImg) avatarImg.classList.add('hidden');
    if (avatarInitials) avatarInitials.classList.remove('hidden');
  }
}

function bindProfileForm(user) {
  const form = qs('#profile-form');
  const avatarClickable = qs('#profile-avatar-clickable');
  const changeAvatarBtn = qs('#change-avatar-btn');
  const fileInput = qs('#profile-avatar-file-input');
  const uploadSpinner = qs('#avatar-upload-spinner');

  if (avatarClickable && fileInput) {
    const triggerFilePicker = (e) => {
      e.stopPropagation();
      fileInput.click();
    };
    avatarClickable.onclick = triggerFilePicker;
    if (changeAvatarBtn) changeAvatarBtn.onclick = triggerFilePicker;

    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        createToast('Please select a valid image file.', 'error');
        return;
      }

      if (uploadSpinner) uploadSpinner.classList.remove('hidden');

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'memory-remains');

        const cldRes = await fetch('https://api.cloudinary.com/v1_1/cmpl84gp/image/upload', {
          method: 'POST',
          body: formData
        });

        if (!cldRes.ok) {
          const errData = await cldRes.json().catch(() => ({}));
          throw new Error(errData.error?.message || 'Upload failed');
        }

        const data = await cldRes.json();
        const photoURL = data.secure_url;

        await updateUserProfileInfo({ photoURL });
        createToast('Profile picture updated!');
        populateProfileData({ ...user, photoURL });
      } catch (err) {
        console.error('Failed to upload profile picture:', err);
        createToast(err.message || 'Failed to upload image', 'error');
      } finally {
        if (uploadSpinner) uploadSpinner.classList.add('hidden');
        fileInput.value = '';
      }
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const displayName = qs('#profile-name')?.value.trim();
      const phoneNumber = qs('#profile-phone')?.value.trim();

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        await updateUserProfileInfo({ displayName });
        createToast('Profile updated successfully.');
        populateProfileData({ ...user, displayName, phoneNumber });
      } catch (err) {
        console.error('Failed to update profile:', err);
        createToast(err.message || 'Failed to update profile.', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }
}

function getOrderCategoryGroup(order) {
  const s = String(order.status || '').toLowerCase().trim();
  if (s === 'cancelled' || s === 'canceled') {
    return 'cancelled';
  }
  if (['verified', 'paid', 'confirmed', 'preparing', 'prepared', 'shipped', 'delivered', 'completed'].includes(s)) {
    return 'verified';
  }
  return 'pending';
}

async function loadUserOrders(user) {
  const loadingState = qs('#orders-loading-state');
  const emptyState = qs('#orders-empty-state');
  const listContainer = qs('#orders-list-container');
  const ordersBadge = qs('#my-orders-badge');
  const filterTabsContainer = qs('#orders-filter-tabs');

  if (!loadingState || !emptyState || !listContainer) return;

  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  listContainer.classList.add('hidden');
  if (filterTabsContainer) filterTabsContainer.classList.add('hidden');

  let activeOrderFilter = 'all';
  let allUserOrders = [];

  const updateOrderFilterUI = () => {
    if (allUserOrders.length === 0) {
      emptyState.classList.remove('hidden');
      listContainer.classList.add('hidden');
      if (filterTabsContainer) filterTabsContainer.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    if (filterTabsContainer) filterTabsContainer.classList.remove('hidden');

    // Calculate category counts
    const cntAll = allUserOrders.length;
    const cntPending = allUserOrders.filter(o => getOrderCategoryGroup(o) === 'pending').length;
    const cntVerified = allUserOrders.filter(o => getOrderCategoryGroup(o) === 'verified').length;
    const cntCancelled = allUserOrders.filter(o => getOrderCategoryGroup(o) === 'cancelled').length;

    const elAll = qs('#cnt-filter-all');
    const elPending = qs('#cnt-filter-pending');
    const elVerified = qs('#cnt-filter-verified');
    const elCancelled = qs('#cnt-filter-cancelled');

    if (elAll) elAll.textContent = cntAll;
    if (elPending) elPending.textContent = cntPending;
    if (elVerified) elVerified.textContent = cntVerified;
    if (elCancelled) elCancelled.textContent = cntCancelled;

    // Filter orders
    const filteredOrders = allUserOrders.filter(order => {
      if (activeOrderFilter === 'all') return true;
      return getOrderCategoryGroup(order) === activeOrderFilter;
    });

    listContainer.innerHTML = '';
    listContainer.classList.remove('hidden');

    if (filteredOrders.length === 0) {
      const emptyMsgMap = {
        all: 'No orders found.',
        pending: 'No orders are currently under processing or review.',
        verified: 'No verified or active orders yet.',
        cancelled: 'No cancelled orders.'
      };
      listContainer.innerHTML = `
        <div class="bg-white rounded-2xl border border-pink-100 p-8 text-center text-sm text-gray-500 font-semibold space-y-2">
          <i class="fa-solid fa-filter text-2xl text-pink-300"></i>
          <p class="m-0">${emptyMsgMap[activeOrderFilter] || 'No orders in this category.'}</p>
        </div>
      `;
      return;
    }

    filteredOrders.forEach(order => {
      const orderCard = renderOrderCard(order);
      listContainer.appendChild(orderCard);
    });
  };

  // Bind filter button clicks
  if (filterTabsContainer) {
    const filterBtns = filterTabsContainer.querySelectorAll('.order-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filterVal = btn.dataset.orderFilter || 'all';
        activeOrderFilter = filterVal;

        // Update button styles
        filterBtns.forEach(b => {
          const isSelected = b.dataset.orderFilter === activeOrderFilter;
          if (isSelected) {
            b.className = 'order-filter-btn px-4 py-2 text-xs font-bold rounded-xl transition-all border border-pink-200 bg-primary text-white shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer scale-105';
          } else {
            b.className = 'order-filter-btn px-4 py-2 text-xs font-bold rounded-xl transition-all border border-pink-100 bg-white text-gray-700 hover:bg-pink-50 hover:text-primary flex items-center gap-1.5 whitespace-nowrap cursor-pointer';
          }
        });

        updateOrderFilterUI();
      });
    });
  }

  try {
    const { db } = getFirebaseServices();
    if (!db) return;

    if (window.__userOrdersUnsub) {
      window.__userOrdersUnsub();
      window.__userOrdersUnsub = null;
    }

    const queryRef = user.uid
      ? db.collection('purchases').where('userId', '==', user.uid)
      : db.collection('purchases').where('email', '==', user.email);

    window.__userOrdersUnsub = queryRef.onSnapshot((snapshot) => {
      let orders = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        orders.push({ id: doc.id, order_id: doc.id, ...d });
      });

      orders.sort((a, b) => {
        const da = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || a.purchaseDate || 0);
        const dbTime = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || b.purchaseDate || 0);
        return dbTime - da;
      });

      loadingState.classList.add('hidden');

      if (ordersBadge) {
        ordersBadge.textContent = orders.length;
        ordersBadge.classList.remove('hidden');
      }

      allUserOrders = orders;
      updateOrderFilterUI();
    });

  } catch (err) {
    console.error('Failed to load orders:', err);
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    createToast('Failed to load orders.', 'error');
  }
}

function renderAdminFlagNoteBanner(order) {
  const status = (order.status || '').toLowerCase();
  
  // STRICT RULE: ONLY show Action Required Banner IF status IS 'flagged'!
  if (status !== 'flagged') return '';

  const adminNote = order.admin_note || order.adminNote || order.note || '';
  const flagReason = order.flag_reason || order.flagReason || '';

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

function renderOrderCard(order) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-2xl border border-pink-100 p-6 shadow-sm space-y-4';

  const status = (order.status || 'pending').toLowerCase();
  const isCancelled = status === 'cancelled' || status === 'rejected';
  let statusBadge = `<span class="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-full">⏳ Payment Pending</span>`;

  if (isCancelled) {
    statusBadge = `<span class="px-3 py-1 bg-red-100 text-red-800 border border-red-300 text-xs font-bold rounded-full">❌ Order Cancelled</span>`;
  } else if (status === 'flagged') {
    statusBadge = `<span class="px-3 py-1 bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold rounded-full animate-pulse">⚠️ Action Required</span>`;
  } else if (status === 'confirmed' || status === 'paid') {
    statusBadge = `<span class="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full">✅ Payment Verified</span>`;
  } else if (status === 'preparing') {
    statusBadge = `<span class="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold rounded-full">📦 Preparing Order</span>`;
  } else if (status === 'shipped') {
    statusBadge = `<span class="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-full">🚚 Shipped</span>`;
  } else if (status === 'delivered') {
    statusBadge = `<span class="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-full">🎉 Delivered Successfully</span>`;
  } else if (status === 'completed') {
    statusBadge = `<span class="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-full">🎉 Completed</span>`;
  }

  const isConfirmed = ['paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed'].includes(status);
  const isPreparing = ['preparing', 'shipped', 'delivered', 'completed'].includes(status);
  const isShipped = ['shipped', 'delivered', 'completed'].includes(status);
  const isDelivered = ['delivered', 'completed'].includes(status);

  const items = order.items && Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : [{
      item_id: order.id,
      template_name: order.template_name || order.product_name || 'Magazine Order',
      product_type: order.product_type || (order.canva_link ? 'template' : 'magazine'),
      required_photo_count: order.required_photo_count || order.photo_count || 10,
      photos_uploaded: order.photos_uploaded || false,
      canva_link: order.canva_link
    }];

  const dateStr = order.created_at?.toDate
    ? order.created_at.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Recently';

  card.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-gray-500 font-mono">Order #${order.id || order.order_id}</span>
          ${statusBadge}
        </div>
        <p class="text-xs text-gray-500 mt-1"><i class="fa-regular fa-clock mr-1"></i>${dateStr}</p>
      </div>
      <div class="text-right">
        <span class="text-xs text-gray-500 block">Total Amount</span>
        <span class="text-lg font-bold text-primary font-mono">৳${(order.expected_amount || order.amount || 0).toFixed(0)}</span>
      </div>
    </div>

    ${renderAdminFlagNoteBanner(order)}

    ${isCancelled ? `
      <div class="p-3.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 font-medium space-y-1">
        <span class="font-bold block text-red-800"><i class="fa-solid fa-ban mr-1.5"></i>Order Cancelled</span>
        <p class="m-0 text-red-950">${escapeHtml(order.admin_note || order.adminNote || 'This order was cancelled by admin.')}</p>
      </div>
    ` : ''}

    ${(status !== 'flagged' && !isCancelled) ? `
      <!-- Timeline Progression -->
      <div class="p-3.5 bg-pink-50/40 rounded-xl border border-pink-100 space-y-2">
        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Order Status Timeline</span>
        <div class="relative flex items-center justify-between text-xs">
          <div class="absolute top-3 left-3 right-3 h-0.5 -translate-y-1/2 flex z-0">
            <div class="h-full flex-1 ${isPreparing ? 'bg-purple-500' : 'bg-gray-200'}"></div>
            <div class="h-full flex-1 ${isShipped ? 'bg-blue-500' : 'bg-gray-200'}"></div>
            <div class="h-full flex-1 ${isDelivered ? 'bg-emerald-500' : 'bg-gray-200'}"></div>
          </div>
          <div class="relative z-10 flex flex-col items-center text-center">
            <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${isConfirmed ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}">✓</div>
            <span class="text-[9px] font-bold mt-1 ${isConfirmed ? 'text-emerald-700' : 'text-gray-400'}">Verified</span>
          </div>
          <div class="relative z-10 flex flex-col items-center text-center">
            <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${isPreparing ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}">📦</div>
            <span class="text-[9px] font-bold mt-1 ${isPreparing ? 'text-purple-700' : 'text-gray-400'}">Preparing</span>
          </div>
          <div class="relative z-10 flex flex-col items-center text-center">
            <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${isShipped ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}">🚚</div>
            <span class="text-[9px] font-bold mt-1 ${isShipped ? 'text-blue-700' : 'text-gray-400'}">Shipped</span>
          </div>
          <div class="relative z-10 flex flex-col items-center text-center">
            <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${isDelivered ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}">🎉</div>
            <span class="text-[9px] font-bold mt-1 ${isDelivered ? 'text-emerald-700' : 'text-gray-400'}">Delivered</span>
          </div>
        </div>
        ${(order.courier_name || order.courierName || order.tracking_number || order.trackingNumber) ? `
          <div class="mt-2 p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between shadow-sm">
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

    <!-- Items List -->
    <div class="space-y-4">
      <h4 class="text-xs font-bold uppercase tracking-wider text-gray-600">Order Items (${items.length})</h4>
      <div class="items-container space-y-4"></div>
    </div>
  `;

  const itemsContainer = card.querySelector('.items-container');

  items.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'bg-pink-50/40 rounded-xl p-4 border border-pink-100/60 space-y-3';

    const rawType = (item.product_type || (item.canva_link ? 'template' : 'magazine')).toLowerCase();
    const isMagazine = rawType === 'magazine';
    const isPoster = rawType === 'poster';
    const isSticker = rawType === 'sticker';
    const isWallFrame = rawType === 'wall_frame' || rawType === 'frame';
    const isTemplate = rawType === 'template';
    const isPhysicalItem = isPoster || isSticker || isWallFrame;

    const recipientText = item.recipient_name ? ` (Recipient: ${item.recipient_name})` : '';

    let iconClass = 'fa-solid fa-box-open text-primary';
    let badgeText = 'Physical Order';
    let badgeClass = 'bg-blue-100 text-blue-800';

    if (isMagazine) {
      iconClass = 'fa-solid fa-book-open text-primary';
      badgeText = 'Magazine';
      badgeClass = 'bg-purple-100 text-purple-800';
    } else if (isPoster) {
      iconClass = 'fa-solid fa-image text-sky-600';
      badgeText = `Poster (${item.combo_quantity || item.comboQuantity || 5} Pcs)`;
      badgeClass = 'bg-sky-100 text-sky-800';
    } else if (isSticker) {
      iconClass = 'fa-solid fa-note-sticky text-amber-600';
      badgeText = 'Sticker Pack';
      badgeClass = 'bg-amber-100 text-amber-800';
    } else if (isWallFrame) {
      iconClass = 'fa-solid fa-crop-simple text-slate-700';
      badgeText = 'Wall Frame';
      badgeClass = 'bg-slate-200 text-slate-800';
    } else if (isTemplate) {
      iconClass = 'fa-solid fa-file-code text-teal-600';
      badgeText = 'Template';
      badgeClass = 'bg-teal-100 text-teal-800';
    }

    itemEl.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <i class="${iconClass} text-lg"></i>
          <span class="font-bold text-sm text-gray-800">${item.template_name || 'Item'}${recipientText}</span>
        </div>
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeClass}">
          ${badgeText}
        </span>
      </div>
    `;

    if (!isCancelled) {
      if (isMagazine) {
        const uploadArea = document.createElement('div');
        uploadArea.className = 'mt-3 pt-3 border-t border-pink-100';

        const isPaid = ['paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed'].includes(status);
        const mainOrderId = order.id || order.order_id || order.orderId;

        const itemUploaded = Boolean(item.photos_uploaded || item.photosUploaded || order.photos_uploaded || order.photosUploaded);

        if (!isPaid && status !== 'flagged') {
          uploadArea.innerHTML = `
            <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <i class="fa-solid fa-clock text-amber-600 text-sm"></i>
              <span>Payment Verification Pending — Photo upload will unlock automatically once your payment is verified by Admin.</span>
            </div>
          `;
        } else if (itemUploaded) {
          uploadArea.innerHTML = `
            <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2 shadow-sm">
              <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i>
              <span>✅ Photos Received (${item.required_photo_count || 10} photos uploaded) — Your magazine is being prepared by our team.</span>
            </div>
          `;
        } else if (isPaid) {
          renderPhotoUploadUI(uploadArea, {
            orderId: mainOrderId,
            itemId: item.item_id,
            itemIndex: index,
            requiredPhotoCount: item.required_photo_count || 10,
            photosUploaded: false,
            onSuccess: () => {
              createToast(`Photos uploaded for ${item.template_name || 'item'}!`);
              item.photos_uploaded = true;
              loadUserOrders(currentActiveUser);
            }
          });
        }
        if (uploadArea.children.length > 0 || uploadArea.innerHTML.trim() !== '') {
          itemEl.appendChild(uploadArea);
        }
      } else if (isPhysicalItem) {
        const physicalArea = document.createElement('div');
        physicalArea.className = 'mt-3 pt-3 border-t border-pink-100';
        const itemCustomPhotos = Array.isArray(item.photo_urls || item.photoUrls) ? (item.photo_urls || item.photoUrls) : [];

        if (itemCustomPhotos.length > 0) {
          physicalArea.innerHTML = `
            <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2 shadow-sm">
              <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i>
              <span>✅ Custom Photos Uploaded (${itemCustomPhotos.length} photos) — Printing and preparing for courier delivery.</span>
            </div>
          `;
        } else if (status !== 'flagged') {
          physicalArea.innerHTML = `
            <div class="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-center gap-2 font-medium">
              <i class="fa-solid fa-truck-ramp-box text-blue-600 text-sm"></i>
              <span>📦 Physical Order — Our team is printing and packaging your item for courier delivery.</span>
            </div>
          `;
        }
        if (physicalArea.children.length > 0 || physicalArea.innerHTML.trim() !== '') {
          itemEl.appendChild(physicalArea);
        }
      } else {
        const canvaArea = document.createElement('div');
        canvaArea.className = 'mt-3 pt-3 border-t border-pink-100';

        if (item.canva_link || order.canva_link) {
          const link = item.canva_link || order.canva_link;
          canvaArea.innerHTML = `
            <a href="${link}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg no-underline transition-colors shadow-sm">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>Open Canva Template</span>
            </a>
          `;
        } else {
          canvaArea.innerHTML = `
            <p class="text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
              ⏳ Admin will deliver your Canva Template link shortly.
            </p>
          `;
        }
        itemEl.appendChild(canvaArea);
      }
    }

    itemsContainer.appendChild(itemEl);
  });

  return card;
}
