import { getFirebaseServices } from '../services/firebase-service.js';
import { updateUserProfileInfo, openAuthModal } from '../services/auth-service.js';
import { renderPhotoUploadUI } from '../components/photo-upload.js';
import { createToast, qs } from '../utils/ui.js';

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
  const photoUrlInput = qs('#profile-photo-url');
  const emailInput = qs('#profile-email');
  const phoneInput = qs('#profile-phone');
  const avatarImg = qs('#profile-avatar-img');
  const avatarInitials = qs('#profile-avatar-initials');

  const name = user.displayName || user.email?.split('@')[0] || 'User';
  if (displayNameHeader) displayNameHeader.textContent = name;
  if (emailHeader) emailHeader.textContent = user.email || '';
  if (nameInput) nameInput.value = user.displayName || '';
  if (photoUrlInput) photoUrlInput.value = user.photoURL || '';
  if (emailInput) emailInput.value = user.email || '';
  if (phoneInput) phoneInput.value = user.phoneNumber || '';

  if (user.photoURL) {
    if (avatarImg) {
      avatarImg.src = user.photoURL;
      avatarImg.classList.remove('hidden');
    }
    if (avatarInitials) avatarInitials.classList.add('hidden');
  } else {
    if (avatarImg) avatarImg.classList.add('hidden');
    if (avatarInitials) {
      avatarInitials.textContent = name.charAt(0).toUpperCase();
      avatarInitials.classList.remove('hidden');
    }
  }
}

function bindProfileForm(user) {
  const form = qs('#profile-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const displayName = qs('#profile-name')?.value.trim();
    const photoURL = qs('#profile-photo-url')?.value.trim();
    const phoneNumber = qs('#profile-phone')?.value.trim();

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await updateUserProfileInfo({ displayName, photoURL });
      createToast('Profile updated successfully.');
      populateProfileData({ ...user, displayName, photoURL, phoneNumber });
    } catch (err) {
      console.error('Failed to update profile:', err);
      createToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };
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

    const snapshot = await db.collection('purchases')
      .where('user_id', '==', user.uid)
      .get();

    let orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    if (orders.length === 0 && (user.phoneNumber || user.email)) {
      const altSnap = await db.collection('purchases').get();
      altSnap.forEach(doc => {
        const d = doc.data();
        if (d.customer_phone === user.phoneNumber || (user.email && d.customer_email === user.email)) {
          if (!orders.some(o => o.id === doc.id)) {
            orders.push({ id: doc.id, ...d });
          }
        }
      });
    }

    orders.sort((a, b) => {
      const da = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
      const db = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
      return db - da;
    });

    loadingState.classList.add('hidden');

    if (ordersBadge) {
      ordersBadge.textContent = orders.length;
      ordersBadge.classList.remove('hidden');
    }

    if (orders.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    listContainer.innerHTML = '';
    listContainer.classList.remove('hidden');

    orders.forEach(order => {
      const orderCard = renderOrderCard(order);
      listContainer.appendChild(orderCard);
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

  if (status === 'paid') {
    statusBadge = `<span class="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full">✅ Payment Verified</span>`;
  } else if (status === 'delivered') {
    statusBadge = `<span class="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-full">🚀 Delivered</span>`;
  } else if (status === 'completed') {
    statusBadge = `<span class="px-3 py-1 bg-gray-100 text-gray-800 border border-gray-200 text-xs font-bold rounded-full">🎉 Completed</span>`;
  }

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

    const isMagazine = item.product_type === 'magazine' || (!item.product_type && !item.canva_link);
    const recipientText = item.recipient_name ? ` (Recipient: ${item.recipient_name})` : '';

    itemEl.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <i class="${isMagazine ? 'fa-solid fa-book-open text-primary' : 'fa-solid fa-file-code text-teal-600'} text-lg"></i>
          <span class="font-bold text-sm text-gray-800">${item.template_name || 'Magazine Item'}${recipientText}</span>
        </div>
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isMagazine ? 'bg-purple-100 text-purple-800' : 'bg-teal-100 text-teal-800'}">
          ${isMagazine ? 'Magazine' : 'Template'}
        </span>
      </div>
    `;

    if (isMagazine) {
      const uploadArea = document.createElement('div');
      uploadArea.className = 'mt-3 pt-3 border-t border-pink-100';

      const isPaid = status === 'paid' || status === 'delivered' || status === 'completed';
      const itemOrderId = item.item_id || `${order.id || order.order_id}-${index + 1}`;

      if (!isPaid) {
        uploadArea.innerHTML = `
          <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <i class="fa-solid fa-clock text-amber-600 text-sm"></i>
            <span>Payment Verification Pending — Photo upload will unlock automatically once your payment is verified by Admin.</span>
          </div>
        `;
      } else {
        renderPhotoUploadUI(uploadArea, {
          orderId: itemOrderId,
          requiredPhotoCount: item.required_photo_count || 10,
          photosUploaded: item.photos_uploaded || false,
          onSuccess: () => {
            createToast(`Photos uploaded for ${item.template_name || 'item'}!`);
            item.photos_uploaded = true;
            loadUserOrders(currentActiveUser);
          }
        });
      }
      itemEl.appendChild(uploadArea);
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
