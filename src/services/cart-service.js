import { createToast, escapeHtml, formatCurrency, qs, qsa, safeJsonParse } from '../utils/ui.js';
import { imageMarkup } from '../components/product-card.js';

const CART_STORAGE_KEY = 'memory_remains_cart_v2';
const FALLBACK_IMAGE = '/assets/product_placeholder.png';

export function getCart() {
  const parsed = safeJsonParse(localStorage.getItem(CART_STORAGE_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
}

export function setCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

export function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
}

export function updateCartCount() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  qsa('.cart-badge-count').forEach((el) => {
    el.textContent = String(totalItems);
  });
}

export function renderCartDrawer() {
  const cart = getCart();
  const listEl = qs('#cart-drawer-items');
  const emptyEl = qs('#cart-drawer-empty');
  const footerEl = qs('#cart-drawer-footer');
  const totalEl = qs('#cart-total-amount');

  if (!listEl) return;

  if (cart.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    listEl.innerHTML = '';
    if (footerEl) footerEl.hidden = true;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (footerEl) footerEl.hidden = false;

  let totalSum = 0;
  let totalDelivery = 0;
  listEl.innerHTML = cart.map((item) => {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.quantity || 1);
    const delivery = Number(item.deliveryCharge || 0);
    totalSum += itemPrice * itemQty;
    totalDelivery += delivery * itemQty;
    const itemImg = item.imageUrl || FALLBACK_IMAGE;
    const modeLabel = item.purchaseMode === 'template' ? '🎨 Digital Template' : (item.product_type === 'magazine' ? '📖 Magazine Print' : item.product_type === 'poster' ? '📜 Poster' : item.product_type === 'wall_frame' ? '🖼️ Wall Frame' : item.product_type === 'sticker' ? '🏷️ Sticker' : '📦 Product');
    const cartKey = item.cartKey || item.title;

    return `
      <div class="cart-item-row flex gap-3 items-start mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
        <div class="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
          ${imageMarkup(itemImg, item.title, 'w-full h-full object-cover', 160)}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="m-0 text-sm font-bold text-gray-800 line-clamp-2 leading-tight">${escapeHtml(item.title)}</h4>
          <span class="text-[10px] font-semibold text-primary bg-pink-50 px-2 py-0.5 rounded-full mt-1 inline-block">${modeLabel}</span>
          <div class="flex items-center justify-between mt-1.5">
            <p class="m-0 text-xs text-gray-600 font-semibold">৳${itemPrice} × ${itemQty}</p>
            ${delivery > 0 ? `<p class="m-0 text-[10px] text-gray-400">+৳${delivery} delivery</p>` : ''}
          </div>
          <div class="flex items-center gap-2 mt-1.5">
            <button type="button" class="cart-remove-btn text-xs text-rose-500 hover:text-rose-700 font-semibold cursor-pointer" data-cart-key="${escapeHtml(cartKey)}">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (totalEl) {
    const grandTotal = totalSum + totalDelivery;
    totalEl.innerHTML = `৳${grandTotal}${totalDelivery > 0 ? ` <span class="text-xs font-normal text-gray-400">(incl. ৳${totalDelivery} delivery)</span>` : ''}`;
  }

  qsa('.cart-remove-btn', listEl).forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.cartKey;
      removeFromCartByKey(key);
    });
  });

  const checkoutBtn = qs('#checkout-btn');
  if (checkoutBtn && !checkoutBtn.dataset.bound) {
    checkoutBtn.dataset.bound = 'true';
    checkoutBtn.addEventListener('click', () => {
      window.location.href = '/pages/cart';
    });
  }
}

export function addTemplateToCart(template = {}) {
  const cart = getCart();
  const cartKey = `${template.id || template.title}_${template.purchaseMode || 'magazine'}`;
  const existingIndex = cart.findIndex((i) => i.cartKey === cartKey);

  const itemPrice = Number(template.price || template.magazine_price || 0);
  const deliveryCharge = Number(template.delivery_charge || template.deliveryCharge || 0);

  const itemPType = template.product_type || template.productType || (template.purchaseMode === 'poster' ? 'poster' : (template.purchaseMode === 'wall_frame' ? 'wall_frame' : (template.purchaseMode === 'sticker' ? 'sticker' : 'magazine')));

  if (existingIndex >= 0) {
    cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
    if (template.selectedPosters) cart[existingIndex].selectedPosters = template.selectedPosters;
  } else {
    cart.push({
      cartKey,
      id: template.id || template.template_id || template.templateId || '',
      title: template.title || template.name || template.template_name || 'Product',
      price: itemPrice,
      deliveryCharge: deliveryCharge,
      imageUrl: template.imageUrl || FALLBACK_IMAGE,
      quantity: 1,
      purchaseMode: template.purchaseMode || itemPType,
      product_type: itemPType,
      productType: itemPType,
      requiredPhotos: template.requiredPhotos || 12,
      comboQuantity: template.comboQuantity || 5,
      selectedPosters: template.selectedPosters || null,
      template_price: Number(template.template_price || template.templatePrice || 0),
      magazine_price: Number(template.magazine_price || template.magazinePrice || itemPrice),
    });
  }

  setCart(cart);
  updateCartCount();
  renderCartDrawer();
  createToast(`✅ "${template.title || 'Item'}" added to bag.`);
}

export function removeFromCart(title) {
  let cart = getCart();
  cart = cart.filter((i) => i.title !== title);
  setCart(cart);
  updateCartCount();
  renderCartDrawer();
  createToast('Item removed from bag.');
}

export function removeFromCartByKey(cartKey) {
  let cart = getCart();
  cart = cart.filter((i) => (i.cartKey || i.title) !== cartKey);
  setCart(cart);
  updateCartCount();
  renderCartDrawer();
  createToast('Item removed from bag.');
}
