import { fetchTemplateById, fetchTemplates, fetchRelatedTemplates, DEFAULT_FEATURED_TEMPLATES, inferCollection, comparePrice, discountPercent } from '../services/templates-service.js';
import { renderProductDetailsSkeleton, renderEmptyState, renderErrorState } from '../components/skeleton.js';
import { addTemplateToCart, clearCart } from '../services/cart-service.js';
import { imageMarkup, renderProductCardV2 } from '../components/product-card.js';
import { buildCloudinaryDeliveryUrl, setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { escapeHtml, formatCurrency, qs, qsa } from '../utils/ui.js';

const FALLBACK_IMAGE = '/assets/product_placeholder.png';

const MAGAZINE_PAGE_TIERS = [
  { pages: 4, label: '4 Pages', price: 259, base_price: 259, minPhotos: 8, maxPhotos: 12 },
  { pages: 8, label: '8 Pages', price: 499, base_price: 499, minPhotos: 15, maxPhotos: 20 },
  { pages: 12, label: '12 Pages', price: 699, base_price: 699, minPhotos: 22, maxPhotos: 30 },
  { pages: 16, label: '16 Pages', price: 849, base_price: 849, minPhotos: 35, maxPhotos: 45 },
  { pages: 20, label: '20 Pages', price: 999, base_price: 999, minPhotos: 45, maxPhotos: 55 },
  { pages: 24, label: '24 Pages', price: 1149, base_price: 1149, minPhotos: 55, maxPhotos: 65 }
];

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
    const productType = String(template.product_type || template.productType || 'magazine').toLowerCase().replace(/\s+/g, '_');
    const isMagazine = productType === 'magazine';
    const isBoth = productType === 'both';
    const isTemplateOnly = productType === 'template';
    const isPoster = productType === 'poster';
    const isFrame = productType === 'wall_frame' || productType === 'frame';
    const isSticker = productType === 'sticker';

    const minPhotos = Number(template.minPhotos || template.min_photos || template.minImageCount || 0);
    const maxPhotos = Number(
      template.maxPhotos ||
      template.max_photos ||
      template.maxImageCount ||
      template.requiredPhotos ||
      template.required_photos ||
      template.required_photo_count ||
      template.requiredImageCount ||
      template.photoCount ||
      template.photo_count ||
      (isMagazine ? 20 : (isPoster ? 5 : 8))
    );
    const effectiveMin = (minPhotos > 0 && minPhotos <= maxPhotos) ? minPhotos : maxPhotos;
    const effectiveMax = maxPhotos;
    const requiredPhotos = effectiveMax;
    const photoRangeDisplay = (effectiveMin > 0 && effectiveMin !== effectiveMax)
      ? `${effectiveMin}–${effectiveMax} Photos`
      : `${effectiveMax} Photos`;

    // Magazine Page Selection setup from Dynamic Template Page Tiers or default
    const availablePageTiers = (Array.isArray(template.pageTiers) && template.pageTiers.length > 0)
      ? template.pageTiers
      : (Array.isArray(template.page_tiers) && template.page_tiers.length > 0
          ? template.page_tiers
          : MAGAZINE_PAGE_TIERS);

    const initialPageNum = Number(template.pages || template.page_count || 8);
    let selectedPageTier = availablePageTiers.find(t => t.pages === initialPageNum) || availablePageTiers[0];
    let selectedMagazinePrice = selectedPageTier.price;

    const pages = template.pages || template.page_count || template.pageCount || template.totalPages || template.total_pages || (isMagazine ? '8 Pages' : '');
    const size = template.size || template.dimension || template.dimensions || template.paper_size || (isMagazine ? 'A4 (8.27" x 11.69")' : (isPoster ? 'A4 Size (8.3" × 11.7")' : (isFrame ? '8×10 in / A4' : (isSticker ? 'A4 Sheet' : 'Standard'))));
    const paper = template.paper || template.paper_type || template.paperType || template.paper_quality || template.paperQuality || template.paper_gsm || template.gsm || template.material || (isMagazine ? '300 GSM Premium Glossy Art Paper' : (isPoster ? '300 GSM Art Card' : (isFrame ? 'Premium Frame & Glass Sheet' : (isSticker ? 'Waterproof Vinyl' : 'Premium Quality'))));
    const cover = template.cover || template.cover_type || template.coverType || template.finish || template.cover_finish || template.lamination || (isMagazine ? 'Glossy Protective Lamination' : (isPoster ? 'Glossy / Matte Laminated' : 'Protective Lamination'));
    const binding = template.binding || template.binding_type || template.bindingType || (isMagazine ? 'Center Pin / Saddle Stitch' : '');
    const deliveryTime = '4–6 Days Inside Dhaka, 5–7 Days Outside Dhaka';
    const printQuality = template.print_quality || template.printQuality || template.printing || 'Ultra HD 2400 DPI Full Color';
    const packaging = template.packaging || template.packaging_type || 'Gift Envelope & Protective Packaging';
    const occasion = template.occasion || template.theme || category || 'Personalized Special Memories';

    const descriptionText = template.description || template.magazineDescription || template.templateDescription || template.subtitle || 'No description available for this product.';

    const breadcrumbTitle = qs('#details-breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = title;

    const catElem = qs('#details-category');
    if (catElem) catElem.textContent = category;

    const titleElem = qs('#details-title');
    if (titleElem) titleElem.textContent = title;

    const descElem = qs('#details-description');
    if (descElem) descElem.textContent = descriptionText;

    const getActivePhotoInfo = () => {
      if (isMagazine && selectedPageTier) {
        const minP = Number(selectedPageTier.minPhotos || selectedPageTier.min_photos || 0);
        const maxP = Number(selectedPageTier.maxPhotos || selectedPageTier.max_photos || 0);
        const rangeText = (minP > 0 && minP !== maxP) ? `${minP}–${maxP} Photos` : `${maxP || minP} Photos`;
        return { minP: minP || effectiveMin, maxP: maxP || effectiveMax, rangeText };
      }
      return { minP: effectiveMin, maxP: effectiveMax, rangeText: photoRangeDisplay };
    };

    const updatePhotoRequirementBadges = () => {
      const { minP, maxP, rangeText } = getActivePhotoInfo();
      const photoBadge = qs('#details-photo-count-badge');
      if (photoBadge) photoBadge.textContent = rangeText;

      const photoReqDesc = qs('#details-photo-requirement-desc');
      if (photoReqDesc) {
        if (minP > 0 && minP !== maxP) {
          photoReqDesc.textContent = `You can upload between ${minP} to ${maxP} high-resolution photos for this ${selectedPageTier ? selectedPageTier.label : ''} custom magazine.`;
        } else {
          photoReqDesc.textContent = `You will need to provide ${maxP} high-resolution photos for this custom magazine.`;
        }
      }
    };

    updatePhotoRequirementBadges();

    const badgeElem = qs('#details-badge');
    if (badgeElem) {
      let rawBadge = String(template.badge || template.offer_badge || template.offer_tag || template.offer_text || '').trim();
      const isOfferExplicitlyDisabled = template.hasOffer === false || template.has_offer === false || Number(template.offerPercentage || template.offer_percentage || 0) === 0;
      if (isOfferExplicitlyDisabled && (rawBadge.toLowerCase().includes('% off') || rawBadge.toLowerCase().includes('off'))) {
        rawBadge = '';
      }
      if (rawBadge) {
        badgeElem.textContent = rawBadge;
        badgeElem.hidden = false;
      } else {
        badgeElem.hidden = true;
      }
    }

    // Function to render the Quick Highlights Grid
    const renderHighlightsGrid = (mode) => {
      const highlightsGrid = qs('#details-highlights-grid');
      if (!highlightsGrid) return;

      if (mode === 'template') {
        highlightsGrid.innerHTML = `
          <div class="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Format</span>
              <strong class="text-xs font-bold text-gray-800">Canva Link</strong>
            </div>
          </div>
          <div class="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-bolt"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Delivery</span>
              <strong class="text-xs font-bold text-gray-800">Instant Access</strong>
            </div>
          </div>
          <div class="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-mobile-screen"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Compatibility</span>
              <strong class="text-xs font-bold text-gray-800">Mobile & PC</strong>
            </div>
          </div>
          <div class="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-pen-nib"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Customization</span>
              <strong class="text-xs font-bold text-gray-800">100% Editable</strong>
            </div>
          </div>
          <div class="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-file-pdf"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Export Format</span>
              <strong class="text-xs font-bold text-gray-800">Print-Ready PDF</strong>
            </div>
          </div>
          <div class="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-infinity"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Usage</span>
              <strong class="text-xs font-bold text-gray-800">Lifetime Access</strong>
            </div>
          </div>
        `;
      } else {
        const { rangeText } = getActivePhotoInfo();
        // Physical Magazine / Product Highlights
        highlightsGrid.innerHTML = `
          <div class="p-3 bg-pink-50/50 rounded-xl border border-pink-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-pink-100 text-primary flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-book-open"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Total Pages</span>
              <strong class="text-xs font-bold text-gray-800">${isMagazine ? selectedPageTier.label : escapeHtml(pages)}</strong>
            </div>
          </div>
          <div class="p-3 bg-pink-50/50 rounded-xl border border-pink-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-pink-100 text-primary flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-camera"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Required Photos</span>
              <strong class="text-xs font-bold text-gray-800">${rangeText}</strong>
            </div>
          </div>
          <div class="p-3 bg-pink-50/50 rounded-xl border border-pink-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-pink-100 text-primary flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-ruler-combined"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Paper Size</span>
              <strong class="text-xs font-bold text-gray-800">${escapeHtml(size)}</strong>
            </div>
          </div>
          <div class="p-3 bg-pink-50/50 rounded-xl border border-pink-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-pink-100 text-primary flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Paper Quality</span>
              <strong class="text-xs font-bold text-gray-800 truncate max-w-[110px]" title="${escapeHtml(paper)}">${escapeHtml(paper)}</strong>
            </div>
          </div>
          <div class="p-3 bg-pink-50/50 rounded-xl border border-pink-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-pink-100 text-primary flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-print"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Print Resolution</span>
              <strong class="text-xs font-bold text-gray-800 truncate max-w-[110px]" title="${escapeHtml(printQuality)}">Ultra HD</strong>
            </div>
          </div>
          <div class="p-3 bg-pink-50/50 rounded-xl border border-pink-100 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-pink-100 text-primary flex items-center justify-center text-sm flex-shrink-0">
              <i class="fa-solid fa-truck-fast"></i>
            </div>
            <div>
              <span class="text-[10px] text-gray-500 font-medium block">Delivery Time</span>
              <strong class="text-xs font-bold text-gray-800">4–7 Days</strong>
            </div>
          </div>
        `;
      }
    };

    // Function to render Features / What's Included
    const renderFeaturesList = (mode) => {
      const featuresList = qs('#details-features-list');
      if (!featuresList) return;

      let items = [];
      if (mode === 'template') {
        items = [
          'Direct Private Canva Editable Template Link',
          'Compatible with Canva Mobile App & Web Browser',
          'Free Google Fonts, Layouts & Graphics Included',
          'Instant Access Immediately After Order & Payment',
          'Export in Ultra HD Print-Ready PDF / PNG / JPG',
          'Unlimited Personal Edits & Lifetime Access'
        ];
      } else if (Array.isArray(template.features) && template.features.length > 0) {
        items = template.features;
      } else if (isMagazine) {
        items = [
          `Custom Designed ${selectedPageTier.label} Photo Magazine`,
          'Full-Bleed Ultra HD 2400 DPI Precision Color Printing',
          '300 GSM Premium Heavyweight Glossy Art Paper',
          'Professional Designer Layout & Photo Retouching Support',
          'Fast Doorstep Delivery Across Bangladesh via Steadfast'
        ];
      } else if (isPoster) {
        items = [
          `Premium Wallboard Poster Combo Pack (${selectedComboQty} Pcs)`,
          '300 GSM Heavyweight Art Card with Protective Lamination',
          'Ultra HD 2400 DPI Vibrant High-Definition Printing',
          'Fade-Proof Long Lasting Color Durability',
          'Fast Doorstep Delivery Across Bangladesh'
        ];
      } else {
        items = [
          'High Quality Personalized Custom Printing',
          'Premium Heavyweight Material',
          'Vibrant Long Lasting Color Reproduction',
          'Fast Doorstep Delivery'
        ];
      }

      featuresList.innerHTML = items.map(item => `
        <div class="flex items-start gap-2 py-1">
          <span class="text-primary text-xs font-bold mt-0.5"><i class="fa-solid fa-circle-check"></i></span>
          <span class="text-gray-700 leading-snug font-medium">${escapeHtml(String(item))}</span>
        </div>
      `).join('');
    };

    // Function to render Full Detailed Specifications Table
    const renderSpecificationsTable = () => {
      const specsList = qs('#details-specs');
      if (!specsList) return;

      const { rangeText } = getActivePhotoInfo();
      const baseSpecs = {
        'Product Type': isMagazine ? 'Personalized Photo Magazine' : (isPoster ? 'Custom Poster Combo Pack' : (isFrame ? 'Photo Wall Frame' : (isSticker ? 'Custom Vinyl Sticker' : 'Digital Canva Template'))),
        'Total Pages': isMagazine ? selectedPageTier.label : (pages ? `${pages}` : ''),
        'Required Photos': rangeText,
        'Paper Size': size,
        'Paper Quality': paper,
        'Print Resolution': printQuality,
        'Delivery Time': '4–6 Days Inside Dhaka, 5–7 Days Outside Dhaka',
        'Delivery Charge': 'Inside Dhaka ৳60 | Outside Dhaka ৳110 (Steadfast)',
        'Occasion / Theme': occasion
      };

      specsList.innerHTML = Object.entries(baseSpecs)
        .filter(([_, val]) => Boolean(val))
        .map(([key, val]) => {
          return `
            <div class="flex flex-col py-1 border-b border-gray-100 sm:border-none">
              <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">${escapeHtml(key)}</span>
              <span class="text-xs font-bold text-gray-800 mt-0.5">${escapeHtml(String(val))}</span>
            </div>
          `;
        })
        .join('');
    };

    // Magazine Page Selector Renderer
    const pagesSelectorSection = qs('#details-pages-selector-section');
    const pagesGrid = qs('#details-pages-grid');
    const selectedPageBadge = qs('#details-selected-page-badge');

    const renderPagesSelector = () => {
      if (!pagesGrid) return;
      const isOfferExplicitlyDisabled = template.hasOffer === false || template.has_offer === false;
      const offerPct = isOfferExplicitlyDisabled ? 0 : Number(template.offerPercentage || template.offer_percentage || template.discountPercent || template.discount_percent || 0);

      pagesGrid.innerHTML = availablePageTiers.map(tier => {
        const isSelected = tier.pages === selectedPageTier.pages;
        const tierPrice = Number(tier.price || tier.base_price || 499);
        const tierOfferPrice = Number(tier.offer_price || tier.offerPrice || (offerPct > 0 ? Math.round(tierPrice * (1 - offerPct / 100)) : tierPrice));
        const hasDiscount = (offerPct > 0 || (tierOfferPrice > 0 && tierOfferPrice < tierPrice));
        const minP = Number(tier.minPhotos || tier.min_photos || 0);
        const maxP = Number(tier.maxPhotos || tier.max_photos || 0);
        const photoHint = (minP > 0 && minP !== maxP) ? `${minP}–${maxP} Photos` : `${maxP || minP} Photos`;

        return `
          <button type="button" class="page-tier-btn p-3 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer ${isSelected ? 'border-[#C97B5F] bg-[#C97B5F] text-white font-bold shadow-md ring-2 ring-[#C97B5F]/30 scale-[1.03]' : 'border-gray-200 bg-white hover:border-[#C97B5F]/60 text-gray-800'}" data-page="${tier.pages}">
            <div class="text-xs font-extrabold ${isSelected ? 'text-white' : 'text-gray-800'}">${escapeHtml(tier.label || `${tier.pages} Pages`)}</div>
            <div class="text-[10px] font-semibold ${isSelected ? 'text-white/85' : 'text-gray-500'} mt-0.5">${escapeHtml(photoHint)}</div>
            <div class="text-xs font-bold ${isSelected ? 'text-white/95' : 'text-[#C97B5F]'} mt-1">
              ${hasDiscount ? `<span class="line-through opacity-75 text-[10px] mr-1 ${isSelected ? 'text-white/75' : 'text-gray-400'}">৳${tierPrice}</span>৳${tierOfferPrice}` : `৳${tierPrice}`}
            </div>
          </button>
        `;
      }).join('');

      if (selectedPageBadge) {
        const tierPrice = Number(selectedPageTier.price || selectedPageTier.base_price || 499);
        const currentTierOfferPrice = Number(selectedPageTier.offer_price || selectedPageTier.offerPrice || (offerPct > 0 ? Math.round(tierPrice * (1 - offerPct / 100)) : tierPrice));
        const { rangeText } = getActivePhotoInfo();
        selectedPageBadge.textContent = `${selectedPageTier.label || `${selectedPageTier.pages} Pages`} • ${rangeText} (৳${currentTierOfferPrice})`;
      }

      qsa('.page-tier-btn', pagesGrid).forEach(btn => {
        btn.addEventListener('click', () => {
          const pageNum = Number(btn.getAttribute('data-page'));
          const foundTier = availablePageTiers.find(t => t.pages === pageNum);
          if (foundTier) {
            selectedPageTier = foundTier;
            const tPrice = Number(foundTier.price || foundTier.base_price || 499);
            const tOfferPrice = Number(foundTier.offer_price || foundTier.offerPrice || (offerPct > 0 ? Math.round(tPrice * (1 - offerPct / 100)) : tPrice));
            selectedMagazinePrice = (offerPct > 0 || (foundTier.offer_price > 0 && foundTier.offer_price < tPrice)) ? tOfferPrice : tPrice;
            updatePhotoRequirementBadges();
            renderPagesSelector();
            renderSpecificationsTable();
            renderHighlightsGrid(activeMode);
            renderFeaturesList(activeMode);
            updateModeUI('magazine');
          }
        });
      });
    };

    if (isMagazine) {
      renderPagesSelector();
    } else if (pagesSelectorSection) {
      pagesSelectorSection.classList.add('hidden');
    }

    renderSpecificationsTable();

    // Dual Selling Mode Setup
    const initialTab = params.get('tab');
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

      // Dynamic Price calculation based on selected page tier
      let activePrice = 0;
      let compare = 0;
      let discount = 0;

      if (activeMode === 'magazine') {
        const isOfferExplicitlyDisabled = template.hasOffer === false || template.has_offer === false;
        const offerPct = isOfferExplicitlyDisabled ? 0 : Number(template.offerPercentage || template.offer_percentage || template.discountPercent || template.discount_percent || 0);
        const tierBasePrice = Number(selectedPageTier.price || selectedPageTier.base_price || 499);
        const tierOfferPrice = Number(selectedPageTier.offer_price || selectedPageTier.offerPrice || (offerPct > 0 ? Math.round(tierBasePrice * (1 - offerPct / 100)) : tierBasePrice));

        if (offerPct > 0) {
          compare = tierBasePrice;
          activePrice = tierOfferPrice;
          discount = offerPct;
        } else if (tierOfferPrice > 0 && tierOfferPrice < tierBasePrice) {
          compare = tierBasePrice;
          activePrice = tierOfferPrice;
          discount = Math.round(((tierBasePrice - tierOfferPrice) / tierBasePrice) * 100);
        } else {
          activePrice = tierBasePrice;
          compare = 0;
          discount = 0;
        }
      } else {
        activePrice = templatePrice;
        compare = 0;
        discount = 0;
      }

      const priceElem = qs('#details-price');
      if (priceElem) priceElem.textContent = formatCurrency(activePrice);
      if (modePriceMag) modePriceMag.textContent = formatCurrency(activePrice);

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

      // Re-render highlights & features dynamically for the chosen mode
      renderHighlightsGrid(activeMode);
      renderFeaturesList(activeMode);
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
        mainImg.onload = () => {
          mainImg.style.opacity = '1';
          mainImg.style.transform = 'scale(1)';
        };
      }
      if (blurBgImg) {
        blurBgImg.src = buildCloudinaryDeliveryUrl(nextSrc, { width: 400 });
      }

      if (counterText) {
        counterText.textContent = `${activeGalleryIdx + 1} / ${galleryList.length}`;
      }
      if (thumbsCount) {
        thumbsCount.textContent = `${galleryList.length} Photos`;
      }

      if (thumbsContainer) {
        const buttons = thumbsContainer.querySelectorAll('button[data-gallery-index]');
        buttons.forEach((btn, idx) => {
          if (idx === activeGalleryIdx) {
            btn.classList.add('border-primary', 'ring-2', 'ring-primary/30', 'scale-105');
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
        const activePrice = activeMode === 'magazine' ? selectedMagazinePrice : templatePrice;
        const titleSuffix = activeMode === 'template' ? ' (Digital Template)' : ` (${selectedPageTier.label})`;
        const minP = selectedPageTier ? Number(selectedPageTier.minPhotos || selectedPageTier.min_photos || 0) : effectiveMin;
        const maxP = selectedPageTier ? Number(selectedPageTier.maxPhotos || selectedPageTier.max_photos || 0) : effectiveMax;
        const finalMin = minP > 0 ? minP : effectiveMin;
        const finalMax = maxP > 0 ? maxP : effectiveMax;
        const pRange = (finalMin > 0 && finalMin !== finalMax) ? `${finalMin}–${finalMax} Photos` : `${finalMax} Photos`;

        addTemplateToCart({
          ...template,
          title: `${template.title || 'Product'}${titleSuffix}`,
          price: activePrice,
          purchaseMode: activeMode,
          selectedPages: selectedPageTier ? selectedPageTier.label : `${pages} Pages`,
          pageCount: selectedPageTier ? selectedPageTier.pages : pages,
          minPhotos: finalMin,
          min_photos: finalMin,
          maxPhotos: finalMax,
          max_photos: finalMax,
          requiredPhotoCount: finalMax,
          requiredPhotos: finalMax,
          photoRangeText: pRange
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
        const activePrice = activeMode === 'magazine' ? selectedMagazinePrice : templatePrice;
        const titleSuffix = activeMode === 'template' ? ' (Digital Template)' : ` (${selectedPageTier.label})`;
        const minP = selectedPageTier ? Number(selectedPageTier.minPhotos || selectedPageTier.min_photos || 0) : effectiveMin;
        const maxP = selectedPageTier ? Number(selectedPageTier.maxPhotos || selectedPageTier.max_photos || 0) : effectiveMax;
        const finalMin = minP > 0 ? minP : effectiveMin;
        const finalMax = maxP > 0 ? maxP : effectiveMax;
        const pRange = (finalMin > 0 && finalMin !== finalMax) ? `${finalMin}–${finalMax} Photos` : `${finalMax} Photos`;

        addTemplateToCart({
          ...template,
          title: `${template.title || 'Product'}${titleSuffix}`,
          price: activePrice,
          purchaseMode: activeMode,
          selectedPages: selectedPageTier ? selectedPageTier.label : `${pages} Pages`,
          pageCount: selectedPageTier ? selectedPageTier.pages : pages,
          pages: selectedPageTier ? selectedPageTier.pages : pages,
          minPhotos: finalMin,
          min_photos: finalMin,
          maxPhotos: finalMax,
          max_photos: finalMax,
          requiredPhotoCount: finalMax,
          requiredPhotos: finalMax,
          photoRangeText: pRange
        });
      }
      window.location.href = '/pages/cart?checkout=direct';
    });

    if (loading) {
      loading.hidden = true;
      loading.setAttribute('hidden', '');
    }
    detailsContainer.hidden = false;
    detailsContainer.removeAttribute('hidden');

    // Render Related Magazines Section by Occasion / Category
    const relatedSection = qs('#related-magazines-section');
    const relatedGrid = qs('#related-magazines-grid');
    const relatedTitle = qs('#related-section-title');

    if (relatedGrid) {
      try {
        const relatedItems = await fetchRelatedTemplates(db, template, 4);
        if (relatedItems && relatedItems.length > 0) {
          const occ = template.occasion || template.category || template.target_audience || '';
          if (relatedTitle && occ && occ !== 'Magazine') {
            relatedTitle.textContent = `More ${occ} Magazines`;
          }
          relatedGrid.innerHTML = relatedItems.map(item => renderProductCardV2(item)).join('');
          if (relatedSection) relatedSection.classList.remove('hidden');
        } else if (relatedSection) {
          relatedSection.classList.add('hidden');
        }
      } catch (relErr) {
        console.warn('Failed to load related magazines:', relErr);
      }
    }

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
