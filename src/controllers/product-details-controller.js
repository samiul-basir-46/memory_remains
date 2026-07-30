import { fetchTemplateById, fetchTemplates, DEFAULT_FEATURED_TEMPLATES, inferCollection, comparePrice, discountPercent } from '../services/templates-service.js';
import { renderProductDetailsSkeleton, renderEmptyState, renderErrorState } from '../components/skeleton.js';
import { addTemplateToCart } from '../services/cart-service.js';
import { imageMarkup } from '../components/product-card.js';
import { buildCloudinaryDeliveryUrl, setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { escapeHtml, formatCurrency, qs, qsa } from '../utils/ui.js';

const FALLBACK_IMAGE = '/assets/product_placeholder.png';

export async function renderProductDetailsPage(db) {
  const detailsContainer = qs('#details-content-container');
  if (!detailsContainer) return;
  const loading = qs('#details-loading-state');

  // STEP  Loader Immediately
  if (loading) {
    loading.innerHTML = renderProductDetailsSkeleton();
    loading.hidden = false;
  }
  detailsContainer.hidden = true;

  const params = new URLSearchParams(window.location.search);
  const templateId = params.get('id');

  try {
    let template = null;
    if (templateId) {
      template = await fetchTemplateById(db, templateId);
    } else if (db) {
      const allDbTemplates = await fetchTemplates(db);
      if (allDbTemplates && allDbTemplates.length > 0) {
        template = allDbTemplates[0];
      }
    }

    // STEP 2: Handle non-existent product explicitly
    if (!template) {
      if (loading) loading.hidden = true;
      detailsContainer.hidden = false;
      detailsContainer.innerHTML = renderEmptyState({
        title: templateId ? 'Product Not Found' : 'No Products Available',
        message: templateId
          ? `The requested product (ID: "${templateId}") does not exist or has been removed from our catalog.`
          : 'No product templates are currently available in the store.',
        actionText: 'Back to Shop',
        actionUrl: '/collections/paid-products'
      });
      return;
    }

    const allRawImages = [
      template.imageUrl,
      ...(Array.isArray(template.images) ? template.images : []),
      ...(Array.isArray(template.showcaseImages) ? template.showcaseImages : []),
      ...(Array.isArray(template.galleryUrls) ? template.galleryUrls : []),
      ...(Array.isArray(template.gallery) ? template.gallery : []),
      ...(Array.isArray(template.photos) ? template.photos : [])
    ].filter(Boolean);
    const gallery = Array.from(new Set(allRawImages));
    if (gallery.length === 0) {
      gallery.push(FALLBACK_IMAGE);
    }

    // Set Text Content & Badges
    const category = template.category || template.collection || template.target_audience || template.targetAudience || inferCollection(template);
    const title = template.title || template.name || 'Product details';
    const requiredPhotos = Number(
      template.requiredPhotos ||
      template.required_photos ||
      template.required_photo_count ||
      template.requiredImageCount ||
      template.photoCount ||
      template.photo_count ||
      12
    );
    const descriptionText = template.description || template.magazineDescription || template.templateDescription || template.subtitle || 'No description available for this product.';

    const breadcrumbTitle = qs('#details-breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = title;

    const catElem = qs('#details-category');
    if (catElem) catElem.textContent = category;

    const titleElem = qs('#details-title');
    if (titleElem) titleElem.textContent = title;

    const descElem = qs('#details-description');
    if (descElem) descElem.textContent = descriptionText;

    const photoBadge = qs('#details-photo-count-badge');
    if (photoBadge) photoBadge.textContent = `${requiredPhotos} Photos`;

    const badgeElem = qs('#details-badge');
    if (badgeElem) {
      const rawBadge = String(template.badge || template.offer_badge || '').trim();
      const isOfferTag = rawBadge.toLowerCase().includes('%') || rawBadge.toLowerCase().includes('off');
      if (rawBadge && !isOfferTag) {
        badgeElem.textContent = rawBadge;
        badgeElem.hidden = false;
      } else {
        badgeElem.hidden = true;
      }
    }

    // Render Specifications (Specs)
    const specsContainer = qs('#details-specs-container');
    const specsList = qs('#details-specs');
    if (specsContainer && specsList) {
      const specs = template.specs;
      if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) {
        specsList.innerHTML = Object.entries(specs)
          .map(([key, val]) => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            return `
              <div class="flex flex-col py-1">
                <span class="text-xs text-gray-400 font-medium">${escapeHtml(label)}</span>
                <span class="text-sm font-semibold text-gray-800">${escapeHtml(String(val))}</span>
              </div>
            `;
          })
          .join('');
        specsContainer.classList.remove('hidden');
      } else {
        specsContainer.classList.add('hidden');
      }
    }

    // Dual Selling Mode Setup
    const initialTab = params.get('tab');
    const productType = String(template.product_type || template.productType || 'magazine').toLowerCase().replace(/\s+/g, '_');
    const isMagazine = productType === 'magazine';
    const isBoth = productType === 'both';
    const isTemplateOnly = productType === 'template';

    const isTemplateForSaleExplicit = Boolean(
      template.is_template_for_sale ??
      template.isTemplateForSale ??
      template.allow_template_sale ??
      false
    );
    const templatePrice = Number(template.template_price || template.templatePrice || template.digital_price || template.digitalPrice || 0);

    const canSellDigitalTemplate = (isBoth || (isMagazine && isTemplateForSaleExplicit)) && templatePrice > 0;

    const saleTypes = {
      magazine: !isTemplateOnly,
      template: canSellDigitalTemplate
    };
    const magazinePrice = Number(template.magazinePrice || template.magazine_price || template.price || 499);

    let activeMode = 'magazine';
    if (initialTab === 'digital' && saleTypes.template) {
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
    const photoReqBox = qs('#details-photo-requirement-box');
    const templateNoticeBox = qs('#details-template-notice-box');
    const purchaseTypeSection = qs('#details-purchase-type-section');

    // Poster Wallboard Combo Pack Setup
    const isPoster = productType === 'poster';
    const comboPrices = template.comboPrices || {
      '5': Number(template.price || 500),
      '10': Number(template.price ? template.price * 1.8 : 900),
      '15': Number(template.price ? template.price * 2.6 : 1300),
      '20': Number(template.price ? template.price * 3.2 : 1600)
    };

    let selectedComboQty = 5;
    let selectedComboPrice = Number(comboPrices['5'] || template.price || 500);

    // Array holding spot selections for the selected combo pack (defaulting to preset designs)
    const presetGallery = (Array.isArray(template.showcaseImages) && template.showcaseImages.length > 0)
      ? template.showcaseImages
      : (Array.isArray(template.galleryUrls) && template.galleryUrls.length > 0 ? template.galleryUrls : [FALLBACK_IMAGE]);

    let posterSpots = [];

    const initPosterSpots = (qty) => {
      selectedComboQty = qty;
      selectedComboPrice = Number(comboPrices[qty] || template.price || 500);
      posterSpots = [];
      for (let i = 0; i < qty; i++) {
        const presetImg = presetGallery[i % presetGallery.length];
        posterSpots.push({
          spotIndex: i + 1,
          type: 'catalog', // 'catalog' or 'custom_upload'
          title: `Preset Design #${(i % presetGallery.length) + 1}`,
          imageUrl: presetImg,
          customFile: null
        });
      }
    };

    initPosterSpots(5);

    if (purchaseTypeSection) {
      if (isPoster) {
        purchaseTypeSection.hidden = true;
      } else {
        purchaseTypeSection.hidden = !(isMagazine && saleTypes.magazine && saleTypes.template);
      }
    }

    // Render Poster Combo Section if Poster
    let posterComboContainer = qs('#details-poster-combo-section');
    if (isPoster) {
      if (photoReqBox) photoReqBox.classList.add('hidden');
      if (templateNoticeBox) templateNoticeBox.classList.add('hidden');

      if (!posterComboContainer && detailsContainer) {
        const descBox = qs('#details-description')?.parentElement;
        posterComboContainer = document.createElement('div');
        posterComboContainer.id = 'details-poster-combo-section';
        posterComboContainer.className = 'space-y-5 pt-2 border-t border-gray-100 mt-4';
        if (descBox) {
          descBox.parentNode.insertBefore(posterComboContainer, descBox);
        } else {
          detailsContainer.querySelector('.detail-card')?.appendChild(posterComboContainer);
        }
      }

      const renderPosterComboUI = () => {
        if (!posterComboContainer) return;

        // Update main price display
        const priceElem = qs('#details-price');
        if (priceElem) priceElem.textContent = formatCurrency(selectedComboPrice);

        posterComboContainer.innerHTML = `
          <!-- Combo Pack Selector Header -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500">Select Combo Pack Size</h3>
              <span class="text-xs font-semibold text-primary">Min: 5 | Max: 20 Posters</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              ${[5, 10, 15, 20].map((qty) => {
                const p = Number(comboPrices[qty] || (qty * 100));
                const isSelected = selectedComboQty === qty;
                return `
                  <button type="button" data-poster-combo-qty="${qty}" class="p-3 rounded-xl border-2 text-center transition-all cursor-pointer focus:outline-none flex flex-col items-center justify-center space-y-1 ${isSelected ? 'border-primary bg-pink-50/80 shadow-md ring-2 ring-primary/20 scale-[1.02]' : 'border-gray-200 bg-white hover:border-pink-200'}">
                    <span class="text-xs font-bold ${isSelected ? 'text-primary' : 'text-gray-700'}">${qty} Posters</span>
                    <strong class="text-sm font-extrabold ${isSelected ? 'text-primary' : 'text-gray-900'}">৳${p}</strong>
                    <span class="text-[10px] text-gray-400">৳${Math.round(p / qty)} / pic</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Spots Fulfillment Summary & Grid Header -->
          <div class="bg-gradient-to-r from-violet-50 to-pink-50 border border-violet-200 rounded-xl p-4 shadow-sm space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 class="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  <i class="fa-solid fa-layer-group text-primary"></i>
                  ${selectedComboQty} Poster Spots Selected
                </h4>
                <p class="text-xs text-gray-600 mt-0.5">Customize each spot with our preset designs or upload your own photos.</p>
              </div>
              <span class="px-2.5 py-1 bg-white text-primary border border-pink-200 text-xs font-bold rounded-lg shadow-2xs">
                ${posterSpots.filter(s => s.type === 'custom_upload').length} Custom • ${posterSpots.filter(s => s.type === 'catalog').length} Store Preset
              </span>
            </div>

            <!-- Spots List Grid -->
            <div class="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-5 gap-2 pt-1">
              ${posterSpots.map((spot, idx) => `
                <div class="relative aspect-square rounded-lg overflow-hidden border-2 bg-gray-100 group shadow-2xs ${spot.type === 'custom_upload' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'}">
                  <img src="${spot.imageUrl}" class="w-full h-full object-cover" alt="Spot ${idx + 1}">
                  <span class="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-bold rounded">#${idx + 1}</span>
                  <span class="absolute bottom-1 right-1 px-1 py-0.5 ${spot.type === 'custom_upload' ? 'bg-emerald-600' : 'bg-primary'} text-white text-[8px] font-bold rounded">
                    ${spot.type === 'custom_upload' ? '📷 Photo' : '🎨 Store'}
                  </span>
                  <button type="button" data-spot-change-idx="${idx}" class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 cursor-pointer">
                    <i class="fa-solid fa-pen-to-square"></i> Change
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        // Bind Combo Qty Selector Clicks
        posterComboContainer.querySelectorAll('button[data-poster-combo-qty]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const qty = parseInt(btn.dataset.posterComboQty, 10);
            initPosterSpots(qty);
            renderPosterComboUI();
          });
        });

        // Bind Spot Change Clicks
        posterComboContainer.querySelectorAll('button[data-spot-change-idx]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.spotChangeIdx, 10);
            openPosterSpotModal(idx);
          });
        });
      };

      const openPosterSpotModal = (spotIdx) => {
        let modal = qs('#poster-spot-picker-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'poster-spot-picker-modal';
          modal.className = 'fixed inset-0 z-[1050] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity';
          document.body.appendChild(modal);
        }

        const currentSpot = posterSpots[spotIdx];

        modal.innerHTML = `
          <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 class="font-bold text-gray-900 text-base">Customize Poster Spot #${spotIdx + 1}</h3>
                <p class="text-xs text-gray-500">Pick any design from our store or upload a custom image.</p>
              </div>
              <button type="button" id="spot-modal-close-btn" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm cursor-pointer">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <!-- Choice Option Tabs -->
            <div class="space-y-4">
              <!-- Option A: Upload Custom Photo -->
              <div class="p-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 text-center space-y-2">
                <i class="fa-solid fa-cloud-arrow-up text-2xl text-emerald-600"></i>
                <h4 class="font-bold text-gray-800 text-sm m-0">Upload Your Own Photo</h4>
                <p class="text-xs text-gray-500 m-0">Select an image from your device for Spot #${spotIdx + 1}</p>
                <input type="file" id="spot-file-input" accept="image/*" class="hidden">
                <button type="button" id="spot-upload-btn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer">
                  <i class="fa-solid fa-camera mr-1"></i> Choose Photo from Device
                </button>
              </div>

              <!-- Option B: Select Preset Design from Gallery -->
              <div>
                <h4 class="font-bold text-gray-800 text-xs uppercase tracking-wider mb-2">Or Choose from Store Designs (${presetGallery.length})</h4>
                <div class="grid grid-cols-4 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1.5 border border-gray-200 rounded-xl">
                  ${presetGallery.map((imgUrl, pIdx) => {
                    const isCurrentlySelected = currentSpot && currentSpot.imageUrl === imgUrl;
                    return `
                      <button type="button" data-preset-select-url="${escapeHtml(imgUrl)}" data-preset-idx="${pIdx}" class="aspect-square rounded-lg overflow-hidden border-2 ${isCurrentlySelected ? 'border-primary ring-2 ring-primary/30 shadow-md scale-[1.03]' : 'border-gray-200 hover:border-primary'} transition-all cursor-pointer relative group">
                        <img src="${imgUrl}" class="w-full h-full object-cover">
                        ${isCurrentlySelected ? `<span class="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shadow">✓</span>` : ''}
                        <span class="absolute bottom-0 inset-x-0 bg-black/75 text-white text-[9px] text-center font-bold py-0.5">Design #${pIdx + 1}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
        `;

        const closeModal = () => {
          modal.remove();
        };

        modal.querySelector('#spot-modal-close-btn')?.addEventListener('click', closeModal);

        const fileInput = modal.querySelector('#spot-file-input');
        const uploadBtn = modal.querySelector('#spot-upload-btn');

        uploadBtn?.addEventListener('click', () => fileInput?.click());

        fileInput?.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
              posterSpots[spotIdx] = {
                spotIndex: spotIdx + 1,
                type: 'custom_upload',
                title: `Custom Upload (${file.name})`,
                imageUrl: evt.target.result,
                customFile: file
              };
              renderPosterComboUI();
              closeModal();
            };
            reader.readAsDataURL(file);
          }
        });

        modal.querySelectorAll('button[data-preset-select-url]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const url = btn.dataset.presetSelectUrl;
            const pIdx = btn.dataset.presetIdx;
            posterSpots[spotIdx] = {
              spotIndex: spotIdx + 1,
              type: 'catalog',
              title: `Preset Design #${parseInt(pIdx, 10) + 1}`,
              imageUrl: url,
              customFile: null
            };
            renderPosterComboUI();
            closeModal();
          });
        });
      };

      renderPosterComboUI();
    }

    let typeLabel = 'product';
    if (productType === 'magazine') typeLabel = 'magazine';
    else if (productType === 'wall_frame') typeLabel = 'wall frame';
    else if (productType === 'poster') typeLabel = 'poster';
    else if (productType === 'sticker') typeLabel = 'sticker';

    const photoDesc = qs('#details-photo-requirement-desc');
    if (photoDesc) photoDesc.textContent = `You will need to provide ${requiredPhotos} high-resolution photos for this custom ${typeLabel}.`;

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
          discountElem.innerHTML = `<i class="fa-solid fa-fire-flame-curved text-[10px]"></i> ${discount}% OFF`;
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

      // Dynamic Feature Checklist & Notes: Only show photo requirement box for magazine product type
      const isMagazineProduct = productType === 'magazine';
      if (isMagazineProduct && activeMode === 'magazine') {
        if (photoReqBox) photoReqBox.classList.remove('hidden');
        if (templateNoticeBox) templateNoticeBox.classList.add('hidden');
      } else {
        if (photoReqBox) photoReqBox.classList.add('hidden');
        if (templateNoticeBox) {
          if (activeMode === 'template') {
            templateNoticeBox.classList.remove('hidden');
          } else {
            templateNoticeBox.classList.add('hidden');
          }
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

    // Dynamic Full Image Gallery Setup
    const galleryList = Array.from(new Set(gallery.filter(Boolean)));
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
      thumbsContainer.innerHTML = galleryList.map((url, index) => {
        const thumbSrc = buildCloudinaryDeliveryUrl(url, { width: 300 });
        const blurSrc = buildCloudinaryDeliveryUrl(url, { width: 100 });
        const escapedTitle = escapeHtml(template.title || template.name || 'Product');
        const isActive = index === 0;

        return `
          <button type="button" data-gallery-index="${index}" data-gallery-src="${escapeHtml(url)}" aria-label="View image ${index + 1}" class="relative aspect-[3/4] sm:aspect-square rounded-xl overflow-hidden bg-gray-950 border-2 transition-all duration-200 cursor-pointer focus:outline-none flex items-center justify-center p-1 shadow-sm ${isActive ? 'border-primary ring-2 ring-primary/30 opacity-100 scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'}">
            <img src="${blurSrc}" alt="" class="absolute inset-0 w-full h-full object-cover blur-md opacity-40 scale-125 pointer-events-none">
            <img src="${thumbSrc}" alt="${escapedTitle} preview ${index + 1}" class="relative z-10 max-w-full max-h-full object-contain drop-shadow-sm">
            <span class="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/75 text-white text-[10px] font-semibold rounded-md z-20">${index + 1}</span>
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
      if (isPoster) {
        addTemplateToCart({
          ...template,
          title: `${template.title || 'Poster Combo'} (${selectedComboQty} Posters Pack)`,
          price: selectedComboPrice,
          purchaseMode: 'poster',
          product_type: 'poster',
          comboQuantity: selectedComboQty,
          selectedPosters: posterSpots
        });
      } else {
        const activePrice = activeMode === 'magazine' ? magazinePrice : templatePrice;
        const titleSuffix = activeMode === 'template' ? ' (Digital Template)' : ' (Printed Magazine)';
        addTemplateToCart({
          ...template,
          title: `${template.title || 'Product'}${titleSuffix}`,
          price: activePrice,
          purchaseMode: activeMode
        });
      }
    });

    // Buy Now Button
    qs('#details-buy-now-btn')?.addEventListener('click', () => {
      if (isPoster) {
        addTemplateToCart({
          ...template,
          title: `${template.title || 'Poster Combo'} (${selectedComboQty} Posters Pack)`,
          price: selectedComboPrice,
          purchaseMode: 'poster',
          product_type: 'poster',
          comboQuantity: selectedComboQty,
          selectedPosters: posterSpots
        });
      } else {
        const activePrice = activeMode === 'magazine' ? magazinePrice : templatePrice;
        const titleSuffix = activeMode === 'template' ? ' (Digital Template)' : ' (Printed Magazine)';
        addTemplateToCart({
          ...template,
          title: `${template.title || 'Product'}${titleSuffix}`,
          price: activePrice,
          purchaseMode: activeMode
        });
      }
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
