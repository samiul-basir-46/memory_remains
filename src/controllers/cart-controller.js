import { getCart, setCart, updateCartCount, clearCart } from '../services/cart-service.js';
import { formatCurrency, escapeHtml, qs, createToast } from '../utils/ui.js';
import { imageMarkup } from '../components/product-card.js';
import { getFirebaseServices } from '../services/firebase-service.js';
import { renderPhotoUploadUI } from '../components/photo-upload.js';
import { openAuthModal, waitForAuthUser } from '../services/auth-service.js';
import { getCurrentGpsLocation, detectDeliveryZone } from '../services/location-service.js';

const API_BASE = "https://bkash-sms-gateway.onrender.com";
const DELIVERY_CHARGE = 60;
const WHATSAPP_NUMBER = "8801622000471";
const BKASH_NUMBER = "01632788802";

let activePollingTimer = null;
let currentAttemptCount = 0;
const MAX_ATTEMPTS = 20;

function generateShortOrderId() {
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `ORD-${randomDigits}`;
}

function doesItemNeedPhotos(item) {
  if (!item) return false;
  const pType = item.product_type || item.productType || (item.purchaseMode === 'poster' ? 'poster' : (item.purchaseMode === 'wall_frame' ? 'wall_frame' : (item.purchaseMode === 'sticker' ? 'sticker' : 'magazine')));
  if (pType === 'template' || item.purchaseMode === 'template' || pType === 'poster' || pType === 'sticker') {
    return false;
  }
  const hasUploaded = Boolean(item.photos_uploaded || item.photosUploaded || (Array.isArray(item.photo_urls) && item.photo_urls.length > 0));
  return !hasUploaded;
}

export function resolvePagePhotoLimits(pages, item = {}) {
  const p = Number(pages || item.pageCount || item.pages || 8);
  let minPhotos = Number(item.minPhotos || item.min_photos || 0);
  let maxPhotos = Number(item.maxPhotos || item.max_photos || 0);

  // If already specified by admin in Firestore tier or item, strictly respect admin values!
  if (minPhotos > 0 && maxPhotos > 0) {
    return { minPhotos, maxPhotos };
  }

  // Fallbacks only when unset in admin dashboard
  if (p === 4) { minPhotos = minPhotos || 8; maxPhotos = maxPhotos || 15; }
  else if (p === 8) { minPhotos = minPhotos || 15; maxPhotos = maxPhotos || 22; }
  else if (p === 12) { minPhotos = minPhotos || 25; maxPhotos = maxPhotos || 32; }
  else if (p === 16) { minPhotos = minPhotos || 35; maxPhotos = maxPhotos || 45; }
  else if (p === 20) { minPhotos = minPhotos || 50; maxPhotos = maxPhotos || 60; }
  else if (p === 24) { minPhotos = minPhotos || 60; maxPhotos = maxPhotos || 70; }
  else {
    minPhotos = minPhotos || Math.max(1, p * 2);
    maxPhotos = maxPhotos || Math.max(minPhotos, p * 3);
  }
  return { minPhotos, maxPhotos };
}

