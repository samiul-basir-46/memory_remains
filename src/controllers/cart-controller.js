import { getCart, setCart, updateCartCount, clearCart } from '../services/cart-service.js';
import { formatCurrency, escapeHtml, qs, createToast } from '../utils/ui.js';
import { imageMarkup } from '../components/product-card.js';
import { getFirebaseServices } from '../services/firebase-service.js';
import { renderPhotoUploadUI } from '../components/photo-upload.js';
import { openAuthModal } from '../services/auth-service.js';
import { getCurrentGpsLocation } from '../services/location-service.js';

const API_BASE = "https://bkash-sms-gateway.onrender.com";
const DELIVERY_CHARGE = 60;
const WHATSAPP_NUMBER = "8801XXXXXXXXX";
const BKASH_NUMBER = "01XXXXXXXXX";

let activePollingTimer = null;
let currentAttemptCount = 0;
const MAX_ATTEMPTS = 20;

function generateShortOrderId() {
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `ORD-${randomDigits}`;
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
        <a href="/collections/paid-products" class="inline-flex items-center justify-center px-8 py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors no-underline">Discover Products</a>
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

    return `
      <div class="cart-item-card bg-white p-4 md:p-5 rounded-2xl border border-pink-100/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <div class="w-20 h-20 rounded-xl bg-[#1a1a1a] overflow-hidden flex-shrink-0">
          ${imageMarkup(item.imageUrl, item.title, 'w-full h-full object-cover')}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-heading text-base font-semibold text-[#2A2A2A] mb-1 truncate">${escapeHtml(item.title)}</h4>
          <p class="text-sm text-text-soft mb-2">Unit Price: <span class="font-semibold text-[#2A2A2A]">৳${itemPrice}</span></p>
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

  const grandTotal = subtotal + DELIVERY_CHARGE;

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
              <div class="flex justify-between">
                <span>Delivery Charge</span>
                <strong class="font-bold">৳${DELIVERY_CHARGE}</strong>
              </div>
              <div class="border-t border-pink-200/60 pt-3 flex justify-between text-base font-bold">
                <span>Total Amount</span>
                <strong class="text-primary text-xl">৳${grandTotal}</strong>
              </div>
            </div>
            <button type="button" id="start-checkout-btn" class="w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center">Proceed to Checkout</button>
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
    const { auth } = getFirebaseServices();
    const currentUser = auth?.currentUser;

    if (!currentUser) {
      createToast('Please sign in to proceed with checkout', 'error');
      openAuthModal();
      return;
    }

    renderCheckoutForm(db, subtotal);
  });
}

function renderCheckoutForm(db, subtotal) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const cart = getCart();
  const hasPhysicalMagazine = cart.some(item => item.purchaseMode === 'magazine' || (!item.purchaseMode && item.product_type !== 'template'));
  const effectiveDeliveryCharge = hasPhysicalMagazine ? DELIVERY_CHARGE : 0;
  const totalAmount = subtotal + effectiveDeliveryCharge;

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <button type="button" id="back-to-cart-btn" class="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-text-dark hover:text-primary transition-colors cursor-pointer">
        <i class="fa-solid fa-arrow-left"></i>
        <span>Back to Shopping Bag</span>
      </button>

      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl">
        <h2 class="font-heading text-2xl text-[#2A2A2A] font-bold mb-6">Checkout Details</h2>
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

          ${hasPhysicalMagazine ? `
            <!-- DELIVERY LOCATION SECTION FOR PHYSICAL MAGAZINE PURCHASES -->
            <div id="delivery-location-section" class="pt-4 border-t border-pink-100 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <i class="fa-solid fa-location-dot text-primary"></i>
                  <span>Delivery Location Details</span>
                </h3>
                <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">🚚 Home Delivery</span>
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
                  <input type="text" id="cust-district" required placeholder="e.g. Gazipur, Dhaka" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-[#2A2A2A] mb-1">Upazila / Police Station / Area</label>
                  <input type="text" id="cust-upazila" placeholder="e.g. Sreepur, Uttara" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
                </div>
                <div>
                  <label class="block text-xs font-bold text-[#2A2A2A] mb-1">Postal Code (Optional)</label>
                  <input type="text" id="cust-postal" placeholder="e.g. 1740" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary">
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#2A2A2A] mb-1">Detailed House & Street Address *</label>
                <textarea id="cust-address" required rows="2" placeholder="e.g. House 12, Road 5, Block B" class="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary resize-none"></textarea>
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
              ${hasPhysicalMagazine ? `
                <label class="payment-option-label border-2 border-primary bg-pink-50/50 p-4 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center">
                  <input type="radio" name="payment_method" value="cod" checked class="accent-primary">
                  <span class="text-xs font-bold text-[#2A2A2A]">Cash on Delivery</span>
                </label>
              ` : ''}
              <label class="payment-option-label border-2 ${hasPhysicalMagazine ? 'border-gray-200 bg-white' : 'border-primary bg-purple-50/50'} p-4 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center">
                <input type="radio" name="payment_method" value="online" ${!hasPhysicalMagazine ? 'checked' : ''} class="accent-primary">
                <span class="text-xs font-bold text-[#2A2A2A]">Pay Online (bKash)</span>
              </label>
            </div>
          </div>

          <div id="payment-amount-box" class="p-4 rounded-xl bg-[#FDF0F4] border border-pink-200 text-xs text-[#2A2A2A] space-y-1">
            <p id="amount-note-text" class="font-semibold text-primary text-sm">${hasPhysicalMagazine ? 'You need to pay ৳30 in advance via bKash to confirm this order' : `Total to pay: ৳${totalAmount} (Instant Canva Link Access)`}</p>
          </div>

          <div id="checkout-error-msg" class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 hidden"></div>

          <button type="submit" id="place-order-btn" class="w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center">Proceed to Payment Screen</button>
        </form>
      </div>
    </div>
  `;

  qs('#back-to-cart-btn')?.addEventListener('click', () => renderCartState(db));

  // Pre-fill delivery location if saved in header modal
  if (hasPhysicalMagazine) {
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
    } catch (_) {}

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
  const amountNote = qs('#amount-note-text');
  const paymentBoxes = document.querySelectorAll('.payment-option-label');

  radios.forEach((r) => {
    r.addEventListener('change', () => {
      paymentBoxes.forEach((b) => {
        const checked = b.querySelector('input').checked;
        b.className = checked 
          ? 'payment-option-label border-2 border-primary bg-pink-50/50 p-4 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center'
          : 'payment-option-label border-2 border-gray-200 bg-white p-4 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center';
      });

      if (r.value === 'cod') {
        if (amountNote) amountNote.textContent = `You need to pay ৳30 in advance via bKash to confirm this order`;
      } else {
        if (amountNote) amountNote.textContent = `Total to pay: ৳${totalAmount} (Products: ৳${subtotal} + Delivery: ৳${effectiveDeliveryCharge})`;
      }
    });
  });

  qs('#checkout-submit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = qs('#cust-name').value.trim();
    const phone = qs('#cust-phone').value.trim();
    const selectedMethod = document.querySelector('input[name="payment_method"]:checked')?.value || (hasPhysicalMagazine ? 'cod' : 'online');

    const phoneRegex = /^01[3-9]\d{8}$/;
    if (!phoneRegex.test(phone)) {
      qs('#phone-error-text')?.classList.remove('hidden');
      return;
    }
    qs('#phone-error-text')?.classList.add('hidden');

    if (hasPhysicalMagazine) {
      const division = qs('#cust-division')?.value || 'Dhaka';
      const district = qs('#cust-district')?.value.trim() || '';
      const upazila = qs('#cust-upazila')?.value.trim() || '';
      const address = qs('#cust-address')?.value.trim() || '';
      const postalCode = qs('#cust-postal')?.value.trim() || '';
      const note = qs('#cust-note')?.value.trim() || '';

      if (!district || !address) {
        const errBox = qs('#checkout-error-msg');
        if (errBox) {
          errBox.textContent = 'Please enter your District and Detailed House Address for physical magazine delivery.';
          errBox.classList.remove('hidden');
        }
        return;
      }

      renderPaymentInstructionsStep(db, {
        customer_name: name,
        customer_phone: phone,
        purchase_type: 'magazine',
        payment_method: selectedMethod,
        product_amount: subtotal,
        delivery_charge: effectiveDeliveryCharge,
        delivery_info: {
          division,
          district,
          upazila,
          address,
          postalCode,
          note
        }
      });
    } else {
      renderPaymentInstructionsStep(db, {
        customer_name: name,
        customer_phone: phone,
        purchase_type: 'template',
        payment_method: 'online',
        product_amount: subtotal,
        delivery_charge: 0,
        delivery_info: null
      });
    }
  });
}

function renderPaymentInstructionsStep(db, checkoutData) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const isCod = checkoutData.payment_method === 'cod';
  const expectedAmount = isCod ? 30 : (Number(checkoutData.product_amount || 0) + Number(checkoutData.delivery_charge || DELIVERY_CHARGE));

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl">
        
        <div class="bg-[#FDF0F4] p-5 rounded-2xl border border-pink-200 text-center space-y-3 mb-6">
          <span class="text-xs text-text-soft block uppercase tracking-wider font-semibold">bKash Merchant / Personal Payment Number</span>
          <div class="flex items-center justify-center gap-3">
            <span class="text-xs text-text-soft font-medium">bKash Number:</span>
            <strong class="font-bold text-xl text-[#2A2A2A] tracking-wider">${BKASH_NUMBER}</strong>
            <button type="button" id="copy-bkash-num-btn" class="px-3 py-1.5 bg-[#DC3C71] hover:bg-[#c23260] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer">Copy</button>
          </div>
          <p class="text-[11px] text-text-soft leading-relaxed border-t border-pink-200/60 pt-2.5 max-w-md mx-auto">
            <strong class="text-primary">Note:</strong> Please use the Copy button to copy the payment number. Only the payment number will be copied for your safety and to avoid mistakes during payment.
          </p>
        </div>

        <div class="text-center mb-6 border-b border-pink-100 pb-6">
          <span class="text-xs text-text-soft block mb-1">Exact Amount to Send</span>
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

          <button type="submit" id="confirm-payment-btn" class="w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center">Confirm Payment</button>
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

      if (db && typeof db.collection === 'function') {
        const currentUser = (window.firebase && window.firebase.auth) ? window.firebase.auth().currentUser : null;
        const serverTimestamp = (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue)
          ? window.firebase.firestore.FieldValue.serverTimestamp()
          : new Date();

        const deliveryInfo = checkoutData.delivery_info || null;
        const purchaseType = checkoutData.purchase_type || (deliveryInfo ? 'magazine' : 'template');

        const firestoreData = {
          orderId: newOrderId,
          purchaseType: purchaseType,
          transactionId: trxId,
          txnId: trxId,
          paymentMethod: checkoutData.payment_method === 'cod' ? 'bKash (COD Advance)' : 'bKash (Full Online)',
          amount: expectedAmount,
          pricePaid: expectedAmount,
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
          shippingAddress: deliveryInfo ? `${deliveryInfo.address}, ${deliveryInfo.upazila ? deliveryInfo.upazila + ', ' : ''}${deliveryInfo.district}, ${deliveryInfo.division}` : 'N/A (Digital Product Order)',
          paymentInfo: {
            method: 'bKash',
            transactionId: trxId
          },
          items: (() => {
            const expanded = [];
            let itemCounter = 1;
            getCart().forEach((item) => {
              const qty = Math.max(1, Number(item.quantity || 1));
              for (let q = 0; q < qty; q++) {
                const itemNumLabel = qty > 1 ? ` (Item ${q + 1} of ${qty})` : '';
                expanded.push({
                  item_id: `${newOrderId}-${itemCounter}`,
                  template_id: item.id || 'magazine-template',
                  template_name: `${item.title || item.name || 'Custom Magazine'}${itemNumLabel}`,
                  product_type: item.product_type || (item.canva_link ? 'template' : 'magazine'),
                  recipient_name: item.recipient_name || '',
                  required_photo_count: Number(item.required_photo_count || item.photo_count || 10),
                  photos_uploaded: false
                });
                itemCounter++;
              }
            });
            return expanded;
          })(),
          productName: checkoutData.product_name || (purchaseType === 'template' ? 'Digital Template Order' : 'Physical Magazine Order'),
          status: 'pending',
          paymentStatus: 'pending',
          createdAt: new Date().toISOString(),
          purchaseDate: serverTimestamp
        };
        await db.collection('purchases').doc(newOrderId).set(firestoreData);
      }

      await fetch(`${API_BASE}/submit-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: newOrderId,
          customer_name: checkoutData.customer_name,
          customer_phone: checkoutData.customer_phone,
          product_amount: checkoutData.product_amount,
          delivery_charge: checkoutData.delivery_charge,
          payment_method: checkoutData.payment_method
        })
      });

      const newUrl = `${window.location.pathname}?order_id=${encodeURIComponent(newOrderId)}`;
      window.history.pushState({}, '', newUrl);

      currentAttemptCount = 0;
      startVerificationPolling(db, newOrderId, trxId, checkoutData);
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = 'Connection issue — please check your internet and try again';
        errorBox.classList.remove('hidden');
      }
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Payment';
      }
    }
  });
}

