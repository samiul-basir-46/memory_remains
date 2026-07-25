import { buildCloudinaryDeliveryUrl } from '../utils/cloudinary.js';
import { escapeHtml } from '../utils/ui.js';
import { comparePrice, discountPercent } from '../services/templates-service.js';

const FALLBACK_IMAGE = '/assets/product_placeholder.png';

const PRODUCT_TYPE_META = {
  magazine: { label: 'Magazine', emoji: '📖', badgeBg: 'bg-rose-500', cardBg: '#F9E7EF', cardBorder: '#f5cfe0' },
  poster:   { label: 'Poster',   emoji: '📜', badgeBg: 'bg-violet-500', cardBg: '#F0EEF9', cardBorder: '#dbd8f5' },
  wall_frame: { label: 'Wall Frame', emoji: '🖼️', badgeBg: 'bg-sky-500', cardBg: '#EDF4FC', cardBorder: '#c7ddf5' },
  sticker:  { label: 'Sticker',  emoji: '🏷️', badgeBg: 'bg-emerald-500', cardBg: '#EFFAF4', cardBorder: '#b6eaca' }
};

function getTypeMeta(productType) {
  const key = String(productType || 'magazine').toLowerCase().replace(/\s+/g, '_');
  return PRODUCT_TYPE_META[key] || PRODUCT_TYPE_META['magazine'];
}

export function imageMarkup(url, alt, className = '', widthHint = 720) {
  const escapedAlt = escapeHtml(alt || 'Product image');
  const effectiveUrl = (url && url.trim()) ? url : FALLBACK_IMAGE;
  const optimizedUrl = buildCloudinaryDeliveryUrl(effectiveUrl, { width: widthHint });
  return `<img class="${className}" src="${optimizedUrl}" alt="${escapedAlt}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">`;
}

export function renderProductCard(template = {}) {
  const meta = getTypeMeta(template.product_type);
  const badge = template.badge || 'Bestseller';
  const price = Number(template.price || 0);
  const compare = comparePrice(template);
  const discount = discountPercent(template);
  const requiredPhotos = template.requiredPhotos || 12;
  const templateId = template.id || template._id || template.templateId;
  const detailsUrl = templateId ? `/pages/product-details/?id=${encodeURIComponent(templateId)}` : '#';

  const primaryImg = template.imageUrl || FALLBACK_IMAGE;
  const secondaryImg = (template.galleryUrls && template.galleryUrls.length > 0) ? template.galleryUrls[0] : null;

  const isPoster = meta.label === 'Poster';
  const comboPrices = template.comboPrices || {};
  let priceText = `৳${price}`;
  if (isPoster && comboPrices['5']) {
    priceText = `From ৳${comboPrices['5']}`;
  }

  return `
    <article class="product-card flex-shrink-0 w-[270px] rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-all duration-300" style="background:${meta.cardBg};border-color:${meta.cardBorder}" data-product-card>
      <a href="${detailsUrl}" class="product-card__media relative block aspect-square bg-[#1a1a1a] overflow-hidden ${secondaryImg ? 'has-hover-image' : ''}">
        <span class="product-badge absolute top-2.5 left-2.5 z-10 px-3 py-1 ${meta.badgeBg} text-white text-xs font-semibold rounded-md shadow-sm">${escapeHtml(badge)}</span>
        <span class="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium rounded-md flex items-center gap-1">
          ${isPoster ? '<i class="fa-solid fa-layer-group text-[10px]"></i> 5-20 Pcs Combo' : `<i class="fa-solid fa-camera text-[10px]"></i> ${requiredPhotos} Photos`}
        </span>
        ${imageMarkup(primaryImg, template.title, 'product-card__image primary-image absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105')}
        ${secondaryImg ? imageMarkup(secondaryImg, template.title, 'product-card__image secondary-image absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105') : ''}
      </a>
      <div class="product-card__body p-4" style="background:${meta.cardBg}">
        <h3 class="product-card__title font-body text-base font-normal text-[#2A2A2A] mb-2 truncate">
          <a href="${detailsUrl}" class="hover:text-primary transition-colors">${escapeHtml(template.title || 'Untitled product')}</a>
        </h3>
        <div class="product-price-row flex items-baseline gap-2 flex-wrap">
          <strong class="text-[#2A2A2A] text-xl font-bold">${priceText}</strong>
          ${compare ? `<span class="text-gray-500 line-through text-sm">৳${compare}</span>` : ''}
          ${discount ? `<span class="text-[#00664E] text-sm font-normal ml-auto">${discount}% Off</span>` : ''}
        </div>
      </div>
    </article>
  `;
}

