import { buildCloudinaryDeliveryUrl } from '../utils/cloudinary.js';
import { escapeHtml } from '../utils/ui.js';
import { comparePrice, discountPercent } from '../services/templates-service.js';

const FALLBACK_IMAGE = '/assets/product_placeholder.png';

export function imageMarkup(url, alt, className = '', widthHint = 720) {
  const escapedAlt = escapeHtml(alt || 'Product image');
  const effectiveUrl = (url && url.trim()) ? url : FALLBACK_IMAGE;
  const optimizedUrl = buildCloudinaryDeliveryUrl(effectiveUrl, { width: widthHint });
  return `<img class="${className}" src="${optimizedUrl}" alt="${escapedAlt}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">`;
}

export function renderProductCard(template = {}) {
  const badge = template.badge || 'Bestseller';
  const price = Number(template.price || 0);
  const compare = comparePrice(template);
  const discount = discountPercent(template);
  const requiredPhotos = template.requiredPhotos || 12;
  const templateId = template.id || template._id || template.templateId;
  const detailsUrl = templateId ? `/pages/product-details?id=${encodeURIComponent(templateId)}` : '#';

  const primaryImg = template.imageUrl || FALLBACK_IMAGE;
  const secondaryImg = (template.galleryUrls && template.galleryUrls.length > 0) ? template.galleryUrls[0] : null;

  return `
    <article class="product-card flex-shrink-0 w-[270px] bg-[#F9E7EF] rounded-xl overflow-hidden border border-[#F9E7EF] shadow-sm hover:shadow-md transition-all duration-300" data-product-card>
      <a href="${detailsUrl}" class="product-card__media relative block aspect-square bg-[#1a1a1a] overflow-hidden ${secondaryImg ? 'has-hover-image' : ''}">
        <span class="product-badge absolute top-2.5 left-2.5 z-10 px-3 py-1 bg-[#DC3C71] text-white text-xs font-semibold rounded-md shadow-sm">${escapeHtml(badge)}</span>
        <span class="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium rounded-md flex items-center gap-1"><i class="fa-solid fa-camera text-[10px]"></i> ${requiredPhotos} Photos</span>
        ${imageMarkup(primaryImg, template.title, 'product-card__image primary-image absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105')}
        ${secondaryImg ? imageMarkup(secondaryImg, template.title, 'product-card__image secondary-image absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105') : ''}
      </a>
      <div class="product-card__body p-4 bg-[#F9E7EF]">
        <h3 class="product-card__title font-body text-base font-normal text-[#2A2A2A] mb-2 truncate">
          <a href="${detailsUrl}" class="hover:text-primary transition-colors">${escapeHtml(template.title || 'Untitled product')}</a>
        </h3>
        <div class="product-price-row flex items-baseline gap-2 flex-wrap">
          <strong class="text-[#2A2A2A] text-xl font-bold">₹${price}</strong>
          ${compare ? `<span class="text-gray-500 line-through text-sm">₹${compare}</span>` : ''}
          ${discount ? `<span class="text-[#00664E] text-sm font-normal ml-auto">${discount}% Off</span>` : ''}
        </div>
      </div>
    </article>
  `;
}

export function renderProductCardV2(template = {}) {
  const badge = template.badge || 'Bestseller';
  const price = Number(template.price || 0);
  const compare = comparePrice(template);
  const discount = discountPercent(template);
  const requiredPhotos = template.requiredPhotos || 12;
  const templateId = template.id || template._id || template.templateId;
  const detailsUrl = templateId ? `/pages/product-details?id=${encodeURIComponent(templateId)}` : '#';

  const primaryImg = template.imageUrl || FALLBACK_IMAGE;
  const secondaryImg = (template.galleryUrls && template.galleryUrls.length > 0) ? template.galleryUrls[0] : null;

  return `
    <article class="product-card-v2 bg-[#F9E7EF] rounded-xl overflow-hidden border border-[#F9E7EF] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300" data-product-card>
      <a href="${detailsUrl}" class="product-card-v2__media relative block aspect-square bg-[#1a1a1a] overflow-hidden ${secondaryImg ? 'has-hover-image' : ''}">
        <span class="product-card-v2__badge absolute top-2.5 left-2.5 z-10 px-3 py-1 bg-[#DC3C71] text-white text-xs font-semibold rounded-md shadow-sm">${escapeHtml(badge)}</span>
        <span class="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium rounded-md flex items-center gap-1"><i class="fa-solid fa-camera text-[10px]"></i> ${requiredPhotos} Photos</span>
        ${imageMarkup(primaryImg, template.title, 'product-card-v2__image primary-image absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105')}
        ${secondaryImg ? imageMarkup(secondaryImg, template.title, 'product-card-v2__image secondary-image absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105') : ''}
      </a>
      <div class="product-card-v2__body p-4 bg-[#F9E7EF]">
        <h3 class="product-card-v2__title font-body text-base font-normal text-[#2A2A2A] mb-2 line-clamp-2 min-h-[2.75rem]">
          <a href="${detailsUrl}" class="hover:text-primary transition-colors">${escapeHtml(template.title || 'Untitled product')}</a>
        </h3>
        <div class="product-card-v2__price-row flex items-baseline gap-2 flex-wrap">
          <strong class="product-card-v2__price text-[#2A2A2A] text-xl font-bold">₹${price}</strong>
          ${compare ? `<span class="product-card-v2__mrp text-gray-500 line-through text-sm">₹${compare}</span>` : ''}
          ${discount ? `<span class="product-card-v2__discount text-[#00664E] text-sm font-normal ml-auto">${discount}% Off</span>` : ''}
        </div>
      </div>
    </article>
  `;
}
