import { safeJsonParse } from '../utils/ui.js';

export const API_BASE = "https://bkash-sms-gateway.onrender.com";
const TEMPLATES_CACHE_KEY = 'memory_remains_templates_cache_v3';
const CATEGORIES_CACHE_KEY = 'memory_remains_categories_cache_v3';
const COLLECTIONS_CACHE_KEY = 'memory_remains_collections_cache_v3';
const TEMPLATES_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let _memoryTemplatesCache = null;
let _memoryCategoriesCache = null;
let _memoryCollectionsCache = null;

export function normalizeText(str) {
  return String(str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

export function comparePrice(template = {}) {
  const comp = Number(
    template.compareAtPrice ||
    template.compare_at_price ||
    template.originalPrice ||
    template.original_price ||
    template.regularPrice ||
    template.regular_price ||
    template.mrp ||
    template.base_price ||
    template.basePrice ||
    template.normal_price ||
    template.normalPrice ||
    template.crossed_price ||
    0
  );
  const p = Number(template.price || template.customPrice || template.magazine_price || template.magazinePrice || 0);
  return (comp > p) ? comp : null;
}

export function discountPercent(template = {}) {
  if (template.hasOffer === false || template.has_offer === false) return 0;
  const explicitDiscount = Number(
    template.discount_percent ||
    template.discountPercent ||
    template.discount_percentage ||
    template.discountPercentage ||
    template.offer_percentage ||
    template.offerPercentage ||
    template.offer_percent ||
    template.offerPercent ||
    template.discount ||
    template.discount_rate ||
    0
  );
  if (!isNaN(explicitDiscount) && explicitDiscount > 0) {
    return Math.round(explicitDiscount);
  }

  const comp = comparePrice(template);
  const p = Number(template.price || template.customPrice || template.magazine_price || template.magazinePrice || 0);
  if (comp && comp > p) {
    return Math.round(((comp - p) / comp) * 100);
  }
  return 0;
}

export function inferCollection(template = {}) {
  if (template.collection) return template.collection;
  if (template.category) return template.category;
  const pType = String(template.product_type || template.productType || '').toLowerCase();
  if (pType === 'wall_frame' || pType === 'frame') return 'Photo Frame';
  if (pType === 'poster') return 'Poster';
  if (pType === 'sticker') return 'Sticker';
  return 'Personalized Magazine';
}

export function normalizeTemplateData(docId, data = {}) {
  if (!data) data = {};
  const id = String(docId || data.id || data._id || data.templateId || '').trim();
  const title = data.title || data.name || 'Untitled Product';
  const name = data.name || data.title || 'Untitled Product';

  // Handle Offer Price vs Regular Price logic from Admin Dashboard
  const rawPrice = Number(data.price || data.customPrice || data.magazine_price || data.magazinePrice || 0);
  const rawRegularPrice = Number(data.regular_price || data.regularPrice || data.original_price || data.originalPrice || data.mrp || 0);
  const rawOfferPrice = Number(data.offer_price || data.offerPrice || data.discount_price || data.discountPrice || data.sale_price || data.salePrice || data.offerPriceMagazine || 0);
  const rawCompareAtPrice = Number(data.compareAtPrice || data.compare_at_price || 0);

  const explicitDiscountPercent = Number(
    data.discount_percent ||
    data.discountPercent ||
    data.discount_percentage ||
    data.discountPercentage ||
    data.offer_percentage ||
    data.offerPercentage ||
    data.offer_percent ||
    data.offerPercent ||
    data.discount ||
    0
  );

  const isOfferActive = (data.hasOffer !== false && data.has_offer !== false) &&
    ((data.hasOffer === true || data.has_offer === true) || explicitDiscountPercent > 0 || (rawOfferPrice > 0 && rawOfferPrice < (rawRegularPrice || rawPrice)));

  let price = rawPrice || rawRegularPrice || 499;
  let compareAtPrice = 0;

  if (isOfferActive) {
    if (rawOfferPrice > 0 && (rawRegularPrice > rawOfferPrice || rawPrice > rawOfferPrice)) {
      compareAtPrice = rawRegularPrice || rawPrice;
      price = rawOfferPrice;
    } else if (explicitDiscountPercent > 0 && price > 0) {
      compareAtPrice = Math.round(price / (1 - (explicitDiscountPercent / 100)));
    }
  } else {
    price = rawPrice || rawRegularPrice || 499;
    compareAtPrice = 0;
  }

  const img = data.imageUrl || data.image_url || data.cover_image_url || data.coverImageUrl || data.image || '';
  const pType = String(data.productType || data.product_type || 'magazine').toLowerCase().replace(/\s+/g, '_');

  // Normalize badge / offer tag
  const badge = data.badge || data.offer_badge || data.offerBadge || data.offer_tag || data.offerTag || data.offer_title || data.offer_text || data.offerText || '';

  const rawShowcase = Array.isArray(data.showcaseImages) ? data.showcaseImages : (Array.isArray(data.galleryUrls) ? data.galleryUrls : []);
  const showcaseImages = rawShowcase.filter(Boolean);

  const nestedSpecs = (data.specs && typeof data.specs === 'object') ? data.specs : {};

  const pages = data.pages || data.page_count || data.pageCount || data.totalPages || data.total_pages || nestedSpecs.pages || nestedSpecs.page_count || nestedSpecs.pageCount || '';
  
  const minPhotosRaw = Number(
    data.minPhotos ||
    data.min_photos ||
    data.minImageCount ||
    data.min_image_count ||
    nestedSpecs.minPhotos ||
    nestedSpecs.min_photos ||
    0
  );

  const maxPhotosRaw = Number(
    data.maxPhotos ||
    data.max_photos ||
    data.maxImageCount ||
    data.max_image_count ||
    data.requiredPhotos ||
    data.required_photos ||
    data.photosCount ||
    data.photos_count ||
    data.photo_count ||
    data.required_photo_count ||
    data.requiredImageCount ||
    nestedSpecs.maxPhotos ||
    nestedSpecs.max_photos ||
    nestedSpecs.requiredPhotos ||
    nestedSpecs.required_photos ||
    (pType === 'magazine' ? 20 : (pType === 'poster' ? 10 : 8))
  );

  const effectiveMin = (minPhotosRaw > 0 && minPhotosRaw <= maxPhotosRaw) ? minPhotosRaw : (minPhotosRaw > maxPhotosRaw ? maxPhotosRaw : maxPhotosRaw);
  const effectiveMax = maxPhotosRaw >= effectiveMin ? maxPhotosRaw : effectiveMin;
  const requiredPhotos = effectiveMax;
  const photoRangeText = (effectiveMin > 0 && effectiveMin !== effectiveMax)
    ? `${effectiveMin}–${effectiveMax} Photos`
    : `${effectiveMax} Photos`;

  const size = data.size || data.dimension || data.dimensions || data.paper_size || nestedSpecs.size || nestedSpecs.dimension || nestedSpecs.dimensions || '';
  const paper = data.paper || data.paper_type || data.paperType || data.paper_quality || data.paperQuality || data.paper_gsm || data.gsm || data.material || nestedSpecs.paper || nestedSpecs.paper_type || nestedSpecs.material || '';
  const cover = data.cover || data.cover_type || data.coverType || data.finish || data.cover_finish || data.lamination || nestedSpecs.cover || nestedSpecs.finish || nestedSpecs.lamination || '';
  const binding = data.binding || data.binding_type || data.bindingType || nestedSpecs.binding || nestedSpecs.binding_type || '';
  const orientation = data.orientation || data.format || nestedSpecs.orientation || '';
  const deliveryTime = data.delivery_time || data.deliveryTime || data.delivery_info || data.processing_time || nestedSpecs.delivery_time || nestedSpecs.deliveryTime || '';
  const printQuality = data.print_quality || data.printQuality || data.printing || nestedSpecs.print_quality || nestedSpecs.printQuality || '';
  const packaging = data.packaging || data.packaging_type || nestedSpecs.packaging || '';
  const occasion = data.occasion || data.theme || data.target_audience || data.targetAudience || '';
  const features = Array.isArray(data.features) ? data.features : (Array.isArray(data.highlights) ? data.highlights : (typeof data.features === 'string' ? data.features.split('\n').map(s => s.trim()).filter(Boolean) : []));

function getStandardTierPhotos(p) {
  switch (Number(p)) {
    case 4: return { min: 8, max: 12 };
    case 8: return { min: 15, max: 20 };
    case 12: return { min: 22, max: 30 };
    case 16: return { min: 35, max: 45 };
    case 20: return { min: 45, max: 55 };
    case 24: return { min: 55, max: 65 };
    default: return { min: Math.max(1, p * 2), max: Math.max(p * 2, p * 3) };
  }
}

function resolveTierPhotos(p, data = {}) {
  const std = getStandardTierPhotos(p);

  // Check if document has specific map for page photos (e.g. data.pagePhotos["12"] or data.page_photos["12"])
  const pMap = data.pagePhotos || data.page_photos || data.pageLimits || data.page_limits || data.pagePhotoLimits || data.page_photo_limits || {};
  const pagePhotoConfig = pMap[p] || pMap[String(p)];

  let min = 0;
  let max = 0;

  if (pagePhotoConfig) {
    if (typeof pagePhotoConfig === 'object') {
      min = Number(pagePhotoConfig.min_photos || pagePhotoConfig.minPhotos || pagePhotoConfig.min || 0);
      max = Number(pagePhotoConfig.max_photos || pagePhotoConfig.maxPhotos || pagePhotoConfig.max || 0);
    } else if (Array.isArray(pagePhotoConfig)) {
      min = Number(pagePhotoConfig[0] || 0);
      max = Number(pagePhotoConfig[1] || min);
    } else if (typeof pagePhotoConfig === 'string' && pagePhotoConfig.includes('-')) {
      const parts = pagePhotoConfig.split('-').map(Number);
      min = parts[0] || 0;
      max = parts[1] || min;
    }
  }

  // If p is the primary product pageCount, check top-level min_photos & max_photos
  if ((!min || !max) && Number(data.pageCount || data.pages || data.page_count) === Number(p)) {
    min = Number(data.min_photos || data.minPhotos || data.minImageCount || min);
    max = Number(data.max_photos || data.maxPhotos || data.maxImageCount || data.requiredPhotos || data.required_photos || max);
  }

  return {
    minPhotos: min > 0 ? min : std.min,
    maxPhotos: max > 0 ? max : std.max
  };
}

function normalizeSingleTier(t) {
  if (!t || typeof t !== 'object') return null;
  const p = Number(t.pages || t.page || t.page_count || t.pageCount || t.totalPages || t.total_pages || 8);
  const std = getStandardTierPhotos(p);

  const tPrice = Number(
    t.base_price ??
    t.basePrice ??
    t.price ??
    t.regular_price ??
    t.regularPrice ??
    0
  );

  const tOfferPrice = Number(
    t.offer_price ??
    t.offerPrice ??
    t.discount_price ??
    t.discountPrice ??
    t.sale_price ??
    t.salePrice ??
    0
  );

  const tMin = Number(
    t.min_photos ??
    t.minPhotos ??
    t.min_photo ??
    t.minPhoto ??
    t.min_pic ??
    t.minPic ??
    t.min_pics ??
    t.minPics ??
    t.min_images ??
    t.minImages ??
    t.min_photo_count ??
    t.minPhotoCount ??
    t.min_photos_count ??
    t.minPhotosCount ??
    t.min_image_count ??
    t.minImageCount ??
    t.minimum_photos ??
    t.minimumPhotos ??
    t.minimum ??
    t.min ??
    0
  );

  const tMax = Number(
    t.max_photos ??
    t.maxPhotos ??
    t.max_photo ??
    t.maxPhoto ??
    t.max_pic ??
    t.maxPic ??
    t.max_pics ??
    t.maxPics ??
    t.max_images ??
    t.maxImages ??
    t.max_photo_count ??
    t.maxPhotoCount ??
    t.max_photos_count ??
    t.maxPhotosCount ??
    t.max_image_count ??
    t.maxImageCount ??
    t.maximum_photos ??
    t.maximumPhotos ??
    t.maximum ??
    t.max ??
    t.photos ??
    t.photo_count ??
    t.photoCount ??
    t.required_photos ??
    t.requiredPhotos ??
    t.required_photo_count ??
    t.requiredPhotoCount ??
    0
  );

  const finalMin = tMin > 0 ? tMin : (tMax > 0 ? tMax : std.min);
  const finalMax = tMax > 0 ? tMax : (tMin > 0 ? tMin : std.max);

  return {
    pages: p,
    label: t.label || `${p} Pages`,
    price: tPrice,
    base_price: tPrice,
    basePrice: tPrice,
    offer_price: tOfferPrice,
    offerPrice: tOfferPrice,
    minPhotos: finalMin,
    min_photos: finalMin,
    maxPhotos: finalMax,
    max_photos: finalMax
  };
}

  // Normalize Magazine Page Tiers dynamically from Admin Firestore
  let pageTiers = [];
  const rawTierList = data.pageTiers || data.page_tiers || data.tiers || data.pricing_tiers || data.pricingTiers || data.page_pricing_tiers || data.pagePricingTiers || data.page_limits || data.pageLimits || data.magazine_page_tiers || data.magazinePageTiers;

  if (Array.isArray(rawTierList) && rawTierList.length > 0) {
    pageTiers = rawTierList.map(normalizeSingleTier).filter(Boolean);
  } else if (data.pagePrices && typeof data.pagePrices === 'object' && Object.keys(data.pagePrices).length > 0) {
    pageTiers = Object.entries(data.pagePrices).map(([pg, pr]) => {
      const p = Number(pg);
      const prNum = Number(pr);
      const { minPhotos, maxPhotos } = resolveTierPhotos(p, data);
      return {
        pages: p,
        label: `${p} Pages`,
        price: prNum,
        base_price: prNum,
        basePrice: prNum,
        minPhotos: minPhotos,
        min_photos: minPhotos,
        maxPhotos: maxPhotos,
        max_photos: maxPhotos
      };
    });
  } else if (data.page_prices && typeof data.page_prices === 'object' && Object.keys(data.page_prices).length > 0) {
    pageTiers = Object.entries(data.page_prices).map(([pg, pr]) => {
      const p = Number(pg);
      const prNum = Number(pr);
      const { minPhotos, maxPhotos } = resolveTierPhotos(p, data);
      return {
        pages: p,
        label: `${p} Pages`,
        price: prNum,
        base_price: prNum,
        basePrice: prNum,
        minPhotos: minPhotos,
        min_photos: minPhotos,
        maxPhotos: maxPhotos,
        max_photos: maxPhotos
      };
    });
  } else {
    // Default standard tiers matching admin dashboard
    pageTiers = [
      { pages: 4, label: '4 Pages', price: 259, base_price: 259, minPhotos: 8, maxPhotos: 12 },
      { pages: 8, label: '8 Pages', price: 499, base_price: 499, minPhotos: 15, maxPhotos: 20 },
      { pages: 12, label: '12 Pages', price: 699, base_price: 699, minPhotos: 22, maxPhotos: 30 },
      { pages: 16, label: '16 Pages', price: 849, base_price: 849, minPhotos: 35, maxPhotos: 45 },
      { pages: 20, label: '20 Pages', price: 999, base_price: 999, minPhotos: 45, maxPhotos: 55 },
      { pages: 24, label: '24 Pages', price: 1149, base_price: 1149, minPhotos: 55, maxPhotos: 65 }
    ];
  }
  pageTiers.sort((a, b) => a.pages - b.pages);

  const templatePrice = Number(data.template_price || data.templatePrice || data.digital_price || data.digitalPrice || 0);
  const magazinePrice = Number(data.magazine_price || data.magazinePrice || price || 499);
  const isTemplateForSale = Boolean(
    data.is_template_for_sale ??
    data.isTemplateForSale ??
    data.allow_template_sale ??
    (templatePrice > 0)
  );

  return {
    ...data,
    id,
    _id: id,
    templateId: id,
    title,
    name,
    price,
    compareAtPrice,
    compare_at_price: compareAtPrice,
    discount_percent: explicitDiscountPercent,
    discountPercent: explicitDiscountPercent,
    imageUrl: img,
    image_url: img,
    cover_image_url: img,
    coverImageUrl: img,
    productType: pType,
    product_type: pType,
    badge,
    offer_badge: badge,
    pageTiers,
    page_tiers: pageTiers,
    pagePrices: data.pagePrices || data.page_prices || {},
    category_id: data.category_id || data.categoryId || '',
    categoryId: data.category_id || data.categoryId || '',
    category_name: data.category_name || data.categoryName || data.category || '',
    collection: data.collection || data.collection_slug || '',
    isFeatured: Boolean(data.isFeatured ?? data.is_featured ?? true),
    is_featured: Boolean(data.isFeatured ?? data.is_featured ?? true),
    isActive: Boolean(data.isActive ?? data.is_active ?? true),
    is_active: Boolean(data.isActive ?? data.is_active ?? true),
    showcaseImages,
    galleryUrls: showcaseImages,
    comboPrices: data.comboPrices || {},
    specs: {
      ...nestedSpecs,
      ...(pages ? { pages } : {}),
      ...(size ? { size } : {}),
      ...(paper ? { paper } : {}),
      ...(cover ? { cover } : {}),
      ...(binding ? { binding } : {}),
      ...(deliveryTime ? { deliveryTime } : {})
    },
    description: data.description || data.magazineDescription || data.templateDescription || data.subtitle || '',
    pages,
    page_count: pages,
    minPhotos: effectiveMin,
    min_photos: effectiveMin,
    maxPhotos: effectiveMax,
    max_photos: effectiveMax,
    photoRangeText,
    photo_count_range: photoRangeText,
    requiredPhotos,
    required_photos: requiredPhotos,
    size,
    dimensions: size,
    paper,
    paper_type: paper,
    cover,
    cover_finish: cover,
    binding,
    binding_type: binding,
    orientation,
    delivery_time: deliveryTime,
    deliveryTime,
    print_quality: printQuality,
    packaging,
    occasion,
    features,
    template_price: templatePrice,
    templatePrice,
    magazine_price: magazinePrice,
    magazinePrice,
    is_template_for_sale: isTemplateForSale,
    isTemplateForSale,
    canva_link: data.canva_link || data.canva_url || data.canvaLink || data.template_link || '',
    minQuantity: Number(data.minQuantity || 1),
    maxQuantity: Number(data.maxQuantity || 50),
    supportedQuantities: Array.isArray(data.supportedQuantities) ? data.supportedQuantities : [],
    sort_order: Number(data.sort_order || data.order || 99)
  };
}

export const DEFAULT_FEATURED_TEMPLATES = [
  {
    id: 'default-magazine-viral',
    title: '12 Pages Viral Birthday Magazine',
    name: '12 Pages Viral Birthday Magazine',
    price: 499,
    compareAtPrice: 899,
    imageUrl: 'https://res.cloudinary.com/cmpl84gp/image/upload/v1785044020/passkpuxfreyvurvuyvk.jpg',
    product_type: 'magazine',
    productType: 'magazine',
    badge: 'Bestseller',
    isFeatured: true,
    is_featured: true,
    isActive: true,
    is_active: true,
    description: 'Turn your precious memories into a stunning magazine! Featuring full personalization, custom cover headlines, Spotify barcode song dedication, and high-definition photo printing on 300 GSM premium art card.',
    pages: '12 Pages',
    requiredPhotos: 12,
    size: 'A4 Size (8.3" × 11.7")',
    paper: '300 GSM Premium Glossy Art Paper',
    cover: 'Glossy Protective Lamination',
    binding: 'Center Pin / Saddle Stitch',
    delivery_time: '2–3 Days Inside Dhaka, 3–5 Days Nationwide',
    print_quality: 'Ultra HD 2400 DPI Color Offset',
    packaging: 'Gift Envelope & Protective Packaging',
    occasion: 'Birthday Special',
    template_price: 199,
    magazine_price: 499,
    is_template_for_sale: true,
    specs: {
      'Total Pages': '12 Pages',
      'Required Photos': '12 Photos',
      'Dimensions': 'A4 Size (8.3" × 11.7")',
      'Paper Quality': '300 GSM Glossy Art Card',
      'Cover Finish': 'Glossy Thermal Lamination',
      'Binding Style': 'Saddle Stitched (Center Pin)',
      'Estimated Delivery': '2–3 Days Inside Dhaka, 3–5 Days Outside'
    },
    features: [
      '100% Fully Personalized Cover & Inside Pages',
      'Ultra HD 2400 DPI Photo Quality Color Print',
      'Water & Scratch Resistant Thermal Lamination',
      'Custom Title, Dates & Spotify Barcode Code',
      'Fast Steadfast Courier Home Delivery'
    ]
  },
  {
    id: 'default-marvel-poster',
    title: 'Marvel Awesome Poster Combo',
    name: 'Marvel Awesome Poster Combo',
    price: 299,
    compareAtPrice: 499,
    imageUrl: 'https://res.cloudinary.com/cmpl84gp/image/upload/v1785044020/passkpuxfreyvurvuyvk.jpg',
    product_type: 'poster',
    productType: 'poster',
    badge: 'New',
    isFeatured: true,
    is_featured: true,
    isActive: true,
    is_active: true,
    description: 'Awesome custom Marvel poster combo pack with high resolution print quality on 300 GSM art card.',
    size: 'A4 Size (8.3" × 11.7")',
    paper: '300 GSM Art Card',
    cover: 'Matte Finish',
    delivery_time: '2–3 Days Inside Dhaka',
    requiredPhotos: 5
  }
];

// ─── Cache helpers ───────────────────────────────────────────────────────────
function getGenericCache(key, memoryRef) {
  if (memoryRef && memoryRef.data && (Date.now() - memoryRef.cachedAt < TEMPLATES_CACHE_TTL_MS)) {
    return memoryRef.data;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, cachedAt } = JSON.parse(raw);
    if (!cachedAt || Date.now() - cachedAt > TEMPLATES_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return Array.isArray(data) ? data : null;
  } catch (_) {
    return null;
  }
}

function setGenericCache(key, data) {
  if (Array.isArray(data) && data.length > 0) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() }));
    } catch (_) { }
  }
}