async function startVerificationPolling(db, orderId, trxId, checkoutData) {
  if (activePollingTimer) {
    clearTimeout(activePollingTimer);
    activePollingTimer = null;
  }

  currentAttemptCount++;
  renderPendingPollingState(orderId, trxId, currentAttemptCount);

  try {
    const res = await fetch(`${API_BASE}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, trx_id: trxId })
    });

    if (!res.ok) {
      throw new Error('Connection issue');
    }

    const data = await res.json();
    handleVerificationResponse(db, data, orderId, trxId, checkoutData);
  } catch (err) {
    const errorBox = qs('#verify-status-error');
    if (errorBox) {
      errorBox.textContent = 'Connection issue — please check your internet and try again';
      errorBox.classList.remove('hidden');
    }

    if (currentAttemptCount < MAX_ATTEMPTS) {
      activePollingTimer = setTimeout(() => {
        startVerificationPolling(db, orderId, trxId, checkoutData);
      }, 15000);
    } else {
      renderPollingTimeoutState(db, orderId, trxId);
    }
  }
}

function handleVerificationResponse(db, data, orderId, trxId, checkoutData) {
  const status = data.status;

  if (status === 'paid') {
    clearCart();
    updateCartCount();
    renderPaidSuccessScreen(orderId, checkoutData, data);
    return;
  }

  if (status === 'pending') {
    if (currentAttemptCount < MAX_ATTEMPTS) {
      activePollingTimer = setTimeout(() => {
        startVerificationPolling(db, orderId, trxId, checkoutData);
      }, 15000);
    } else {
      renderPollingTimeoutState(db, orderId, trxId);
    }
    return;
  }

  if (status === 'flagged') {
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
    return;
  }

  if (status === 'order_not_found') {
    renderPollingTimeoutState(db, orderId, trxId);
    return;
  }
}

function renderPendingPollingState(orderId, trxId, attempt) {
  const container = qs('#cart-page-app');
  if (!container) return;

  container.innerHTML = `
    <div class="max-w-xl mx-auto py-8 px-4">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl text-center space-y-6">
        <div class="w-16 h-16 border-4 border-pink-200 border-t-primary rounded-full animate-spin mx-auto"></div>

        <div>
          <h3 class="font-heading text-2xl text-[#2A2A2A] font-bold mb-2">Verifying your payment...</h3>
          <p class="text-sm text-text-soft">this usually takes 1-2 minutes</p>
        </div>

        <div class="inline-block px-4 py-2 bg-pink-50 border border-pink-100 rounded-full text-xs font-semibold text-primary">
          Checking... (attempt ${attempt} of ${MAX_ATTEMPTS})
        </div>

        <div class="p-4 rounded-xl bg-[#FDF0F4] border border-pink-200 text-xs text-[#2A2A2A] space-y-1">
          <p class="font-semibold">You can safely close this page — your order is saved.</p>
          <p class="text-text-soft">Order ID: <strong class="text-[#2A2A2A] font-bold">${escapeHtml(orderId)}</strong></p>
        </div>

        <div id="verify-status-error" class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 hidden"></div>
      </div>
    </div>
  `;
}

function renderPaidSuccessScreen(orderId, checkoutData, data) {
  const container = qs('#cart-page-app');
  if (!container) return;

  const orderData = { ...checkoutData, ...data };
  const customerName = orderData.customer_name || orderData.customerName || 'Valued Customer';
  const amountPaid = orderData.amount || orderData.pricePaid || orderData.product_amount || 0;
  const trackingUrl = `${window.location.origin}/pages/track-order?order_id=${encodeURIComponent(orderId)}`;
  const waSaveText = encodeURIComponent(`Track my order ${orderId} anytime here: ${trackingUrl}`);
  const waSaveUrl = `https://wa.me/?text=${waSaveText}`;

  const productType = orderData.product_type || (orderData.canva_link || orderData.canvaUrl ? 'template' : 'magazine');
  const photosUploaded = Boolean(orderData.photos_uploaded || orderData.photosUploaded);
  const requiredPhotoCount = Number(orderData.required_photo_count || orderData.photo_count || orderData.requiredPhotoCount || 10);
  const canvaLink = orderData.canva_link || orderData.canvaUrl || orderData.canva_url || orderData.canvaLink || '';
  const status = (orderData.status || 'paid').toLowerCase();

  const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '');

  if (productType === 'template') {
    if ((status === 'delivered' || status === 'completed') && canvaLink) {
      container.innerHTML = `
        <div class="max-w-xl mx-auto py-8 px-4">
          <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6 text-center">
            <div class="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 text-emerald-500 text-3xl rounded-full flex items-center justify-center mx-auto shadow-sm">
              <i class="fa-solid fa-circle-check"></i>
            </div>

            <div class="bg-gradient-to-r from-pink-50 to-purple-50 p-6 rounded-2xl border border-pink-200 text-center space-y-4 shadow-sm">
              <div class="w-12 h-12 bg-pink-100 text-primary rounded-full flex items-center justify-center text-xl mx-auto">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <h3 class="font-heading text-2xl font-bold text-[#2A2A2A]">🎉 Your template is ready!</h3>
              <div class="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <a href="${escapeHtml(canvaLink)}" target="_blank" rel="noopener noreferrer" class="px-6 py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors no-underline inline-flex items-center justify-center gap-2">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  <span>Open in Canva</span>
                </a>
                <button type="button" id="copy-canva-btn-${safeOrderId}" class="px-6 py-3.5 bg-white border border-gray-300 hover:bg-gray-50 text-[#2A2A2A] font-bold text-sm rounded-xl shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center gap-2">
                  <i class="fa-regular fa-copy"></i>
                  <span id="copy-canva-text-${safeOrderId}">Copy Link</span>
                </button>
              </div>
            </div>

            <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-left space-y-3 text-sm text-[#2A2A2A]">
              <div class="flex justify-between">
                <span class="text-text-soft">Customer Name</span>
                <strong class="font-semibold">${escapeHtml(customerName)}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-text-soft">Order ID</span>
                <strong class="font-semibold">${escapeHtml(orderId)}</strong>
              </div>
              <div class="flex justify-between border-t border-gray-200 pt-3">
                <span class="text-text-soft">Amount Paid</span>
                <strong class="text-primary text-base font-bold">৳${amountPaid}</strong>
              </div>
            </div>

            <a href="/collections/paid-products" class="inline-flex items-center justify-center w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors no-underline">Continue Shopping</a>
          </div>
        </div>
      `;

      qs(`#copy-canva-btn-${safeOrderId}`)?.addEventListener('click', () => {
        navigator.clipboard.writeText(canvaLink);
        const txt = qs(`#copy-canva-text-${safeOrderId}`);
        if (txt) txt.textContent = 'Link Copied!';
        setTimeout(() => { if (txt) txt.textContent = 'Copy Link'; }, 2000);
      });
      return;
    }

    container.innerHTML = `
      <div class="max-w-xl mx-auto py-8 px-4">
        <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6 text-center">
          <div class="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 text-emerald-500 text-3xl rounded-full flex items-center justify-center mx-auto shadow-sm">
            <i class="fa-solid fa-circle-check"></i>
          </div>

          <div>
            <h2 class="font-heading text-2xl md:text-3xl text-[#2A2A2A] font-bold mb-2">Payment Confirmed!</h2>
            <p class="text-emerald-700 font-bold text-sm">✅ Payment confirmed! We're preparing your Canva template link.</p>
          </div>

          <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-left space-y-3 text-sm text-[#2A2A2A]">
            <div class="flex justify-between">
              <span class="text-text-soft">Customer Name</span>
              <strong class="font-semibold">${escapeHtml(customerName)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-text-soft">Order ID</span>
              <strong class="font-semibold">${escapeHtml(orderId)}</strong>
            </div>
            <div class="flex justify-between border-t border-gray-200 pt-3">
              <span class="text-text-soft">Amount Paid</span>
              <strong class="text-primary text-base font-bold">৳${amountPaid}</strong>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-[#FDF0F4] border border-pink-200 text-xs text-[#2A2A2A] space-y-3 text-center">
            <p class="font-semibold">You can track this order anytime at <a href="${trackingUrl}" class="text-primary underline font-bold">${escapeHtml(trackingUrl)}</a></p>
            <div class="flex flex-col sm:flex-row gap-2 justify-center pt-1">
              <button type="button" id="copy-tracking-link-btn" class="px-4 py-2 bg-white border border-pink-200 text-primary font-bold text-xs rounded-lg shadow-sm hover:bg-pink-50 transition-colors cursor-pointer">Copy Tracking Link</button>
              <a href="${waSaveUrl}" target="_blank" rel="noreferrer" class="px-4 py-2 bg-[#25d366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-lg shadow-sm transition-colors no-underline inline-flex items-center justify-center gap-1.5">
                <i class="fa-brands fa-whatsapp text-sm"></i>
                <span>Save via WhatsApp</span>
              </a>
            </div>
          </div>

          <a href="/collections/paid-products" class="inline-flex items-center justify-center w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors no-underline">Continue Shopping</a>
        </div>
      </div>
    `;

    qs('#copy-tracking-link-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(trackingUrl);
      const btn = qs('#copy-tracking-link-btn');
      if (btn) btn.textContent = 'Link Copied!';
      setTimeout(() => { if (btn) btn.textContent = 'Copy Tracking Link'; }, 2000);
    });
    return;
  }

  if (status === 'completed') {
    container.innerHTML = `
      <div class="max-w-xl mx-auto py-8 px-4">
        <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6 text-center">
          <div class="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 text-emerald-500 text-3xl rounded-full flex items-center justify-center mx-auto shadow-sm">
            <i class="fa-solid fa-circle-check"></i>
          </div>

          <div>
            <h2 class="font-heading text-2xl md:text-3xl text-[#2A2A2A] font-bold mb-2">Order Complete!</h2>
            <p class="text-emerald-700 font-bold text-sm">✅ Your magazine order is complete!</p>
          </div>

          <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-left space-y-3 text-sm text-[#2A2A2A]">
            <div class="flex justify-between">
              <span class="text-text-soft">Customer Name</span>
              <strong class="font-semibold">${escapeHtml(customerName)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-text-soft">Order ID</span>
              <strong class="font-semibold">${escapeHtml(orderId)}</strong>
            </div>
            <div class="flex justify-between border-t border-gray-200 pt-3">
              <span class="text-text-soft">Amount Paid</span>
              <strong class="text-primary text-base font-bold">৳${amountPaid}</strong>
            </div>
          </div>

          <a href="/collections/paid-products" class="inline-flex items-center justify-center w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors no-underline">Continue Shopping</a>
        </div>
      </div>
    `;
    return;
  }

  if (photosUploaded) {
    container.innerHTML = `
      <div class="max-w-xl mx-auto py-8 px-4">
        <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6 text-center">
          <div class="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 text-emerald-500 text-3xl rounded-full flex items-center justify-center mx-auto shadow-sm">
            <i class="fa-solid fa-circle-check"></i>
          </div>

          <div>
            <h2 class="font-heading text-2xl md:text-3xl text-[#2A2A2A] font-bold mb-2">Payment Confirmed!</h2>
            <p class="text-emerald-700 font-bold text-sm">✅ Photos received — your magazine is being prepared</p>
          </div>

          <div class="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-left space-y-3 text-sm text-[#2A2A2A]">
            <div class="flex justify-between">
              <span class="text-text-soft">Customer Name</span>
              <strong class="font-semibold">${escapeHtml(customerName)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-text-soft">Order ID</span>
              <strong class="font-semibold">${escapeHtml(orderId)}</strong>
            </div>
            <div class="flex justify-between border-t border-gray-200 pt-3">
              <span class="text-text-soft">Amount Paid</span>
              <strong class="text-primary text-base font-bold">৳${amountPaid}</strong>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-[#FDF0F4] border border-pink-200 text-xs text-[#2A2A2A] space-y-3 text-center">
            <p class="font-semibold">You can track this order anytime at <a href="${trackingUrl}" class="text-primary underline font-bold">${escapeHtml(trackingUrl)}</a></p>
            <div class="flex flex-col sm:flex-row gap-2 justify-center pt-1">
              <button type="button" id="copy-tracking-link-btn" class="px-4 py-2 bg-white border border-pink-200 text-primary font-bold text-xs rounded-lg shadow-sm hover:bg-pink-50 transition-colors cursor-pointer">Copy Tracking Link</button>
              <a href="${waSaveUrl}" target="_blank" rel="noreferrer" class="px-4 py-2 bg-[#25d366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-lg shadow-sm transition-colors no-underline inline-flex items-center justify-center gap-1.5">
                <i class="fa-brands fa-whatsapp text-sm"></i>
                <span>Save via WhatsApp</span>
              </a>
            </div>
          </div>

          <a href="/collections/paid-products" class="inline-flex items-center justify-center w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors no-underline">Continue Shopping</a>
        </div>
      </div>
    `;

    qs('#copy-tracking-link-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(trackingUrl);
      const btn = qs('#copy-tracking-link-btn');
      if (btn) btn.textContent = 'Link Copied!';
      setTimeout(() => { if (btn) btn.textContent = 'Copy Tracking Link'; }, 2000);
    });
    return;
  }

  container.innerHTML = `
    <div class="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-4 text-center">
        <div class="w-14 h-14 bg-emerald-50 border-2 border-emerald-200 text-emerald-500 text-2xl rounded-full flex items-center justify-center mx-auto shadow-sm">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <div>
          <h2 class="font-heading text-2xl md:text-3xl text-[#2A2A2A] font-bold mb-1">Payment Confirmed!</h2>
          <p class="text-text-soft text-sm">Please upload your photos below to start processing your magazine.</p>
        </div>
        <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left space-y-2 text-xs text-[#2A2A2A]">
          <div class="flex justify-between">
            <span class="text-text-soft">Order ID</span>
            <strong class="font-semibold">${escapeHtml(orderId)}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-text-soft">Customer Name</span>
            <strong class="font-semibold">${escapeHtml(customerName)}</strong>
          </div>
        </div>
      </div>

      <div id="checkout-photo-upload-mount"></div>
    </div>
  `;

  const uploadMount = qs('#checkout-photo-upload-mount');
  if (uploadMount) {
    renderPhotoUploadUI(uploadMount, {
      orderId,
      requiredPhotoCount,
      onSuccess: () => {
        renderPaidSuccessScreen(orderId, checkoutData, { ...data, photos_uploaded: true, photosUploaded: true });
      }
    });
  }
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
          <p class="text-text-soft text-sm">Your order and Transaction ID have been recorded. Our admin team will verify your payment and process your order shortly.</p>
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

        <div class="space-y-3">
          <a href="/pages/profile#orders" class="w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors inline-flex items-center justify-center gap-2 no-underline">
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
          <button type="button" id="re-enter-trx-btn" class="w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer text-center">Try Another Transaction ID</button>

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
            expected_amount: fsData.amount || fsData.pricePaid || 30,
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
    } else if (status === 'paid' || status === 'delivered' || status === 'completed') {
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
          <a href="/collections/paid-products" class="inline-block px-6 py-3 bg-[#DC3C71] text-white font-bold text-sm rounded-xl no-underline">Browse Products</a>
        </div>
      `;
    } else {
      renderPaymentInstructionsStep(db, orderData);
    }
  } catch (err) {
    renderOrderNotFoundState();
  }
}
