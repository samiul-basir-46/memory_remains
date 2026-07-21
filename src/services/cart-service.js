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
      <div class="cart-item-row" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid #f0f0f0;">
        <div style="width: 70px; height: 70px; border-radius: 8px; overflow: hidden; background: #f7f7f7; flex-shrink: 0;">
          ${imageMarkup(itemImg, item.title, '', 160)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <h4 style="margin: 0 0 4px 0; font-size: 0.95rem; color: var(--color-primary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.title)}</h4>
          <p style="margin: 0 0 6px 0; font-size: 0.9rem; color: #666;">${formatCurrency(itemPrice)} &times; ${itemQty}</p>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button type="button" class="cart-remove-btn" data-cart-title="${escapeHtml(item.title)}" style="background: none; border: none; padding: 0; color: #d82b58; font-size: 0.8rem; cursor: pointer; text-decoration: underline;">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (totalEl) totalEl.textContent = formatCurrency(totalSum);

  qsa('.cart-remove-btn', listEl).forEach((btn) => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.cartTitle;
      removeFromCart(title);
    });
  });
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
  renderCartDrawer();
  createToast(`Added "${template.title || 'Item'}" to bag.`);

  const drawer = qs('#cart-drawer');
  const overlay = qs('#cart-drawer-overlay');
  if (drawer && overlay) {
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
  }
}

export function removeFromCart(title) {
  let cart = getCart();
  cart = cart.filter((i) => i.title !== title);
  setCart(cart);
  updateCartCount();
  renderCartDrawer();
  createToast('Item removed from bag.');
}