export function getCachedTemplates() {
  const data = getGenericCache(TEMPLATES_CACHE_KEY, _memoryTemplatesCache);
  return data || [];
}

export function setCachedTemplates(templates) {
  if (Array.isArray(templates) && templates.length > 0) {
    _memoryTemplatesCache = { data: templates, cachedAt: Date.now() };
    setGenericCache(TEMPLATES_CACHE_KEY, templates);
  }
}

export function clearTemplatesCache() {
  _memoryTemplatesCache = null;
  try {
    localStorage.removeItem(TEMPLATES_CACHE_KEY);
  } catch (_) { }
}

// ─── Fetch Categories ────────────────────────────────────────────────────────
export async function fetchCategories(db, { forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = getGenericCache(CATEGORIES_CACHE_KEY, _memoryCategoriesCache);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  if (db) {
    try {
      const snap = await db.collection('categories').get();
      if (snap && snap.docs && snap.docs.length > 0) {
        const seenSlugs = new Set();
        const uniqueList = [];
        for (const doc of snap.docs) {
          const d = doc.data();
          const name = d.name || '';
          const slug = (d.slug || doc.id || name).toLowerCase().trim();
          if (!name || seenSlugs.has(slug)) continue;
          seenSlugs.add(slug);

          const img = d.image_url || d.imageUrl || d.cover_image_url || d.coverImageUrl || d.image || '';
          uniqueList.push({
            id: doc.id,
            name: name,
            slug: d.slug || doc.id,
            icon: d.icon || '🏷️',
            image_url: img,
            imageUrl: img,
            cover_image_url: img,
            is_active: d.is_active !== undefined ? Boolean(d.is_active) : (d.isActive !== false),
            sort_order: Number(d.sort_order || d.sortOrder || d.order || 99),
            ...d
          });
        }
        uniqueList.sort((a, b) => a.sort_order - b.sort_order);
        _memoryCategoriesCache = { data: uniqueList, cachedAt: Date.now() };
        setGenericCache(CATEGORIES_CACHE_KEY, uniqueList);
        return uniqueList;
      }
    } catch (err) {
      console.warn('Firestore fetchCategories warning:', err);
    }
  }
  return [];
}

// ─── Fetch Collections ───────────────────────────────────────────────────────
export async function fetchCollections(db, { forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = getGenericCache(COLLECTIONS_CACHE_KEY, _memoryCollectionsCache);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  if (db) {
    try {
      const colNames = ['site_collections', 'collections'];
      const seenSlugs = new Set();
      const uniqueList = [];

      const results = await Promise.allSettled(
        colNames.map(async (colName) => {
          const snap = await db.collection(colName).get();
          return (snap && snap.docs) ? snap.docs.map(doc => doc.data()) : [];
        })
      );

      results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          for (const d of res.value) {
            const name = d.name || d.title || '';
            const slug = (d.slug || d.id || name).toLowerCase().trim();
            if (!name || seenSlugs.has(slug)) continue;
            seenSlugs.add(slug);

            const img = d.cover_image_url || d.coverImageUrl || d.image_url || d.imageUrl || d.image || '';
            uniqueList.push({
              id: d.id || slug,
              name: name,
              slug: d.slug || slug,
              description: d.description || '',
              cover_image_url: img,
              coverImageUrl: img,
              image_url: img,
              template_ids: Array.isArray(d.template_ids) ? d.template_ids.map(String) : (Array.isArray(d.templateIds) ? d.templateIds.map(String) : []),
              is_active: d.is_active !== undefined ? Boolean(d.is_active) : (d.isActive !== false),
              sort_order: Number(d.sort_order || d.sortOrder || d.order || 99),
              ...d
            });
          }
        }
      });

      if (uniqueList.length > 0) {
        uniqueList.sort((a, b) => a.sort_order - b.sort_order);
        const filtered = uniqueList.filter((c) => c.is_active !== false);
        _memoryCollectionsCache = { data: filtered, cachedAt: Date.now() };
        setGenericCache(COLLECTIONS_CACHE_KEY, filtered);
        return filtered;
      }
    } catch (err) {
      console.warn('Firestore fetchCollections warning:', err);
    }
  }
  return [];
}

