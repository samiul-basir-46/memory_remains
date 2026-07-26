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

async function loadUserOrders(user) {
  const loadingState = qs('#orders-loading-state');
  const emptyState = qs('#orders-empty-state');
  const listContainer = qs('#orders-list-container');
  const ordersBadge = qs('#my-orders-badge');

  if (!loadingState || !emptyState || !listContainer) return;

  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  listContainer.classList.add('hidden');

  try {
    const { db } = getFirebaseServices();
    if (!db) return;

    if (window.__userOrdersUnsub) {
      window.__userOrdersUnsub();
      window.__userOrdersUnsub = null;
    }

    window.__userOrdersUnsub = db.collection('purchases').onSnapshot((snapshot) => {
      let orders = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        const matchesUser = (user.uid && (d.user_id === user.uid || d.userId === user.uid)) ||
                            (user.email && (d.email === user.email || d.customer_email === user.email)) ||
                            (user.phoneNumber && (d.customer_phone === user.phoneNumber || d.customerPhone === user.phoneNumber));

        if (matchesUser) {
          orders.push({ id: doc.id, order_id: doc.id, ...d });
        }
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

      if (orders.length === 0) {
        emptyState.classList.remove('hidden');
        listContainer.classList.add('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      listContainer.innerHTML = '';
      listContainer.classList.remove('hidden');

      orders.forEach(order => {
        const orderCard = renderOrderCard(order);
        listContainer.appendChild(orderCard);
      });
    });

  } catch (err) {
    console.error('Failed to load orders:', err);
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    createToast('Failed to load orders.', 'error');
  }
}

function renderOrderCard(order) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-2xl border border-pink-100 p-6 shadow-sm space-y-4';

  const status = (order.status || 'pending').toLowerCase();
  let statusBadge = `<span class="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-full">⏳ Payment Pending</span>`;

  if (status === 'confirmed' || status === 'paid') {
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

    if (isMagazine) {
      const uploadArea = document.createElement('div');
      uploadArea.className = 'mt-3 pt-3 border-t border-pink-100';

      const isPaid = ['paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed'].includes(status);
      const mainOrderId = order.id || order.order_id || order.orderId;

      const itemUploaded = Boolean(item.photos_uploaded || item.photosUploaded || order.photos_uploaded || order.photosUploaded);

      if (!isPaid) {
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
      } else {
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
      itemEl.appendChild(uploadArea);
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
      } else {
        physicalArea.innerHTML = `
          <div class="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-center gap-2 font-medium">
            <i class="fa-solid fa-truck-ramp-box text-blue-600 text-sm"></i>
            <span>📦 Physical Order — Our team is printing and packaging your item for courier delivery.</span>
          </div>
        `;
      }
      itemEl.appendChild(physicalArea);
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

    itemsContainer.appendChild(itemEl);
  });

  return card;
}
