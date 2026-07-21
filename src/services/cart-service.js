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
  listEl.innerHTML = cart.map((item) => {
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.quantity || 1);
    totalSum += itemPrice * itemQty;
    const itemImg = item.imageUrl || FALLBACK_IMAGE;

    return `
      <div class="cart-item-row flex gap-4 items-center mb-4 pb-4 border-b border-gray-100">
        <div class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
          ${imageMarkup(itemImg, item.title, 'w-full h-full object-cover', 160)}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="m-0 text-sm font-semibold text-primary truncate">${escapeHtml(item.title)}</h4>
          <p class="m-0 text-xs text-gray-500">৳${itemPrice} &times; ${itemQty}</p>
          <div class="flex items-center gap-2 mt-1">
            <button type="button" class="cart-remove-btn text-xs text-primary underline cursor-pointer" data-cart-title="${escapeHtml(item.title)}">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (totalEl) totalEl.textContent = `৳${totalSum}`;

  qsa('.cart-remove-btn', listEl).forEach((btn) => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.cartTitle;
      removeFromCart(title);
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
  const existingIndex = cart.findIndex((i) => i.title === template.title);

  if (existingIndex >= 0) {
    cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
  } else {
    cart.push({
      id: template.id || '',
      title: template.title || 'Digital Template',
      price: Number(template.price || 0),
      imageUrl: template.imageUrl || FALLBACK_IMAGE,
      quantity: 1
    });
  }

  setCart(cart);
  updateCartCount();
  createToast(`Added "${template.title || 'Item'}" to bag.`);
}

export function removeFromCart(title) {
  let cart = getCart();
  cart = cart.filter((i) => i.title !== title);
  setCart(cart);
  updateCartCount();
  renderCartDrawer();
  createToast('Item removed from bag.');
}