function renderCheckoutStepper(activeStep = 1, hasPhotoStep = true) {
  return `
    <div class="max-w-2xl mx-auto mb-8 px-2">
      <div class="flex items-center justify-between relative">
        <div class="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-pink-100 w-full z-0"></div>
        <div class="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#C97B5F] transition-all duration-300 z-0" style="width: ${activeStep === 1 ? '0%' : (activeStep === 2 ? '50%' : '100%')}"></div>

        ${hasPhotoStep ? `
          <div class="relative z-10 flex flex-col items-center">
            <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${activeStep === 1 ? 'bg-[#C97B5F] text-white ring-4 ring-pink-200' : (activeStep > 1 ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-gray-300 text-gray-500')}">
              ${activeStep > 1 ? '<i class="fa-solid fa-check"></i>' : '1'}
            </div>
            <span class="text-[11px] font-bold mt-1.5 ${activeStep === 1 ? 'text-[#C97B5F]' : 'text-gray-600'}">Photos</span>
          </div>
        ` : ''}

        <div class="relative z-10 flex flex-col items-center">
          <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${activeStep === 2 ? 'bg-[#C97B5F] text-white ring-4 ring-pink-200' : (activeStep > 2 ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-gray-300 text-gray-500')}">
            ${activeStep > 2 ? '<i class="fa-solid fa-check"></i>' : (hasPhotoStep ? '2' : '1')}
          </div>
          <span class="text-[11px] font-bold mt-1.5 ${activeStep === 2 ? 'text-[#C97B5F]' : 'text-gray-600'}">Delivery</span>
        </div>

        <div class="relative z-10 flex flex-col items-center">
          <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${activeStep === 3 ? 'bg-[#C97B5F] text-white ring-4 ring-pink-200' : 'bg-white border-2 border-gray-300 text-gray-500'}">
            ${hasPhotoStep ? '3' : '2'}
          </div>
          <span class="text-[11px] font-bold mt-1.5 ${activeStep === 3 ? 'text-[#C97B5F]' : 'text-gray-600'}">Payment</span>
        </div>
      </div>
    </div>
  `;
}

export async function renderCartPage(dbInstance) {
  const db = dbInstance || getFirebaseServices().db;
  const container = qs('#cart-page-app');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const existingOrderId = urlParams.get('order_id');

  if (existingOrderId) {
    await handlePageRefreshRecovery(db, existingOrderId);
    return;
  }

  const isDirectCheckout = urlParams.get('checkout') === 'direct';
  const cart = getCart();

  if (isDirectCheckout && cart.length > 0) {
    let subtotal = 0;
    cart.forEach(item => {
      subtotal += Number(item.price || 0) * Number(item.quantity || 1);
    });
    await initiateCheckout(db, subtotal);
    return;
  }

  renderCartState(db);
}

function renderCartState(db) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="max-w-md mx-auto py-16 px-4 text-center">
        <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-primary text-3xl shadow-sm">
          <i class="fa-solid fa-bag-shopping"></i>
        </div>
        <h2 class="font-heading text-2xl md:text-3xl text-[#2A2A2A] font-normal mb-2">Why so light! :(</h2>
        <h3 class="text-xl text-[#2A2A2A] font-semibold mb-2">Your cart is empty</h3>
        <p class="text-text-soft text-sm mb-8">Looks like you haven't added anything yet</p>
        <a href="/collections/paid-products" class="inline-flex items-center justify-center px-8 py-3.5 bg-[#C97B5F] text-white font-bold text-sm rounded-xl shadow-md transition-colors no-underline" style="background-color: #C97B5F !important; color: #ffffff !important;">Discover Products</a>
      </div>
    `;
    return;
  }

  let subtotal = 0;
  const itemsMarkup = cart.map((item, index) => {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.quantity || 1);
    const lineTotal = itemPrice * itemQty;
    subtotal += lineTotal;

    const { minPhotos: minP, maxPhotos: maxP } = resolvePagePhotoLimits(item.pageCount || item.pages || 8, item);
    const isMag = item.product_type === 'magazine' || item.purchaseMode === 'magazine' || (!item.purchaseMode && item.product_type !== 'template' && item.product_type !== 'poster');
    const hasUploadedPhotos = Boolean(item.photos_uploaded || item.photosUploaded || (Array.isArray(item.photo_urls) && item.photo_urls.length > 0));

    return `
      <div class="cart-item-card bg-white p-4 md:p-5 rounded-2xl border border-pink-100/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <div class="w-20 h-20 rounded-xl bg-[#1a1a1a] overflow-hidden flex-shrink-0">
          ${imageMarkup(item.imageUrl, item.title, 'w-full h-full object-cover')}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-heading text-base font-semibold text-[#2A2A2A] mb-1 truncate">${escapeHtml(item.title)}</h4>
          <p class="text-sm text-text-soft mb-1">Unit Price: <span class="font-semibold text-[#2A2A2A]">৳${itemPrice}</span></p>
          ${isMag ? `
            <div class="mb-2 flex items-center gap-2 flex-wrap">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${hasUploadedPhotos ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-pink-50 text-pink-900 border border-pink-200'}">
                ${hasUploadedPhotos ? `✓ ${item.photo_urls ? item.photo_urls.length : 'All'} Photos Attached` : `📸 Requires ${minP === maxP ? maxP : `${minP}–${maxP}`} Photos`}
              </span>
            </div>
          ` : ''}
          <div class="flex items-center gap-3">
            <div class="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <button type="button" onclick="window.__updateCartQty(${index}, ${itemQty - 1})" class="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer font-bold text-sm" ${itemQty <= 1 ? 'disabled' : ''}>-</button>
              <span class="w-10 text-center font-bold text-sm text-[#2A2A2A]">${itemQty}</span>
              <button type="button" onclick="window.__updateCartQty(${index}, ${itemQty + 1})" class="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer font-bold text-sm">+</button>
            </div>
            <button type="button" onclick="window.__removeCartItem(${index})" class="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer">
              <i class="fa-regular fa-trash-can"></i>
              <span>Remove</span>
            </button>
          </div>
        </div>
        <div class="text-right sm:self-center">
          <span class="text-xs text-text-soft block">Line Total</span>
          <strong class="text-lg font-bold text-[#2A2A2A]">৳${lineTotal}</strong>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="max-w-4xl mx-auto py-8 px-4">
      <h1 class="font-heading text-3xl text-[#2A2A2A] font-normal mb-8 text-center sm:text-left">Shopping Bag</h1>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2">
          ${itemsMarkup}
        </div>

        <div class="lg:col-span-1">
          <div class="bg-[#FDF0F4] p-6 rounded-2xl border border-pink-100 shadow-sm sticky top-24">
            <h3 class="font-heading text-xl text-[#2A2A2A] font-bold mb-4 border-b border-pink-200/60 pb-3">Order Summary</h3>
            <div class="space-y-3 text-sm text-[#2A2A2A] mb-6">
              <div class="flex justify-between">
                <span>Subtotal</span>
                <strong class="font-bold">৳${subtotal}</strong>
              </div>
              <div class="flex justify-between items-center">
                <span>Delivery Charge</span>
                <span class="font-bold text-xs bg-pink-100/80 text-primary px-2 py-1 rounded-lg">৳60 (Inside) / ৳110 (Outside)</span>
              </div>
              <div class="border-t border-pink-200/60 pt-3 flex justify-between text-base font-bold">
                <span>Products Subtotal</span>
                <strong class="text-primary text-xl">৳${subtotal}</strong>
              </div>
            </div>
            <button type="button" id="start-checkout-btn" class="w-full py-3.5 bg-[#C97B5F] text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center" style="background-color: #C97B5F !important; color: #ffffff !important;">Proceed to Checkout</button>
          </div>
        </div>
      </div>
    </div>
  `;

  window.__updateCartQty = (idx, newQty) => {
    let currentCart = getCart();
    if (newQty < 1) return;
    currentCart[idx].quantity = newQty;
    setCart(currentCart);
    updateCartCount();
    renderCartState(db);
  };

  window.__removeCartItem = (idx) => {
    let currentCart = getCart();
    currentCart.splice(idx, 1);
    setCart(currentCart);
    updateCartCount();
    renderCartState(db);
  };

  qs('#start-checkout-btn')?.addEventListener('click', () => {
    initiateCheckout(db, subtotal);
  });
}

async function initiateCheckout(db, subtotal) {
  const currentUser = await waitForAuthUser();

  if (!currentUser) {
    createToast('Please sign in to proceed with checkout', 'error');
    openAuthModal();
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    renderCartState(db);
    return;
  }

  // Check if any item requires photo upload first
  const unUploadedIndex = cart.findIndex(item => doesItemNeedPhotos(item));

  if (unUploadedIndex >= 0) {
    renderPreCheckoutPhotoUpload(db, subtotal, unUploadedIndex);
  } else {
    renderCheckoutForm(db, subtotal);
  }
}

function renderPreCheckoutPhotoUpload(db, subtotal, itemIndex = 0) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const cart = getCart();
  const item = cart[itemIndex];
  if (!item) {
    renderCheckoutForm(db, subtotal);
    return;
  }

  const itemsNeedingPhotos = cart.filter(it => it.product_type === 'magazine' || it.purchaseMode === 'magazine');
  const totalItemsCount = itemsNeedingPhotos.length;
  const currentItemNumber = cart.slice(0, itemIndex + 1).filter(it => it.product_type === 'magazine' || it.purchaseMode === 'magazine').length;

  const pageCount = Number(item.pageCount || item.pages || 8);
  const { minPhotos, maxPhotos } = resolvePagePhotoLimits(pageCount, item);
  const title = item.title || 'Custom Magazine';

  container.innerHTML = `
    <div class="max-w-2xl mx-auto py-8 px-4 space-y-6">
      ${renderCheckoutStepper(1, true)}

      <div class="bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-amber-500/10 p-5 rounded-2xl border border-pink-200 flex items-center justify-between gap-4">
        <div>
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#C97B5F] bg-pink-100 px-2.5 py-0.5 rounded-full border border-pink-200">
            ${totalItemsCount > 1 ? `Item ${currentItemNumber} of ${totalItemsCount} • Photo Customization` : 'Step 1 of 3: Photo Customization'}
          </span>
          <h3 class="font-heading text-lg sm:text-xl font-bold text-gray-900 mt-1">${escapeHtml(title)}</h3>
          <p class="text-xs text-gray-600 mt-0.5">Please upload required photos for this item before proceeding to delivery.</p>
        </div>
        <div class="text-right flex-shrink-0">
          <span class="text-xs font-bold text-primary block">Required</span>
          <strong class="text-sm sm:text-base font-extrabold text-gray-900">${minPhotos === maxPhotos ? `${maxPhotos} Photos` : `${minPhotos}–${maxPhotos} Photos`}</strong>
        </div>
      </div>

      <div id="pre-checkout-photo-mount"></div>

      <div class="text-center pt-2">
        <button type="button" id="pre-upload-back-to-bag-btn" class="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-primary transition-colors cursor-pointer">
          <i class="fa-solid fa-arrow-left"></i>
          <span>Return to Shopping Bag</span>
        </button>
      </div>
    </div>
  `;

  qs('#pre-upload-back-to-bag-btn')?.addEventListener('click', () => {
    renderCartState(db);
  });

  const mountEl = qs('#pre-checkout-photo-mount');
  if (mountEl) {
    const isLastUploadItem = (totalItemsCount <= 1 || currentItemNumber >= totalItemsCount);
    renderPhotoUploadUI(mountEl, {
      orderId: `PRE-${Date.now()}-${itemIndex}`,
      minPhotos,
      maxPhotos,
      pageCount,
      recipientName: item.recipient_name || '',
      isPreCheckout: true,
      submitButtonText: isLastUploadItem
        ? `Upload & Continue to Delivery (${minPhotos === maxPhotos ? maxPhotos : `${minPhotos}–${maxPhotos}`} Photos)`
        : `Upload & Next Item Photos (${minPhotos === maxPhotos ? maxPhotos : `${minPhotos}–${maxPhotos}`} Photos)`,
      onSuccess: (uploadResult) => {
        const freshCart = getCart();
        if (freshCart[itemIndex]) {
          freshCart[itemIndex].photos_uploaded = true;
          freshCart[itemIndex].photosUploaded = true;
          freshCart[itemIndex].photo_urls = uploadResult.allUrls;
          freshCart[itemIndex].photoUrls = uploadResult.allUrls;
          freshCart[itemIndex].imageUrls = uploadResult.allUrls;
          freshCart[itemIndex].cover_url = uploadResult.coverUrl;
          freshCart[itemIndex].cover_photo_url = uploadResult.coverUrl;
          freshCart[itemIndex].back_url = uploadResult.backUrl;
          freshCart[itemIndex].back_photo_url = uploadResult.backUrl;
          freshCart[itemIndex].inner_urls = uploadResult.innerUrls;
          freshCart[itemIndex].inner_photo_urls = uploadResult.innerUrls;
          if (uploadResult.recipientName) {
            freshCart[itemIndex].recipient_name = uploadResult.recipientName;
            freshCart[itemIndex].recipientName = uploadResult.recipientName;
          }
          setCart(freshCart);
        }
        createToast('Photos uploaded successfully!', 'success');
        initiateCheckout(db, subtotal);
      }
    });
  }
}

function renderCheckoutForm(db, subtotal) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const cart = getCart();
  const hasPhysicalDelivery = cart.some(item => item.product_type === 'poster' || item.product_type === 'wall_frame' || item.product_type === 'sticker' || item.purchaseMode === 'magazine' || (!item.purchaseMode && item.product_type !== 'template'));
  const hasPoster = cart.some(item => item.product_type === 'poster');
  const hasMagazine = cart.some(item => item.product_type === 'magazine' || item.purchaseMode === 'magazine' || (!item.purchaseMode && item.product_type !== 'template' && item.product_type !== 'poster'));

  // Collect uploaded photos count
  let totalUploadedPhotos = 0;
  cart.forEach(it => {
    if (Array.isArray(it.photo_urls)) totalUploadedPhotos += it.photo_urls.length;
  });

  let currentDeliveryCharge = hasPhysicalDelivery ? 60 : 0;
  let currentZoneInfo = { zone: 'inside_dhaka', charge: 60, label: 'Inside Dhaka', isInside: true };

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      ${renderCheckoutStepper(2, hasMagazine)}

      <button type="button" id="back-to-cart-btn" class="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-text-dark hover:text-primary transition-colors cursor-pointer">
        <i class="fa-solid fa-arrow-left"></i>
        <span>Back to Shopping Bag</span>
      </button>

      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-5">
        <div>
          <h2 class="font-heading text-2xl text-[#2A2A2A] font-bold">Delivery & Contact Details</h2>
          <p class="text-xs text-gray-500 mt-1">Please provide your shipping and contact information.</p>
        </div>

        ${hasMagazine && totalUploadedPhotos > 0 ? `
          <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950">
            <div class="flex items-center gap-2 font-bold">
              <i class="fa-solid fa-circle-check text-emerald-600 text-base"></i>
              <span>${totalUploadedPhotos} Photos Attached</span>
            </div>
            <span class="text-[11px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">Ready for Print</span>
          </div>
        ` : ''}

        <form id="checkout-submit-form" class="space-y-5">
          <div>
            <label class="block text-xs font-bold text-[#2A2A2A] mb-1.5">Full Name *</label>
            <input type="text" id="cust-name" required placeholder="Enter your full name" class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
          </div>

          <div>
            <label class="block text-xs font-bold text-[#2A2A2A] mb-1.5">Phone Number (Bangladeshi Format) *</label>
            <input type="tel" id="cust-phone" required placeholder="e.g. 01712345678" class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
            <p id="phone-error-text" class="text-xs text-amber-600 mt-1 hidden">Please enter a valid 11-digit Bangladeshi mobile number starting with 01.</p>
          </div>

          ${hasPhysicalDelivery ? `
            <!-- DELIVERY LOCATION SECTION FOR PHYSICAL PURCHASES -->
            <div id="delivery-location-section" class="pt-4 border-t border-pink-100 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <i class="fa-solid fa-location-dot text-primary"></i>
                  <span>Delivery Location Details</span>
                </h3>
                <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">🚚 Home Delivery</span>
              </div>

              <!-- DYNAMIC ZONE DETECTION DISPLAY BANNER -->
              <div id="delivery-zone-box" class="p-3.5 rounded-xl transition-all duration-300 flex items-center justify-between border bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-sm">
                <div class="flex items-center gap-2.5">
                  <i id="delivery-zone-icon" class="fa-solid fa-city text-emerald-600 text-lg"></i>
                  <div>
                    <div class="flex items-center gap-2">
                      <span id="delivery-zone-name" class="font-bold text-xs">Inside Dhaka Delivery Zone</span>
                      <span id="delivery-zone-tag" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">৳60 Delivery</span>
                    </div>
                    <span id="delivery-zone-desc" class="text-[11px] text-emerald-700 block mt-0.5">Inside Dhaka Delivery Charge: <strong>৳60</strong></span>
                  </div>
                </div>
                <div class="text-right">
                  <span id="delivery-charge-amount" class="text-sm font-extrabold text-emerald-800">৳60</span>
                </div>
              </div>

              <!-- Option 1: Quick Auto GPS Button -->
              <button type="button" id="checkout-use-gps-btn" class="w-full py-2.5 px-4 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-primary font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                <i class="fa-solid fa-location-crosshairs text-sm text-primary"></i>
                <span id="checkout-gps-btn-text">🎯 Auto Detect My Current Location (GPS)</span>
              </button>

              <div class="relative flex py-0.5 items-center">
                <div class="flex-grow border-t border-pink-100"></div>
                <span class="flex-shrink mx-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">or fill address manually</span>
                <div class="flex-grow border-t border-pink-100"></div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-[#2A2A2A] mb-1">Division *</label>
                  <select id="cust-division" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm bg-white outline-none focus:border-primary">
                    <option value="Dhaka" selected>Dhaka</option>
                    <option value="Chattogram">Chattogram</option>
                    <option value="Rajshahi">Rajshahi</option>
                    <option value="Khulna">Khulna</option>
                    <option value="Barishal">Barishal</option>
                    <option value="Sylhet">Sylhet</option>
                    <option value="Rangpur">Rangpur</option>
                    <option value="Mymensingh">Mymensingh</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-[#2A2A2A] mb-1">District *</label>
                  <input type="text" id="cust-district" required placeholder="e.g. Dhaka, Gazipur, Chittagong" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-[#2A2A2A] mb-1">Upazila / Police Station / Area *</label>
                  <input type="text" id="cust-upazila" required placeholder="e.g. Uttara, Dhanmondi, Savar" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
                </div>
                <div>
                  <label class="block text-xs font-bold text-[#2A2A2A] mb-1">Postal Code (Optional)</label>
                  <input type="text" id="cust-postal" placeholder="e.g. 1230" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#2A2A2A] mb-1">Detailed House & Street Address *</label>
                <textarea id="cust-address" required rows="2" placeholder="e.g. House 12, Road 5, Block B, Uttara" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary resize-none"></textarea>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#2A2A2A] mb-1">Special Delivery Note (Optional)</label>
                <input type="text" id="cust-note" placeholder="e.g. Call before delivery" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
              </div>
            </div>
          ` : `
            <!-- DIGITAL TEMPLATE NOTICE (No Physical Delivery Required) -->
            <div id="digital-delivery-notice-box" class="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 space-y-1">
              <div class="flex items-center gap-2 font-bold text-sm text-purple-700">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span>Digital Product Order</span>
              </div>
              <p class="font-medium">This is a digital product and does not require delivery information.</p>
            </div>
          `}

          <div>
            <label class="block text-xs font-bold text-[#2A2A2A] mb-2">Payment Method *</label>
            <div class="grid grid-cols-2 gap-3">
              <label class="payment-option-label border-2 border-primary bg-pink-50/50 p-4 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center">
                <input type="radio" name="payment_method" value="cod" checked class="accent-primary">
                <span class="text-xs font-bold text-[#2A2A2A]">Cash on Delivery</span>
              </label>
              <label class="payment-option-label border-2 border-gray-200 bg-white p-4 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center">
                <input type="radio" name="payment_method" value="online" class="accent-primary">
                <span class="text-xs font-bold text-[#2A2A2A]">Pay Online (bKash)</span>
              </label>
            </div>
          </div>

          <div id="payment-amount-box" class="p-4 rounded-xl bg-[#FDF0F4] border border-pink-200 text-xs text-[#2A2A2A] space-y-1">
            <p id="amount-note-text" class="font-semibold text-primary text-sm"></p>
          </div>

          <div id="checkout-error-msg" class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 hidden"></div>

          <button type="submit" id="place-order-btn" class="w-full py-3.5 bg-[#C97B5F] text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center" style="background-color: #C97B5F !important; color: #ffffff !important;">Proceed to Payment Screen</button>
        </form>
      </div>
    </div>
  `;

  qs('#back-to-cart-btn')?.addEventListener('click', () => renderCartState(db));

  // Reactive Zone Detection and Charge Calculation Helper
  const updateCheckoutZone = () => {
    if (!hasPhysicalDelivery) {
      currentDeliveryCharge = 0;
      return;
    }

    const division = qs('#cust-division')?.value || 'Dhaka';
    const district = qs('#cust-district')?.value || '';
    const upazila = qs('#cust-upazila')?.value || '';
    const address = qs('#cust-address')?.value || '';

    currentZoneInfo = detectDeliveryZone({ division, district, upazila, address });
    currentDeliveryCharge = currentZoneInfo.charge;

    const zoneBox = qs('#delivery-zone-box');
    const zoneIcon = qs('#delivery-zone-icon');
    const zoneName = qs('#delivery-zone-name');
    const zoneTag = qs('#delivery-zone-tag');
    const zoneDesc = qs('#delivery-zone-desc');
    const chargeAmt = qs('#delivery-charge-amount');
    const amountNoteEl = qs('#amount-note-text');

    if (zoneBox) {
      if (currentZoneInfo.isInside) {
        zoneBox.className = 'p-3.5 rounded-xl transition-all duration-300 flex items-center justify-between border bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-sm';
        if (zoneIcon) zoneIcon.className = 'fa-solid fa-city text-emerald-600 text-lg';
        if (zoneName) zoneName.textContent = 'Inside Dhaka Delivery Zone';
        if (zoneTag) {
          zoneTag.textContent = '৳60 Delivery';
          zoneTag.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white';
        }
        if (zoneDesc) zoneDesc.innerHTML = 'Inside Dhaka Delivery Charge: <strong>৳60</strong>';
        if (chargeAmt) chargeAmt.textContent = '৳60';
      } else {
        zoneBox.className = 'p-3.5 rounded-xl transition-all duration-300 flex items-center justify-between border bg-amber-50/90 border-amber-300 text-amber-950 shadow-sm';
        if (zoneIcon) zoneIcon.className = 'fa-solid fa-truck-ramp-box text-amber-600 text-lg';
        if (zoneName) zoneName.textContent = 'Outside Dhaka Delivery Zone';
        if (zoneTag) {
          zoneTag.textContent = '৳110 Delivery';
          zoneTag.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white';
        }
        if (zoneDesc) zoneDesc.innerHTML = 'Outside Dhaka Courier Charge: <strong>৳110</strong>';
        if (chargeAmt) chargeAmt.textContent = '৳110';
      }
    }

    const selectedMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';
    const totalAmount = subtotal + currentDeliveryCharge;

    if (amountNoteEl) {
      if (selectedMethod === 'cod') {
        amountNoteEl.innerHTML = `You need to pay <strong class="text-primary font-bold">৳${currentDeliveryCharge}</strong> delivery charge in advance via bKash to confirm this order.<br><span class="text-xs font-normal text-gray-700 mt-1 block">Products: ৳${subtotal} (payable on delivery) + Delivery (${currentZoneInfo.label}): ৳${currentDeliveryCharge} (payable now).</span>`;
      } else {
        amountNoteEl.innerHTML = `Total to pay: <strong class="text-primary font-bold">৳${totalAmount}</strong> (Products: ৳${subtotal} + Delivery [${currentZoneInfo.label}]: ৳${currentDeliveryCharge})`;
      }
    }
  };

  // Pre-fill delivery location if saved in header modal
  if (hasPhysicalDelivery) {
    try {
      const savedRaw = localStorage.getItem('user_delivery_location');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved.division && qs('#cust-division')) qs('#cust-division').value = saved.division;
        if (saved.district && qs('#cust-district')) qs('#cust-district').value = saved.district;
        if (saved.upazila && qs('#cust-upazila')) qs('#cust-upazila').value = saved.upazila;
        if (saved.address && qs('#cust-address')) qs('#cust-address').value = saved.address;
        if (saved.postalCode && qs('#cust-postal')) qs('#cust-postal').value = saved.postalCode;
      }
    } catch (_) { }

    // Attach listeners for real-time address detection
    ['#cust-division', '#cust-district', '#cust-upazila', '#cust-address'].forEach((selector) => {
      const el = qs(selector);
      if (el) {
        el.addEventListener('input', updateCheckoutZone);
        el.addEventListener('change', updateCheckoutZone);
        el.addEventListener('blur', updateCheckoutZone);
      }
    });

    updateCheckoutZone();

    qs('#checkout-use-gps-btn')?.addEventListener('click', async () => {
      const gpsBtn = qs('#checkout-use-gps-btn');
      const gpsBtnText = qs('#checkout-gps-btn-text');
      try {
        if (gpsBtnText) gpsBtnText.textContent = '⏳ Detecting your GPS location...';
        if (gpsBtn) gpsBtn.disabled = true;

        const loc = await getCurrentGpsLocation();

        if (loc.division && qs('#cust-division')) qs('#cust-division').value = loc.division;
        if (loc.district && qs('#cust-district')) qs('#cust-district').value = loc.district;
        if (loc.upazila && qs('#cust-upazila')) qs('#cust-upazila').value = loc.upazila;
        if (loc.address && qs('#cust-address')) qs('#cust-address').value = loc.address;
        if (loc.postalCode && qs('#cust-postal')) qs('#cust-postal').value = loc.postalCode;

        updateCheckoutZone();

        if (gpsBtnText) gpsBtnText.textContent = '✅ Location Detected!';
        createToast('GPS Location detected & filled automatically!', 'success');
      } catch (err) {
        if (gpsBtnText) gpsBtnText.textContent = '🎯 Auto Detect My Current Location (GPS)';
        createToast(err.message || 'GPS location failed. Please type address manually.', 'error');
      } finally {
        if (gpsBtn) gpsBtn.disabled = false;
        setTimeout(() => {
          if (gpsBtnText) gpsBtnText.textContent = '🎯 Auto Detect My Current Location (GPS)';
        }, 3000);
      }
    });
  }

  const radios = document.querySelectorAll('input[name="payment_method"]');
  const paymentBoxes = document.querySelectorAll('.payment-option-label');

  radios.forEach((r) => {
    r.addEventListener('change', () => {
      paymentBoxes.forEach((b) => {
        const checked = b.querySelector('input').checked;
        b.className = checked
          ? 'payment-option-label border-2 border-primary bg-pink-50/50 p-4 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center'
          : 'payment-option-label border-2 border-gray-200 bg-white p-4 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center';
      });

      updateCheckoutZone();
    });
  });

  updateCheckoutZone();

  const handleProceedToPayment = () => {
    const name = qs('#cust-name')?.value.trim() || '';
    const phone = qs('#cust-phone')?.value.trim() || '';
    const selectedMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';

    if (!name) {
      createToast('Please enter your full name', 'error');
      const nameInput = qs('#cust-name');
      if (nameInput) {
        nameInput.focus();
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const phoneRegex = /^01[3-9]\d{8}$/;
    if (!phoneRegex.test(phone)) {
      qs('#phone-error-text')?.classList.remove('hidden');
      createToast('Please enter a valid 11-digit Bangladeshi mobile number (e.g. 01712345678)', 'error');
      const phoneInput = qs('#cust-phone');
      if (phoneInput) {
        phoneInput.focus();
        phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    qs('#phone-error-text')?.classList.add('hidden');

    const purchaseType = hasPoster ? 'poster' : (hasMagazine ? 'magazine' : 'template');

    if (hasPhysicalDelivery) {
      const division = qs('#cust-division')?.value || 'Dhaka';
      const district = qs('#cust-district')?.value.trim() || '';
      const upazila = qs('#cust-upazila')?.value.trim() || '';
      const address = qs('#cust-address')?.value.trim() || '';
      const postalCode = qs('#cust-postal')?.value.trim() || '';
      const note = qs('#cust-note')?.value.trim() || '';

      if (!district) {
        createToast('Please enter your delivery District (e.g. Dhaka, Gazipur)', 'error');
        const distInput = qs('#cust-district');
        if (distInput) {
          distInput.focus();
          distInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      if (!upazila) {
        createToast('Please enter your Upazila / Area / Police Station', 'error');
        const upInput = qs('#cust-upazila');
        if (upInput) {
          upInput.focus();
          upInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      if (!address || address.length < 3) {
        createToast('Please enter your Detailed House & Street Address', 'error');
        const addrInput = qs('#cust-address');
        if (addrInput) {
          addrInput.focus();
          addrInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Save to localStorage for convenience next time
      try {
        localStorage.setItem('user_delivery_location', JSON.stringify({ division, district, upazila, address, postalCode }));
        localStorage.setItem('user_contact_info', JSON.stringify({ name, phone }));
      } catch (_) {}

      // Re-run zone detection right before submit for complete safety
      const zoneInfo = detectDeliveryZone({ division, district, upazila, address });

      renderPaymentInstructionsStep(db, {
        customer_name: name,
        customer_phone: phone,
        purchase_type: purchaseType,
        payment_method: selectedMethod,
        product_amount: subtotal,
        delivery_charge: zoneInfo.charge,
        delivery_zone: zoneInfo.zone,
        delivery_info: {
          division,
          district,
          upazila,
          address,
          postalCode,
          note,
          delivery_zone: zoneInfo.zone,
          delivery_charge: zoneInfo.charge
        }
      });
    } else {
      renderPaymentInstructionsStep(db, {
        customer_name: name,
        customer_phone: phone,
        purchase_type: 'template',
        payment_method: selectedMethod,
        product_amount: subtotal,
        delivery_charge: 0,
        delivery_zone: 'none',
        delivery_info: null
      });
    }
  };

  qs('#checkout-submit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleProceedToPayment();
  });

  qs('#place-order-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleProceedToPayment();
  });
}

function renderPaymentInstructionsStep(db, checkoutData) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const isCod = checkoutData.payment_method === 'cod';
  const productAmount = Number(checkoutData.product_amount || 0);
  const deliveryCharge = Number(checkoutData.delivery_charge || 0);
  const totalAmount = productAmount + deliveryCharge;
  const expectedAmount = isCod ? (deliveryCharge > 0 ? deliveryCharge : 60) : totalAmount;
  const zoneLabel = checkoutData.delivery_zone === 'outside_dhaka' ? 'Outside Dhaka' : (checkoutData.delivery_zone === 'none' ? 'Digital' : 'Inside Dhaka');

  const cart = getCart();
  const hasMagazine = cart.some(item => item.product_type === 'magazine' || item.purchaseMode === 'magazine' || (!item.purchaseMode && item.product_type !== 'template' && item.product_type !== 'poster'));

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      ${renderCheckoutStepper(3, hasMagazine)}

      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl">
        
        <div class="bg-[#FDF0F4] p-5 rounded-2xl border border-pink-200 text-center space-y-3 mb-6">
          <span class="text-xs text-text-soft block uppercase tracking-wider font-semibold">bKash Send Money Payment Number</span>
          <div class="flex items-center justify-center gap-3">
            <span class="text-xs text-text-soft font-medium">bKash Number:</span>
            <strong class="font-bold text-xl text-[#2A2A2A] tracking-wider">${BKASH_NUMBER}</strong>
            <button type="button" id="copy-bkash-num-btn" class="px-3 py-1.5 bg-[#C97B5F] hover:bg-[#8B4A38] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer">Copy</button>
          </div>
          <p class="text-xs sm:text-sm font-semibold text-gray-800 leading-relaxed border-t border-pink-200/60 pt-2.5 max-w-md mx-auto">
            <strong class="text-primary font-extrabold text-sm sm:text-base">Note:</strong> Please use the Copy button to copy the payment number for your safety.
          </p>
        </div>

        <!-- ORDER SUMMARY BREAKDOWN BOX -->
        <div class="bg-pink-50/60 p-4 rounded-xl border border-pink-100 text-xs space-y-2 mb-6 text-[#2A2A2A]">
          <div class="flex justify-between">
            <span class="text-gray-600">Product Price:</span>
            <span class="font-bold">৳${productAmount}</span>
          </div>
          ${checkoutData.delivery_info ? `
            <div class="flex justify-between">
              <span class="text-gray-600">Delivery Charge (${zoneLabel}):</span>
              <span class="font-bold text-primary">৳${deliveryCharge}</span>
            </div>
            <div class="flex justify-between border-t border-pink-200/60 pt-2 font-bold">
              <span>Total Order Amount:</span>
              <span class="text-primary text-sm">৳${totalAmount}</span>
            </div>
            ${isCod ? `
              <div class="flex justify-between text-emerald-800 text-[11px] font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200 mt-1">
                <span>COD Advance Delivery Charge Payment Now:</span>
                <span class="font-bold">৳${deliveryCharge} (Remaining ৳${productAmount} on delivery)</span>
              </div>
            ` : ''}
          ` : ''}
        </div>

        <div class="text-center mb-6 border-b border-pink-100 pb-6">
          <span class="text-xs text-text-soft block mb-1">${isCod ? 'Exact Delivery Charge Advance Amount to Send' : 'Exact Total Amount to Send'}</span>
          <strong class="text-3xl font-bold text-primary">৳${expectedAmount}</strong>
        </div>

        <div class="space-y-4 mb-6">
          <h4 class="font-heading text-sm font-bold text-[#2A2A2A]">Step-by-step Instructions:</h4>
          <div class="grid grid-cols-3 gap-2 text-center text-xs text-[#2A2A2A]">
            <div class="p-3 bg-pink-50/60 rounded-xl border border-pink-100">
              <div class="w-6 h-6 rounded-full bg-primary text-white font-bold mx-auto mb-1 flex items-center justify-center text-xs">1</div>
              <span>Send Money (not Payment) to the number above</span>
            </div>
            <div class="p-3 bg-pink-50/60 rounded-xl border border-pink-100">
              <div class="w-6 h-6 rounded-full bg-primary text-white font-bold mx-auto mb-1 flex items-center justify-center text-xs">2</div>
              <span>Copy your Transaction ID</span>
            </div>
            <div class="p-3 bg-pink-50/60 rounded-xl border border-pink-100">
              <div class="w-6 h-6 rounded-full bg-primary text-white font-bold mx-auto mb-1 flex items-center justify-center text-xs">3</div>
              <span>Paste it below</span>
            </div>
          </div>
        </div>

        <form id="verify-trx-form" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-[#2A2A2A] mb-1.5">bKash Transaction ID (TrxID) *</label>
            <input type="text" id="trx-id-input" required placeholder="e.g. BAX892K102" class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary uppercase">
          </div>

          <div id="verify-error-box" class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 hidden"></div>

          <button type="submit" id="confirm-payment-btn" class="w-full py-3.5 bg-[#C97B5F] text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center" style="background-color: #C97B5F !important; color: #ffffff !important;">Confirm Order</button>
        </form>
      </div>
    </div>
  `;

  qs('#copy-bkash-num-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(BKASH_NUMBER);
    const btn = qs('#copy-bkash-num-btn');
    if (btn) btn.textContent = 'Copied!';
    setTimeout(() => { if (btn) btn.textContent = 'Copy'; }, 2000);
  });

  qs('#verify-trx-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const trxId = qs('#trx-id-input').value.trim();
    if (!trxId) return;

    const confirmBtn = qs('#confirm-payment-btn');
    const errorBox = qs('#verify-error-box');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Submitting & Generating Order...';
    }
    if (errorBox) errorBox.classList.add('hidden');

    try {
      const newOrderId = generateShortOrderId();
      const currentCart = getCart();

      let topCoverUrl = '';
      let topBackUrl = '';
      let topInnerUrls = [];
      let topAllPhotoUrls = [];
      let topRecipientName = '';

      const expandedItems = [];
      let itemCounter = 1;

      currentCart.forEach((item) => {
        const qty = Math.max(1, Number(item.quantity || 1));
        const pType = item.product_type || item.productType || (item.purchaseMode === 'poster' ? 'poster' : (item.purchaseMode === 'wall_frame' ? 'wall_frame' : (item.purchaseMode === 'sticker' ? 'sticker' : 'magazine')));
        const isPoster = pType === 'poster';
        const isFrame = pType === 'wall_frame' || pType === 'frame';
        const isSticker = pType === 'sticker';
        const isTemplate = item.purchaseMode === 'template' || pType === 'template';

        const selectedPosters = Array.isArray(item.selectedPosters) ? item.selectedPosters : [];
        const customUrls = selectedPosters.filter(s => s.type === 'custom_upload' && s.imageUrl).map(s => s.imageUrl);
        const itemPhotoUrls = Array.isArray(item.photo_urls) ? item.photo_urls : (item.photoUrls || []);

        if (item.cover_url && !topCoverUrl) topCoverUrl = item.cover_url;
        if (item.back_url && !topBackUrl) topBackUrl = item.back_url;
        if (Array.isArray(item.inner_urls) && topInnerUrls.length === 0) topInnerUrls = item.inner_urls;
        if (itemPhotoUrls.length > 0) topAllPhotoUrls.push(...itemPhotoUrls);
        if (item.recipient_name && !topRecipientName) topRecipientName = item.recipient_name;

        for (let q = 0; q < qty; q++) {
          const itemNumLabel = qty > 1 ? ` (Item ${q + 1} of ${qty})` : '';
          const itemTitle = item.title || item.name || item.template_name || (isPoster ? 'Poster Combo' : isFrame ? 'Wall Frame' : isSticker ? 'Sticker' : 'Custom Product');
          const itemId = item.id || item.template_id || item.templateId || (isPoster ? 'poster-combo' : isFrame ? 'frame-template' : isSticker ? 'sticker-template' : 'custom-item');

          if (isPoster) {
            expandedItems.push({
              item_id: `${newOrderId}-${itemCounter}`,
              template_id: itemId,
              template_name: `${itemTitle}${itemNumLabel}`,
              product_type: 'poster',
              productType: 'poster',
              combo_quantity: Number(item.comboQuantity || 5),
              comboQuantity: Number(item.comboQuantity || 5),
              customization_type: customUrls.length > 0 ? 'custom_upload' : 'catalog',
              customizationType: customUrls.length > 0 ? 'custom_upload' : 'catalog',
              photos_uploaded: true,
              photosUploaded: true,
              photo_urls: customUrls,
              photoUrls: customUrls,
              catalog_preview_url: item.imageUrl || (selectedPosters.length > 0 ? selectedPosters[0].imageUrl : ''),
              catalogPreviewUrl: item.imageUrl || (selectedPosters.length > 0 ? selectedPosters[0].imageUrl : ''),
              selected_posters: selectedPosters,
              selectedPosters: selectedPosters,
              required_photo_count: Number(item.comboQuantity || 5)
            });
          } else if (isFrame) {
            expandedItems.push({
              item_id: `${newOrderId}-${itemCounter}`,
              template_id: itemId,
              template_name: `${itemTitle}${itemNumLabel}`,
              product_type: pType,
              productType: pType,
              photos_uploaded: itemPhotoUrls.length > 0,
              photosUploaded: itemPhotoUrls.length > 0,
              photo_urls: itemPhotoUrls,
              photoUrls: itemPhotoUrls,
              recipient_name: item.recipient_name || '',
              required_photo_count: 1
            });
          } else if (isSticker) {
            expandedItems.push({
              item_id: `${newOrderId}-${itemCounter}`,
              template_id: itemId,
              template_name: `${itemTitle}${itemNumLabel}`,
              product_type: pType,
              productType: pType,
              photos_uploaded: true,
              photosUploaded: true,
              photo_urls: item.imageUrl ? [item.imageUrl] : [],
              photoUrls: item.imageUrl ? [item.imageUrl] : [],
              recipient_name: item.recipient_name || '',
              required_photo_count: 1
            });
          } else {
            const { minPhotos: itMin, maxPhotos: itMax } = resolvePagePhotoLimits(item.pageCount || item.pages || 8, item);
            expandedItems.push({
              item_id: `${newOrderId}-${itemCounter}`,
              template_id: itemId,
              template_name: `${itemTitle}${itemNumLabel}`,
              product_type: pType,
              productType: pType,
              recipient_name: item.recipient_name || '',
              required_photo_count: itMax,
              min_photos: itMin,
              max_photos: itMax,
              photos_uploaded: isTemplate || Boolean(item.photos_uploaded || itemPhotoUrls.length > 0),
              photosUploaded: isTemplate || Boolean(item.photosUploaded || itemPhotoUrls.length > 0),
              photo_urls: itemPhotoUrls,
              photoUrls: itemPhotoUrls,
              imageUrls: itemPhotoUrls,
              cover_url: item.cover_url || '',
              cover_photo_url: item.cover_url || '',
              back_url: item.back_url || '',
              back_photo_url: item.back_url || '',
              inner_urls: item.inner_urls || [],
              inner_photo_urls: item.inner_urls || []
            });
          }
          itemCounter++;
        }
      });

      if (db && typeof db.collection === 'function') {
        const currentUser = (window.firebase && window.firebase.auth) ? window.firebase.auth().currentUser : null;
        const serverTimestamp = (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue)
          ? window.firebase.firestore.FieldValue.serverTimestamp()
          : new Date();

        const deliveryInfo = checkoutData.delivery_info || null;
        const purchaseType = checkoutData.purchase_type || (deliveryInfo ? 'magazine' : 'template');
        const firstCartItem = currentCart && currentCart.length > 0 ? currentCart[0] : null;
        const derivedProductType = firstCartItem ? (firstCartItem.product_type || firstCartItem.productType || purchaseType || 'magazine') : (purchaseType || 'magazine');
        const hasAllPhotos = expandedItems.length === 0 || expandedItems.every(it => it.photos_uploaded || it.photosUploaded);

        const firestoreData = {
          orderId: newOrderId,
          purchaseType: purchaseType,
          product_type: derivedProductType,
          productType: derivedProductType,
          photos_uploaded: hasAllPhotos,
          photosUploaded: hasAllPhotos,
          cover_url: topCoverUrl,
          cover_photo_url: topCoverUrl,
          back_url: topBackUrl,
          back_photo_url: topBackUrl,
          inner_urls: topInnerUrls,
          inner_photo_urls: topInnerUrls,
          photo_urls: topAllPhotoUrls,
          imageUrls: topAllPhotoUrls,
          recipient_name: topRecipientName || '',
          recipientName: topRecipientName || '',
          transactionId: trxId,
          txnId: trxId,
          paymentMethod: checkoutData.payment_method === 'cod' ? 'bKash (COD Advance)' : 'bKash (Full Online)',
          amount: expectedAmount,
          pricePaid: expectedAmount,
          expected_amount: expectedAmount,
          expectedAmount: expectedAmount,
          expected: expectedAmount,
          user_id: currentUser?.uid || 'guest',
          userId: currentUser?.uid || currentUser?.email || checkoutData.customer_phone || 'guest',
          email: currentUser?.email || '',
          customer_name: checkoutData.customer_name,
          customerName: checkoutData.customer_name,
          customer_phone: checkoutData.customer_phone,
          customerPhone: checkoutData.customer_phone,
          customerInfo: {
            name: checkoutData.customer_name,
            phone: checkoutData.customer_phone,
            email: currentUser?.email || ''
          },
          deliveryInfo: deliveryInfo,
          delivery_note: deliveryInfo?.note || '',
          deliveryNote: deliveryInfo?.note || '',
          specialNote: deliveryInfo?.note || '',
          note: deliveryInfo?.note || '',
          delivery_address: deliveryInfo ? {
            address: deliveryInfo.address,
            district: deliveryInfo.district,
            division: deliveryInfo.division,
            upazila: deliveryInfo.upazila || '',
            postal_code: deliveryInfo.postalCode || '',
            note: deliveryInfo.note || ''
          } : null,
          address: deliveryInfo ? `${deliveryInfo.address}, ${deliveryInfo.upazila ? deliveryInfo.upazila + ', ' : ''}${deliveryInfo.district}, ${deliveryInfo.division}${deliveryInfo.postalCode ? ' (Postal: ' + deliveryInfo.postalCode + ')' : ''}` : '',
          shippingAddress: deliveryInfo ? `${deliveryInfo.address}, ${deliveryInfo.upazila ? deliveryInfo.upazila + ', ' : ''}${deliveryInfo.district}, ${deliveryInfo.division}${deliveryInfo.postalCode ? ' (Postal: ' + deliveryInfo.postalCode + ')' : ''}` : 'N/A (Digital Product Order)',
          paymentInfo: {
            method: 'bKash',
            transactionId: trxId
          },
          items: expandedItems,
          productName: checkoutData.product_name || (purchaseType === 'poster' ? 'Poster Combo Pack Order' : (purchaseType === 'template' ? 'Digital Template Order' : 'Physical Magazine Order')),
          status: 'pending',
          paymentStatus: 'pending',
          createdAt: new Date().toISOString(),
          purchaseDate: serverTimestamp
        };

        await db.collection('purchases').doc(newOrderId).set(firestoreData);
      }

      // Safely notify backend gateway
      try {
        await fetch(`${API_BASE}/submit-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: newOrderId,
            trx_id: trxId,
            customer_name: checkoutData.customer_name,
            customer_phone: checkoutData.customer_phone,
            payment_method: checkoutData.payment_method,
            product_amount: productAmount,
            delivery_charge: deliveryCharge,
            delivery_zone: checkoutData.delivery_zone,
            expected_amount: expectedAmount,
            purchase_type: checkoutData.purchase_type,
            product_name: checkoutData.product_name,
            photos_uploaded: true,
            delivery_info: checkoutData.delivery_info
          })
        });
      } catch (apiErr) {
        console.warn('Backend gateway notice:', apiErr);
      }

      // Clear the Cart
      clearCart();
      updateCartCount();

      // Render Order Placed Success Screen
      renderPaidSuccessScreen(newOrderId, checkoutData, {
        status: 'pending',
        order_id: newOrderId,
        trx_id: trxId,
        customer_name: checkoutData.customer_name,
        customer_phone: checkoutData.customer_phone,
        delivery_info: checkoutData.delivery_info,
        photos_uploaded: true,
        photosUploaded: true,
        product_type: checkoutData.purchase_type
      });

    } catch (err) {
      console.error('Order submission failed:', err);
      if (errorBox) {
        errorBox.textContent = 'Could not create order. Please check your connection and try again.';
        errorBox.classList.remove('hidden');
      }
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Order';
      }
    }
  });
}

function startVerificationPolling(db, orderId, trxId, checkoutData) {
  const container = qs('#cart-page-app');
  if (!container) return;

  container.innerHTML = `
    <div class="max-w-md mx-auto py-16 px-4 text-center space-y-6">
      <div class="w-16 h-16 border-4 border-pink-200 border-t-primary rounded-full animate-spin mx-auto"></div>
      <div>
        <h3 class="font-heading text-xl font-bold text-[#2A2A2A] mb-1">Verifying Your Payment</h3>
        <p class="text-text-soft text-sm">Please wait while we verify your transaction ID...</p>
      </div>
    </div>
  `;

  currentAttemptCount = 0;
  if (activePollingTimer) clearInterval(activePollingTimer);

  activePollingTimer = setInterval(async () => {
    currentAttemptCount++;

    if (currentAttemptCount > MAX_ATTEMPTS) {
      clearInterval(activePollingTimer);
      renderPollingTimeoutState(db, orderId, trxId);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/order-status/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const data = await res.json();
        const status = data.status;

        if (status === 'paid' || status === 'confirmed' || status === 'completed') {
          clearInterval(activePollingTimer);
          clearCart();
          updateCartCount();
          renderPaidSuccessScreen(orderId, checkoutData, data);
        } else if (status === 'flagged') {
          clearInterval(activePollingTimer);
          const reason = data.reason || data.flag_reason;
          const expected = data.expected !== undefined ? data.expected : data.expected_amount;
          const received = data.received !== undefined ? data.received : data.received_amount;

          if (reason === 'amount_mismatch') {
            renderAmountMismatchState(orderId, trxId, expected, received);
          } else if (reason === 'duplicate_trx_reuse') {
            renderDuplicateTrxState(db, orderId, trxId, checkoutData);
          } else {
            renderGenericFlaggedState(orderId, trxId);
          }
        }
      }
    } catch (_) { }
  }, 5000);
}

function renderPaidSuccessScreen(orderId, checkoutData, data = {}) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const safeOrderId = escapeHtml(orderId || '');
  const customerName = checkoutData?.customer_name || data?.customer_name || 'Customer';
  const waText = encodeURIComponent(`Order ID: ${orderId}, I have placed my order and uploaded my photos.`);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6 text-center">
        <div class="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 text-emerald-500 text-3xl rounded-full flex items-center justify-center mx-auto shadow-sm">
          <i class="fa-solid fa-circle-check"></i>
        </div>

        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block mb-2">Order Confirmed</span>
          <h2 class="font-heading text-2xl md:text-3xl text-[#2A2A2A] font-bold mb-1">Thank You, ${escapeHtml(customerName)}!</h2>
          <p class="text-text-soft text-sm">Your order and photos have been received successfully. We will process your magazine with care.</p>
        </div>

        <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-left space-y-2.5 text-xs text-[#2A2A2A]">
          <div class="flex justify-between">
            <span class="text-text-soft font-medium">Order ID</span>
            <strong class="font-bold text-sm text-[#C97B5F]">${safeOrderId}</strong>
          </div>
          ${data.trx_id || checkoutData?.transactionId ? `
            <div class="flex justify-between">
              <span class="text-text-soft font-medium">Transaction ID</span>
              <strong class="font-semibold">${escapeHtml(data.trx_id || checkoutData?.transactionId || '')}</strong>
            </div>
          ` : ''}
          <div class="flex justify-between">
            <span class="text-text-soft font-medium">Photo Status</span>
            <span class="font-bold text-emerald-700">✓ Photos Uploaded & Attached</span>
          </div>
          <div class="flex justify-between border-t border-gray-200 pt-2.5">
            <span class="text-text-soft font-medium">Order Status</span>
            <span class="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">⏳ Processing</span>
          </div>
        </div>

        <div class="space-y-3">
          <a href="/pages/profile#orders" class="w-full py-3.5 bg-[#C97B5F] hover:bg-[#8B4A38] text-white font-bold text-sm rounded-xl shadow-md transition-colors inline-flex items-center justify-center gap-2 no-underline" style="background-color: #C97B5F !important; color: #ffffff !important;">
            <i class="fa-solid fa-box-archive"></i>
            <span>View Order in My Account</span>
          </a>

          <a href="${waUrl}" target="_blank" rel="noreferrer" class="w-full py-3 bg-[#25d366] hover:bg-[#20bd5a] text-white font-bold text-sm rounded-xl shadow-sm transition-colors inline-flex items-center justify-center gap-2 no-underline">
            <i class="fa-brands fa-whatsapp text-lg"></i>
            <span>Contact on WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderPollingTimeoutState(db, orderId, trxId) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const safeOrderId = escapeHtml(orderId || '');
  const safeTrxId = escapeHtml(trxId || '');
  const waText = encodeURIComponent(`Order ID: ${orderId}, Transaction ID: ${trxId}, I need help verifying my payment`);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6 text-center">
        <div class="w-16 h-16 bg-amber-50 border-2 border-amber-200 text-amber-600 text-3xl rounded-full flex items-center justify-center mx-auto shadow-sm">
          <i class="fa-solid fa-clock"></i>
        </div>

        <div>
          <h2 class="font-heading text-2xl md:text-3xl text-[#2A2A2A] font-bold mb-2">Order Placed Successfully!</h2>
          <p class="text-text-soft text-sm">Your order and Transaction ID have been recorded. Our team will verify your payment and process your order shortly.</p>
        </div>

        <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-left space-y-3 text-sm text-[#2A2A2A]">
          <div class="flex justify-between">
            <span class="text-text-soft">Order ID</span>
            <strong class="font-semibold">${safeOrderId}</strong>
          </div>
          ${safeTrxId ? `
          <div class="flex justify-between">
            <span class="text-text-soft">Transaction ID</span>
            <strong class="font-semibold">${safeTrxId}</strong>
          </div>
          ` : ''}
          <div class="flex justify-between border-t border-gray-200 pt-3">
            <span class="text-text-soft">Status</span>
            <span class="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">⏳ Pending Admin Verification</span>
          </div>
        </div>

        <div class="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-left text-xs text-amber-900 leading-relaxed space-y-1 shadow-sm">
          <div class="flex items-center gap-1.5 text-amber-800 font-bold">
            <i class="fa-solid fa-circle-exclamation text-amber-600"></i>
            <span>Note:</span>
          </div>
          <p>If your status does not change to <strong class="font-bold text-amber-950">"Paid" / "Verified"</strong> within <strong class="font-bold text-amber-950">5 minutes</strong>, please contact our support team on <strong class="font-bold text-emerald-700">WhatsApp</strong>.</p>
        </div>

        <div class="space-y-3">
          <a href="/pages/profile#orders" class="w-full py-3.5 bg-[#C97B5F] hover:bg-[#8B4A38] text-white font-bold text-sm rounded-xl shadow-md transition-colors inline-flex items-center justify-center gap-2 no-underline" style="background-color: #C97B5F !important; color: #ffffff !important;">
            <i class="fa-solid fa-box-archive"></i>
            <span>Track Order in My Account</span>
          </a>

          <a href="${waUrl}" target="_blank" rel="noreferrer" class="w-full py-3 bg-[#25d366] hover:bg-[#20bd5a] text-white font-bold text-sm rounded-xl shadow-sm transition-colors inline-flex items-center justify-center gap-2 no-underline">
            <i class="fa-brands fa-whatsapp text-lg"></i>
            <span>Contact Support on WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderAmountMismatchState(orderId, trxId, expected, received) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const waText = encodeURIComponent(`Order ID: ${orderId}, Transaction ID: ${trxId}, Expected: ${expected}, Received: ${received}, I need help with my payment`);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6">
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm leading-relaxed">
          We received a payment, but the amount doesn't quite match what we expected. This is easy to fix — just message us on WhatsApp and we'll sort it out.
        </div>

        <div class="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
          <div>
            <span class="text-xs text-text-soft block">Expected</span>
            <strong class="text-lg font-bold text-[#2A2A2A]">৳${expected || 0}</strong>
          </div>
          <div>
            <span class="text-xs text-text-soft block">Received</span>
            <strong class="text-lg font-bold text-amber-700">৳${received || 0}</strong>
          </div>
        </div>

        <a href="${waUrl}" target="_blank" rel="noreferrer" class="w-full py-3.5 bg-[#25d366] hover:bg-[#20bd5a] text-white font-bold text-sm rounded-xl shadow-md transition-colors inline-flex items-center justify-center gap-2 no-underline">
          <i class="fa-brands fa-whatsapp text-lg"></i>
          <span>Resolve via WhatsApp</span>
        </a>
      </div>
    </div>
  `;
}

function renderDuplicateTrxState(db, orderId, trxId, checkoutData) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const waText = encodeURIComponent(`Order ID: ${orderId}, Transaction ID: ${trxId}, I need help with duplicate transaction check`);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6">
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm leading-relaxed">
          This Transaction ID appears to already be linked to another order. Please double-check it, or contact us if you believe this is a mistake.
        </div>

        <div class="space-y-3">
          <button type="button" id="re-enter-trx-btn" class="w-full py-3.5 bg-[#C97B5F] hover:bg-[#8B4A38] text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer text-center" style="background-color: #C97B5F !important; color: #ffffff !important;">Try Another Transaction ID</button>

          <a href="${waUrl}" target="_blank" rel="noreferrer" class="w-full py-3 bg-[#25d366] hover:bg-[#20bd5a] text-white font-bold text-sm rounded-xl shadow-sm transition-colors inline-flex items-center justify-center gap-2 no-underline">
            <i class="fa-brands fa-whatsapp text-lg"></i>
            <span>Contact on WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  `;

  qs('#re-enter-trx-btn')?.addEventListener('click', () => {
    renderPaymentInstructionsStep(db, checkoutData || { payment_method: 'cod' });
  });
}

function renderGenericFlaggedState(orderId, trxId) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const waText = encodeURIComponent(`Order ID: ${orderId}, Transaction ID: ${trxId}, I need help with my payment verification`);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6">
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm leading-relaxed">
          We couldn't verify this transaction automatically. Message us on WhatsApp and we'll verify it manually within minutes.
        </div>

        <a href="${waUrl}" target="_blank" rel="noreferrer" class="w-full py-3.5 bg-[#25d366] hover:bg-[#20bd5a] text-white font-bold text-sm rounded-xl shadow-md transition-colors inline-flex items-center justify-center gap-2 no-underline">
          <i class="fa-brands fa-whatsapp text-lg"></i>
          <span>Verify via WhatsApp</span>
        </a>
      </div>
    </div>
  `;
}

function renderOrderNotFoundState() {
  const container = qs('#cart-page-app');
  if (!container) return;

  const waText = encodeURIComponent(`Order not found issue on checkout`);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl text-center space-y-6">
        <p class="text-sm text-[#2A2A2A]">Something went wrong loading your order. Please refresh and try again, or contact us on WhatsApp.</p>
        <div class="flex gap-4">
          <a href="/pages/cart" class="flex-1 py-3 bg-white border border-gray-300 text-[#2A2A2A] font-bold text-sm rounded-xl no-underline">Refresh Cart</a>
          <a href="${waUrl}" target="_blank" rel="noreferrer" class="flex-1 py-3 bg-[#25d366] text-white font-bold text-sm rounded-xl no-underline inline-flex items-center justify-center gap-2">
            <i class="fa-brands fa-whatsapp text-lg"></i>
            <span>WhatsApp Support</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

async function handlePageRefreshRecovery(db, orderId) {
  const container = qs('#cart-page-app');
  if (!container) return;

  container.innerHTML = `
    <div class="max-w-md mx-auto py-16 text-center">
      <div class="w-12 h-12 border-4 border-pink-200 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-sm text-text-soft">Loading order status...</p>
    </div>
  `;

  try {
    let orderData = null;

    try {
      const res = await fetch(`${API_BASE}/order-status/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        orderData = await res.json();
      }
    } catch (apiErr) {
      console.warn('Backend API recovery notice:', apiErr);
    }

    if (!orderData && db && typeof db.collection === 'function') {
      try {
        const docSnap = await db.collection('purchases').doc(orderId).get();
        if (docSnap.exists) {
          const fsData = docSnap.data();
          orderData = {
            order_id: orderId,
            status: fsData.status || 'pending',
            trx_id: fsData.transactionId || fsData.txnId || '',
            payment_method: fsData.paymentMethod || 'cod',
            expected_amount: fsData.amount || fsData.pricePaid || 60,
            customer_name: fsData.customerName || 'Customer',
            customer_phone: fsData.customerPhone || '',
            photos_uploaded: fsData.photos_uploaded || fsData.photosUploaded || false,
            product_type: fsData.product_type || fsData.productType,
            canva_link: fsData.canva_link || fsData.canvaLink || fsData.canvaUrl
          };
        }
      } catch (fsErr) {
        console.warn('Firestore recovery notice:', fsErr);
      }
    }

    if (!orderData) {
      renderOrderNotFoundState();
      return;
    }

    const status = orderData.status;

    if (status === 'awaiting_trx') {
      renderPaymentInstructionsStep(db, orderData);
    } else if (status === 'pending') {
      startVerificationPolling(db, orderId, orderData.trx_id || '', orderData);
    } else if (['paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed'].includes(status)) {
      renderPaidSuccessScreen(orderId, orderData, orderData);
    } else if (status === 'flagged') {
      const reason = orderData.reason || orderData.flag_reason;
      const expected = orderData.expected !== undefined ? orderData.expected : orderData.expected_amount;
      const received = orderData.received !== undefined ? orderData.received : orderData.received_amount;

      if (reason === 'amount_mismatch') {
        renderAmountMismatchState(orderId, orderData.trx_id, expected, received);
      } else if (reason === 'duplicate_trx_reuse') {
        renderDuplicateTrxState(db, orderId, orderData.trx_id, orderData);
      } else {
        renderGenericFlaggedState(orderId, orderData.trx_id);
      }
    } else if (status === 'timeout') {
      container.innerHTML = `
        <div class="max-w-md mx-auto py-16 px-4 text-center space-y-4">
          <p class="text-sm text-[#2A2A2A]">This order has expired, please place a new order.</p>
          <a href="/collections/paid-products" class="inline-block px-6 py-3 bg-[#C97B5F] text-white font-bold text-sm rounded-xl no-underline">Browse Products</a>
        </div>
      `;
    } else {
      renderPaymentInstructionsStep(db, orderData);
    }
  } catch (err) {
    renderOrderNotFoundState();
  }
}
