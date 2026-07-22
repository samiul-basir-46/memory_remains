import { fetchTemplateById, fetchTemplates, DEFAULT_FEATURED_TEMPLATES, inferCollection, comparePrice, discountPercent } from '../services/templates-service.js';
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
    let template = null;
    if (templateId) {
      template = await fetchTemplateById(db, templateId);
    }

    if (!template && !templateId) {
      if (db) {
        const allDbTemplates = await fetchTemplates(db);
        if (allDbTemplates && allDbTemplates.length > 0) {
          template = allDbTemplates[0];
        }
      }
      if (!template) {
        template = DEFAULT_FEATURED_TEMPLATES[0];
      }
    }

    const gallery = Array.from(new Set([template.imageUrl, ...(template.galleryUrls || [])].filter(Boolean)));
    if (gallery.length === 0) {
      gallery.push(FALLBACK_IMAGE);
    }

    // Set Text Content & Badges
    const category = inferCollection(template);
    const title = template.title || 'Product details';
    const requiredPhotos = template.requiredPhotos || 12;

    const breadcrumbTitle = qs('#details-breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = title;

    const catElem = qs('#details-category');
    if (catElem) catElem.textContent = category;

    const titleElem = qs('#details-title');
    if (titleElem) titleElem.textContent = title;

    // Dual Selling Mode Setup
    const saleTypes = template.saleTypes || { magazine: true, template: true };
    const magazinePrice = template.magazinePrice || template.price || 499;
    const templatePrice = template.templatePrice || template.digitalPrice || 199;

    let activeMode = 'magazine';
    if (saleTypes.magazine && saleTypes.template) {
      activeMode = 'magazine';
    } else if (saleTypes.template && !saleTypes.magazine) {
      activeMode = 'template';
    } else {
      activeMode = 'magazine';
    }

    const modeBtnMagazine = qs('#mode-btn-magazine');
    const modeBtnTemplate = qs('#mode-btn-template');
    const modePriceMag = qs('#mode-price-magazine');
    const modePriceTpl = qs('#mode-price-template');
    const modeBadgeMag = qs('#mode-badge-magazine');
    const modeBadgeTpl = qs('#mode-badge-template');
    const templateNoticeBox = qs('#details-template-notice-box');
    const photoReqBox = qs('#details-photo-requirement-box');
    const featuresList = qs('#details-features-list');

    if (modePriceMag) modePriceMag.textContent = formatCurrency(magazinePrice);
    if (modePriceTpl) modePriceTpl.textContent = formatCurrency(templatePrice);

    // Disable cards if mode not available
    if (modeBtnMagazine) {
      if (!saleTypes.magazine) {
        modeBtnMagazine.disabled = true;
        modeBtnMagazine.classList.add('opacity-40', 'cursor-not-allowed', 'bg-gray-50');
        if (modeBadgeMag) {
          modeBadgeMag.textContent = 'Unavailable';
          modeBadgeMag.className = 'px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-gray-200 text-gray-500';
        }
      }
    }

    if (modeBtnTemplate) {
      if (!saleTypes.template) {
        modeBtnTemplate.disabled = true;
        modeBtnTemplate.classList.add('opacity-40', 'cursor-not-allowed', 'bg-gray-50');
        if (modeBadgeTpl) {
          modeBadgeTpl.textContent = 'Unavailable';
          modeBadgeTpl.className = 'px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-gray-200 text-gray-500';
        }
      }
    }

    const updateModeUI = (selectedMode) => {
      activeMode = selectedMode;

      // Update Active Price
      const activePrice = activeMode === 'magazine' ? magazinePrice : templatePrice;
      const priceElem = qs('#details-price');
      if (priceElem) priceElem.textContent = formatCurrency(activePrice);

      const compare = comparePrice(template);
      const discount = discountPercent(template);

      const compareElem = qs('#details-compare-price');
      if (compareElem) {
        if (compare && compare > activePrice) {
          compareElem.textContent = formatCurrency(compare);
          compareElem.hidden = false;
        } else {
          compareElem.hidden = true;
        }
      }

      const discountElem = qs('#details-discount-badge');
      if (discountElem) {
        if (discount && discount > 0) {
          discountElem.textContent = `${discount}% OFF`;
          discountElem.hidden = false;
        } else {
          discountElem.hidden = true;
        }
      }

      // Update Selector Buttons Styling
      if (modeBtnMagazine && saleTypes.magazine) {
        if (activeMode === 'magazine') {
          modeBtnMagazine.className = 'purchase-type-card relative p-4 rounded-2xl border-2 border-primary bg-pink-50/50 shadow-md ring-2 ring-primary/20 scale-[1.01] text-left transition-all duration-200 cursor-pointer focus:outline-none flex flex-col justify-between space-y-3';
          if (modeBadgeMag) {
            modeBadgeMag.textContent = '✔ Selected';
            modeBadgeMag.className = 'px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-primary text-white shadow-sm';
          }
        } else {
          modeBtnMagazine.className = 'purchase-type-card relative p-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-pink-200 text-left transition-all duration-200 cursor-pointer focus:outline-none flex flex-col justify-between space-y-3';
          if (modeBadgeMag) {
            modeBadgeMag.textContent = 'Available';
            modeBadgeMag.className = 'px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-pink-100 text-primary';
          }
        }
      }

      if (modeBtnTemplate && saleTypes.template) {
        if (activeMode === 'template') {
          modeBtnTemplate.className = 'purchase-type-card relative p-4 rounded-2xl border-2 border-purple-600 bg-purple-50/60 shadow-md ring-2 ring-purple-600/20 scale-[1.01] text-left transition-all duration-200 cursor-pointer focus:outline-none flex flex-col justify-between space-y-3';
          if (modeBadgeTpl) {
            modeBadgeTpl.textContent = '✔ Selected';
            modeBadgeTpl.className = 'px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-purple-600 text-white shadow-sm';
          }
        } else {
          modeBtnTemplate.className = 'purchase-type-card relative p-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-purple-200 text-left transition-all duration-200 cursor-pointer focus:outline-none flex flex-col justify-between space-y-3';
          if (modeBadgeTpl) {
            modeBadgeTpl.textContent = 'Available';
            modeBadgeTpl.className = 'px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-purple-100 text-purple-700';
          }
        }
      }

      // Dynamic Feature Checklist & Notes
      if (activeMode === 'magazine') {
        if (photoReqBox) photoReqBox.classList.remove('hidden');
        if (templateNoticeBox) templateNoticeBox.classList.add('hidden');

        if (featuresList) {
          featuresList.innerHTML = `
            <li class="flex items-center gap-2.5 text-gray-700"><i class="fa-solid fa-circle-check text-emerald-500 text-base"></i> Physical printed custom magazine hardcopy</li>
            <li class="flex items-center gap-2.5 text-gray-700"><i class="fa-solid fa-circle-check text-emerald-500 text-base"></i> High-quality premium paper & vivid color printing</li>
            <li class="flex items-center gap-2.5 text-gray-700"><i class="fa-solid fa-circle-check text-emerald-500 text-base"></i> Home delivery available across Bangladesh (3-15 days)</li>
            <li class="flex items-center gap-2.5 text-gray-700"><i class="fa-solid fa-circle-check text-emerald-500 text-base"></i> Cash on Delivery (COD) option available</li>
          `;
        }
      } else {
        if (photoReqBox) photoReqBox.classList.add('hidden');
        if (templateNoticeBox) templateNoticeBox.classList.remove('hidden');

        if (featuresList) {
          featuresList.innerHTML = `
            <li class="flex items-center gap-2.5 text-gray-700"><i class="fa-solid fa-circle-check text-purple-600 text-base"></i> Instant digital Canva template link delivery</li>
            <li class="flex items-center gap-2.5 text-gray-700"><i class="fa-solid fa-circle-check text-purple-600 text-base"></i> Fully customizable layout, text & photos</li>
            <li class="flex items-center gap-2.5 text-gray-700"><i class="fa-solid fa-circle-check text-purple-600 text-base"></i> High-resolution 300 DPI print-ready PDF export</li>
            <li class="flex items-center gap-2.5 text-gray-700"><i class="fa-solid fa-circle-check text-purple-600 text-base"></i> Advance payment required for instant access</li>
          `;
        }
      }
    };

    modeBtnMagazine?.addEventListener('click', () => {
      if (saleTypes.magazine) updateModeUI('magazine');
    });

    modeBtnTemplate?.addEventListener('click', () => {
      if (saleTypes.template) updateModeUI('template');
    });

    updateModeUI(activeMode);

    // Dynamic 3-Image Gallery Setup
    const displayImages = (template.images && template.images.length > 0) ? template.images : gallery;
    const galleryList = Array.from(new Set(displayImages.filter(Boolean)));
    if (galleryList.length === 0) galleryList.push(FALLBACK_IMAGE);

    let activeGalleryIdx = 0;

    const mainImg = qs('#details-main-image');
    const blurBgImg = qs('#details-bg-blurred-image');
    const galleryContainer = qs('#gallery-main-container');
    const thumbsContainer = qs('#details-thumbnails-gallery');
    const counterText = qs('#details-image-counter-text');
    const thumbsCount = qs('#details-thumbnails-count');

    if (thumbsCount) {
      thumbsCount.textContent = `${galleryList.length} Preview ${galleryList.length === 1 ? 'Image' : 'Images'}`;
    }

    const updateDetailsMainImage = (index) => {
      activeGalleryIdx = (index + galleryList.length) % galleryList.length;
      const nextSrc = galleryList[activeGalleryIdx] || FALLBACK_IMAGE;
      const deliveryUrl = buildCloudinaryDeliveryUrl(nextSrc, { width: 1200 });

      if (mainImg) {
        mainImg.src = deliveryUrl;
        mainImg.onerror = () => { mainImg.src = FALLBACK_IMAGE; };
      }

      if (blurBgImg) {
        blurBgImg.src = deliveryUrl;
        blurBgImg.onerror = () => { blurBgImg.src = FALLBACK_IMAGE; };
      }

      if (counterText) {
        counterText.textContent = `${activeGalleryIdx + 1} / ${galleryList.length}`;
      }

      if (thumbsContainer) {
        const btns = thumbsContainer.querySelectorAll('button[data-gallery-index]');
        btns.forEach((btn, i) => {
          const isActive = i === activeGalleryIdx;
          if (isActive) {
            btn.classList.add('border-primary', 'ring-2', 'ring-primary/30', 'opacity-100', 'scale-105');
            btn.classList.remove('opacity-70', 'border-gray-200');
          } else {
            btn.classList.remove('border-primary', 'ring-2', 'ring-primary/30', 'scale-105');
            btn.classList.add('opacity-70', 'border-gray-200');
          }
        });
      }
    };

    if (galleryContainer && galleryList.length > 1) {
      let arrows = galleryContainer.querySelector('.details-gallery-arrows');
      if (!arrows) {
        arrows = document.createElement('div');
        arrows.className = 'details-gallery-arrows';
        arrows.innerHTML = `
          <button type="button" class="details-prev-btn absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-primary shadow-md hover:shadow-lg transition-all flex items-center justify-center cursor-pointer border border-pink-100/80 active:scale-95" aria-label="Previous view">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <button type="button" class="details-next-btn absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-primary shadow-md hover:shadow-lg transition-all flex items-center justify-center cursor-pointer border border-pink-100/80 active:scale-95" aria-label="Next view">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        `;
        galleryContainer.appendChild(arrows);
      }

      arrows.querySelector('.details-prev-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        updateDetailsMainImage(activeGalleryIdx - 1);
      });
      arrows.querySelector('.details-next-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        updateDetailsMainImage(activeGalleryIdx + 1);
      });
    }

    if (thumbsContainer) {
      thumbsContainer.innerHTML = galleryList.slice(0, 3).map((url, index) => {
        const thumbSrc = buildCloudinaryDeliveryUrl(url, { width: 300 });
        const blurSrc = buildCloudinaryDeliveryUrl(url, { width: 100 });
        const escapedTitle = escapeHtml(template.title || 'Product');
        const isActive = index === 0;

        return `
          <button type="button" data-gallery-index="${index}" data-gallery-src="${escapeHtml(url)}" aria-label="View image ${index + 1}" class="relative aspect-[3/4] sm:aspect-square rounded-xl overflow-hidden bg-gray-950 border-2 transition-all duration-200 cursor-pointer focus:outline-none flex items-center justify-center p-1 shadow-sm ${isActive ? 'border-primary ring-2 ring-primary/30 opacity-100 scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'}">
            <img src="${blurSrc}" alt="" class="absolute inset-0 w-full h-full object-cover blur-md opacity-40 scale-125 pointer-events-none">
            <img src="${thumbSrc}" alt="${escapedTitle} preview ${index + 1}" class="relative z-10 max-w-full max-h-full object-contain drop-shadow-sm">
            <span class="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/75 text-white text-[10px] font-semibold rounded-md z-20">Image ${index + 1}</span>
          </button>
        `;
      }).join('');

      thumbsContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-gallery-index]');
        if (!button) return;
        const idx = parseInt(button.dataset.galleryIndex, 10);
        updateDetailsMainImage(idx);
      });
    }

    updateDetailsMainImage(0);

    // Lightbox Fullscreen Modal
    const lightboxModal = qs('#details-lightbox-modal');
    const lightboxImg = qs('#lightbox-img');
    const lightboxCounterText = qs('#lightbox-counter-text');
    const lightboxCloseBtn = qs('#lightbox-close-btn');
    const lightboxPrevBtn = qs('#lightbox-prev-btn');
    const lightboxNextBtn = qs('#lightbox-next-btn');
    const fullscreenTrigger = qs('#details-fullscreen-btn');

    const updateLightboxImage = (index) => {
      activeGalleryIdx = (index + galleryList.length) % galleryList.length;
      const nextSrc = galleryList[activeGalleryIdx] || FALLBACK_IMAGE;
      if (lightboxImg) {
        lightboxImg.src = buildCloudinaryDeliveryUrl(nextSrc, { width: 1600 });
      }
      if (lightboxCounterText) {
        lightboxCounterText.textContent = `${activeGalleryIdx + 1} / ${galleryList.length}`;
      }
      updateDetailsMainImage(activeGalleryIdx);
    };

    const openLightbox = () => {
      if (!lightboxModal) return;
      updateLightboxImage(activeGalleryIdx);
      lightboxModal.classList.remove('opacity-0', 'pointer-events-none');
      lightboxModal.classList.add('opacity-100');
      lightboxModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
      if (!lightboxModal) return;
      lightboxModal.classList.remove('opacity-100');
      lightboxModal.classList.add('opacity-0', 'pointer-events-none');
      lightboxModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    fullscreenTrigger?.addEventListener('click', openLightbox);
    mainImg?.addEventListener('click', openLightbox);
    lightboxCloseBtn?.addEventListener('click', closeLightbox);

    lightboxPrevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      updateLightboxImage(activeGalleryIdx - 1);
    });

    lightboxNextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      updateLightboxImage(activeGalleryIdx + 1);
    });

    lightboxModal?.addEventListener('click', (e) => {
      if (e.target === lightboxModal || e.target.closest('#lightbox-close-btn')) {
        closeLightbox();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!lightboxModal || lightboxModal.classList.contains('pointer-events-none')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') updateLightboxImage(activeGalleryIdx - 1);
      if (e.key === 'ArrowRight') updateLightboxImage(activeGalleryIdx + 1);
    });

    // Add to Bag Button
    qs('#details-add-to-bag-btn')?.addEventListener('click', () => {
      const activePrice = activeMode === 'magazine' ? magazinePrice : templatePrice;
      const titleSuffix = activeMode === 'template' ? ' (Digital Template)' : ' (Printed Magazine)';
      addTemplateToCart({
        ...template,
        title: `${template.title || 'Product'}${titleSuffix}`,
        price: activePrice,
        purchaseMode: activeMode
      });
    });

    // Buy Now Button
    qs('#details-buy-now-btn')?.addEventListener('click', () => {
      const activePrice = activeMode === 'magazine' ? magazinePrice : templatePrice;
      const titleSuffix = activeMode === 'template' ? ' (Digital Template)' : ' (Printed Magazine)';
      addTemplateToCart({
        ...template,
        title: `${template.title || 'Product'}${titleSuffix}`,
        price: activePrice,
        purchaseMode: activeMode
      });
      window.location.href = '/pages/cart';
    });

    if (loading) loading.hidden = true;
    detailsContainer.hidden = false;
    setupLazyCloudinaryImages(detailsContainer);
  } catch (error) {
    console.error('Failed to load product details:', error);
    if (loading) {
      loading.innerHTML = `
        <div class="text-center py-8">
          <i class="fa-solid fa-triangle-exclamation text-rose-500 text-3xl mb-3"></i>
          <h2 class="font-heading text-xl text-gray-800 mb-2">Unable to Load Product</h2>
          <p class="text-sm text-gray-500 mb-4">The product could not be fetched right now. Please try again.</p>
          <a href="/collections/paid-products" class="inline-block px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg shadow">Back to Shop</a>
        </div>
      `;
    }
  }
}
