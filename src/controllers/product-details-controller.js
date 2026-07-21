import { fetchTemplateById, DEFAULT_FEATURED_TEMPLATES, inferCollection } from '../services/templates-service.js';
import { addTemplateToCart } from '../services/cart-service.js';
import { imageMarkup } from '../components/product-card.js';
import { buildCloudinaryDeliveryUrl, setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { escapeHtml, formatCurrency, qs } from '../utils/ui.js';

const FALLBACK_IMAGE = '/assets/product_placeholder.png';

export async function renderProductDetailsPage(db) {
  const detailsContainer = qs('#details-content-container');
  if (!detailsContainer) return;
  const loading = qs('#details-loading-state');

  const params = new URLSearchParams(window.location.search);
  const templateId = params.get('id');

  try {
    let template = await fetchTemplateById(db, templateId);
    if (!template) {
      template = DEFAULT_FEATURED_TEMPLATES[0];
    }

    const gallery = [template.imageUrl, ...(template.galleryUrls || [])].filter(Boolean);
    qs('#details-category').textContent = inferCollection(template);
    qs('#details-title').textContent = template.title || 'Product details';
    qs('#details-price').textContent = formatCurrency(template.price || 0);
    qs('#details-description').textContent = template.description || 'Premium digital template crafted for gifting and memory-driven storytelling.';
    qs('#details-badge').textContent = template.badge || 'Featured';

    let activeGalleryIdx = 0;

    const mainImg = qs('#details-main-image');
    const galleryContainer = qs('#gallery-main-container');

    const updateDetailsMainImage = (index) => {
      activeGalleryIdx = (index + gallery.length) % gallery.length;
      const nextSrc = gallery[activeGalleryIdx] || FALLBACK_IMAGE;
      if (mainImg) {
        mainImg.src = buildCloudinaryDeliveryUrl(nextSrc, { width: 1200 });
        mainImg.onerror = () => { mainImg.src = FALLBACK_IMAGE; };
      }
      if (thumbs) {
        const btns = thumbs.querySelectorAll('button');
        btns.forEach((btn, i) => {
          btn.style.borderColor = (i === activeGalleryIdx) ? 'var(--color-primary)' : '#e8e8e8';
          btn.style.opacity = (i === activeGalleryIdx) ? '1' : '0.7';
        });
      }
    };

    if (galleryContainer && gallery.length > 1) {
      let arrows = galleryContainer.querySelector('.details-gallery-arrows');
      if (!arrows) {
        arrows = document.createElement('div');
        arrows.className = 'details-gallery-arrows';
        arrows.innerHTML = `
          <button type="button" class="carousel-btn details-prev-btn" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.92); border: none; width: 38px; height: 38px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.18); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-primary); font-size: 1.1rem; z-index: 10;"><i class="fa-solid fa-chevron-left"></i></button>
          <button type="button" class="carousel-btn details-next-btn" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.92); border: none; width: 38px; height: 38px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.18); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-primary); font-size: 1.1rem; z-index: 10;"><i class="fa-solid fa-chevron-right"></i></button>
        `;
        galleryContainer.appendChild(arrows);
      }
      arrows.querySelector('.details-prev-btn')?.addEventListener('click', () => updateDetailsMainImage(activeGalleryIdx - 1));
      arrows.querySelector('.details-next-btn')?.addEventListener('click', () => updateDetailsMainImage(activeGalleryIdx + 1));
    }

    const thumbs = qs('#details-thumbnails-gallery');
    if (thumbs) {
      thumbs.classList.add('gallery-thumbs');
      thumbs.innerHTML = gallery.map((url, index) => `
        <button type="button" data-gallery-index="${index}" data-gallery-src="${escapeHtml(url)}" aria-label="View image ${index + 1}" style="border: 2px solid ${index === 0 ? 'var(--color-primary)' : '#e8e8e8'}; opacity: ${index === 0 ? '1' : '0.7'}; border-radius: 8px; overflow: hidden; padding: 0; cursor: pointer; transition: all 0.2s ease;">
          ${imageMarkup(url, `${template.title} ${index + 1}`, '', 220)}
        </button>
      `).join('');

      thumbs.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-gallery-index]');
        if (!button) return;
        const idx = parseInt(button.dataset.galleryIndex, 10);
        updateDetailsMainImage(idx);
      });
    }

    updateDetailsMainImage(0);

    qs('#details-add-to-bag-btn')?.addEventListener('click', () => addTemplateToCart(template));

    if (loading) loading.hidden = true;
    detailsContainer.hidden = false;
    detailsContainer.classList.add('details-grid');
    setupLazyCloudinaryImages(detailsContainer);
  } catch (error) {
    console.error('Failed to load product details:', error);
    if (loading) loading.innerHTML = '<p>Unable to load this product right now.</p>';
  }
}