// ─── Fetch Templates / Products (Parallel Firestore Queries) ────────────────
export async function fetchTemplates(db, { limit, categoryId, productType, forceRefresh = false } = {}) {
  const cachedList = getCachedTemplates();

  const fetchFromDb = async () => {
    if (!db) return [];
    try {
      const collectionsToTry = ['templates', 'catalog_frames', 'catalog_posters', 'catalog_stickers', 'products'];
      const results = await Promise.allSettled(
        collectionsToTry.map(async (colName) => {
          const snap = await db.collection(colName).get();
          const defaultPType = colName === 'catalog_frames' ? 'wall_frame' : (colName === 'catalog_posters' ? 'poster' : (colName === 'catalog_stickers' ? 'sticker' : 'magazine'));
          return (snap && snap.docs) ? snap.docs.map(doc => {
            const data = doc.data();
            if (data.is_active === false || data.isActive === false) return null;
            return normalizeTemplateData(doc.id, { productType: defaultPType, product_type: defaultPType, ...data });
          }).filter(Boolean) : [];
        })
      );

      const combinedDocs = [];
      results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          combinedDocs.push(...res.value);
        }
      });

      const seenIds = new Set();
      const uniqueDocs = [];
      for (const d of combinedDocs) {
        if (d.id && !seenIds.has(d.id)) {
          seenIds.add(d.id);
          uniqueDocs.push(d);
        }
      }

      if (uniqueDocs.length > 0) {
        uniqueDocs.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
        setCachedTemplates(uniqueDocs);
        return uniqueDocs;
      }
    } catch (error) {
      console.warn('Error fetching templates from Firestore:', error);
    }
    return [];
  };

  let masterList = [];
  if (!forceRefresh && cachedList && cachedList.length > 0) {
    masterList = cachedList;
  } else {
    masterList = await fetchFromDb();
    if ((!masterList || masterList.length === 0) && cachedList && cachedList.length > 0) {
      masterList = cachedList;
    }
  }

  // Filter in-memory from master list
  let list = Array.isArray(masterList) ? [...masterList] : [];

  if (list.length > 0) {
    if (categoryId) {
      list = list.filter((t) => String(t.category_id) === String(categoryId) || String(t.categoryId) === String(categoryId) || normalizeText(t.category_name) === normalizeText(categoryId));
    }
    if (productType) {
      const normType = String(productType).toLowerCase().replace(/\s+/g, '_');
      list = list.filter((t) => {
        const pType = String(t.product_type || t.productType || '').toLowerCase().replace(/\s+/g, '_');
        if (normType === 'frame' || normType === 'wall_frame') {
          return pType === 'frame' || pType === 'wall_frame';
        }
        return pType === normType;
      });
    }
    if (limit && limit > 0) {
      list = list.slice(0, limit);
    }
    return list;
  }

  if (cachedList && cachedList.length > 0) {
    return cachedList;
  }

  return DEFAULT_FEATURED_TEMPLATES;
}