export function renderProductCardV2(template = {}) {
  const meta = getTypeMeta(template.product_type);
  const productType = String(template.product_type || 'magazine').toLowerCase().replace(/\s+/g, '_');
  const isMagazine = productType === 'magazine';
  const isPoster = productType === 'poster';

  const badge = template.badge || meta.label;
  const price = Number(template.price || template.magazine_price || 0);
  const compare = comparePrice(template);
  const discount = discountPercent(template);
  const requiredPhotos = template.requiredPhotos || 12;
  const templatePrice = Number(template.template_price || template.templatePrice || 0);
  const canSellTemplate = Boolean(template.is_template_for_sale) && templatePrice > 0;
  const deliveryCharge = Number(template.delivery_charge || template.deliveryCharge || 0);

  const templateId = template.id || template._id || template.templateId;
  const detailsUrl = templateId ? `/pages/product-details/?id=${encodeURIComponent(templateId)}` : '#';

  const comboPrices = template.comboPrices || {};
  let displayPrice = `৳${price}`;
  if (isPoster && comboPrices['5']) {
    displayPrice = `From ৳${comboPrices['5']}`;
  }

  const safeData = encodeURIComponent(JSON.stringify({
    id: template.id,
    title: template.title,
    price: price,
    magazine_price: Number(template.magazine_price || price),
    template_price: templatePrice,
    imageUrl: template.imageUrl || FALLBACK_IMAGE,
    product_type: productType,
    delivery_charge: deliveryCharge,
    requiredPhotos: requiredPhotos,
    is_template_for_sale: Boolean(template.is_template_for_sale)
  }));

  const primaryImg = template.imageUrl || FALLBACK_IMAGE;
  const secondaryImg = (template.galleryUrls && template.galleryUrls.length > 0) ? template.galleryUrls[0] : null;

  const typeLabel = `<span class="inline-flex items-center gap-1 absolute bottom-2 left-2.5 z-10 px-2 py-0.5 ${meta.badgeBg} text-white text-[10px] font-semibold rounded-full shadow-sm opacity-90">${meta.emoji} ${meta.label}</span>`;

  let priceBlock = '';
  if (isPoster) {
    priceBlock = `
      <div class="mt-2.5">
        <a href="${detailsUrl}" class="block w-full py-2 text-center rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-strong transition-colors cursor-pointer">📜 Customize Combo (${displayPrice})</a>
      </div>
      <a href="${detailsUrl}" class="block text-center text-[10px] text-gray-400 hover:text-primary mt-1.5 transition-colors">View Details →</a>
    `;
  } else if (isMagazine && canSellTemplate) {
    priceBlock = `
      <div class="flex items-center gap-1.5 mt-2.5">
        <button type="button" class="card-add-to-cart flex-1 py-2 text-center rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-strong transition-colors cursor-pointer" data-mode="magazine" data-template="${safeData}">🛍️ Order ৳${price}</button>
        <button type="button" class="card-add-to-cart flex-1 py-2 text-center rounded-lg border border-primary text-primary text-xs font-bold hover:bg-pink-50 transition-colors cursor-pointer" data-mode="template" data-template="${safeData}">🎨 Template ৳${templatePrice}</button>
      </div>
      <a href="${detailsUrl}" class="block text-center text-[10px] text-gray-400 hover:text-primary mt-1.5 transition-colors">View Details →</a>
    `;
  } else {
    priceBlock = `
      <div class="mt-2.5">
        <button type="button" class="card-add-to-cart block w-full py-2 text-center rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-strong transition-colors cursor-pointer" data-mode="magazine" data-template="${safeData}">🛍️ Order Now ৳${price}</button>
      </div>
      <a href="${detailsUrl}" class="block text-center text-[10px] text-gray-400 hover:text-primary mt-1.5 transition-colors">View Details →</a>
    `;
  }

  return `
    <article class="product-card-v2 rounded-xl overflow-hidden border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300" style="background:${meta.cardBg};border-color:${meta.cardBorder}" data-product-card>
      <a href="${detailsUrl}" class="product-card-v2__media relative block aspect-square bg-[#1a1a1a] overflow-hidden ${secondaryImg ? 'has-hover-image' : ''}">
        <span class="product-card-v2__badge absolute top-2.5 left-2.5 z-10 px-3 py-1 ${meta.badgeBg} text-white text-xs font-semibold rounded-md shadow-sm">${escapeHtml(badge)}</span>
        <span class="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium rounded-md flex items-center gap-1">
          ${isPoster ? '<i class="fa-solid fa-layer-group text-[10px]"></i> 5-20 Pcs' : `<i class="fa-solid fa-camera text-[10px]"></i> ${requiredPhotos}`}
        </span>
        ${imageMarkup(primaryImg, template.title, 'product-card-v2__image primary-image absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105')}
        ${secondaryImg ? imageMarkup(secondaryImg, template.title, 'product-card-v2__image secondary-image absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105') : ''}
        ${typeLabel}
      </a>
      <div class="product-card-v2__body p-3" style="background:${meta.cardBg}">
        <h3 class="product-card-v2__title font-body text-sm font-semibold text-[#2A2A2A] mb-1 line-clamp-2 min-h-[2.4rem]">
          <a href="${detailsUrl}" class="hover:text-primary transition-colors">${escapeHtml(template.title || 'Untitled product')}</a>
        </h3>
        <div class="product-card-v2__price-row flex items-baseline gap-2 flex-wrap">
          <strong class="product-card-v2__price text-[#2A2A2A] text-lg font-bold">${displayPrice}</strong>
          ${compare ? `<span class="product-card-v2__mrp text-gray-400 line-through text-xs">৳${compare}</span>` : ''}
          ${discount ? `<span class="product-card-v2__discount text-[#00664E] text-xs font-semibold ml-auto">${discount}% Off</span>` : ''}
        </div>
        ${priceBlock}
      </div>
    </article>
  `;
}