// ─── Fetch Single Template By ID ─────────────────────────────────────────────
export async function fetchTemplateById(db, targetId) {
  const cleanId = String(targetId).trim();
  const normId = normalizeText(cleanId);

  // 1. Always query Firestore directly first so changes from Admin Dashboard appear instantly!
  if (db) {
    const collectionsToTry = ['templates', 'catalog_frames', 'catalog_posters', 'catalog_stickers', 'products'];
    for (const colName of collectionsToTry) {
      try {
        const doc = await db.collection(colName).doc(cleanId).get();
        if (doc.exists) {
          const pType = colName === 'catalog_frames' ? 'wall_frame' : (colName === 'catalog_posters' ? 'poster' : (colName === 'catalog_stickers' ? 'sticker' : 'magazine'));
          return normalizeTemplateData(doc.id, { productType: pType, product_type: pType, ...doc.data() });
        }
      } catch (err) {
        console.warn(`fetchTemplateById doc fetch '${colName}' failed:`, err);
      }
    }

    try {
      const allTemplates = await fetchTemplates(db, { forceRefresh: true });
      if (allTemplates && allTemplates.length > 0) {
        const found = allTemplates.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId || normalizeText(t.title) === normId);
        if (found) return normalizeTemplateData(found.id, found);
      }
    } catch (err) {
      console.warn('fetchTemplateById fallback search failed:', err);
    }
  }

  // 2. Check in-memory / localStorage cache only if Firestore is offline
  const cached = getCachedTemplates();
  if (cached && cached.length > 0) {
    const foundCached = cached.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId || normalizeText(t.title) === normId);
    if (foundCached) return normalizeTemplateData(foundCached.id, foundCached);
  }

  const foundDefault = DEFAULT_FEATURED_TEMPLATES.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId);
  if (foundDefault) return normalizeTemplateData(foundDefault.id, foundDefault);

  return null;
}

// ─── Fetch Related Templates By Occasion / Category ─────────────────────────
export async function fetchRelatedTemplates(db, currentTemplate = {}, limit = 4) {
  try {
    const allTemplates = await fetchTemplates(db);
    if (!allTemplates || allTemplates.length === 0) return [];

    const currentId = String(currentTemplate.id || currentTemplate._id || '');
    const currentOccasion = String(currentTemplate.occasion || currentTemplate.category || currentTemplate.target_audience || currentTemplate.collection || '').toLowerCase().trim();
    const currentProductType = String(currentTemplate.productType || currentTemplate.product_type || 'magazine').toLowerCase().trim();

    // Exclude current item
    const otherItems = allTemplates.filter(t => String(t.id || t._id) !== currentId);

    // 1. First priority: Exact occasion / category match
    const exactMatches = otherItems.filter(t => {
      const tOccasion = String(t.occasion || t.category || t.target_audience || t.collection || '').toLowerCase().trim();
      return currentOccasion && tOccasion === currentOccasion;
    });

    // 2. Second priority: Same product type (e.g. magazine)
    const typeMatches = otherItems.filter(t => {
      const tType = String(t.productType || t.product_type || 'magazine').toLowerCase().trim();
      return !exactMatches.includes(t) && tType === currentProductType;
    });

    // 3. Fallback: Any other items
    const remaining = otherItems.filter(t => !exactMatches.includes(t) && !typeMatches.includes(t));

    const combined = [...exactMatches, ...typeMatches, ...remaining];
    return combined.slice(0, limit);
  } catch (error) {
    console.error('Error fetching related templates:', error);
    return [];
  }
}

