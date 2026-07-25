import { safeJsonParse } from '../utils/ui.js';

export const API_BASE = "https://bkash-sms-gateway.onrender.com";
const TEMPLATES_CACHE_KEY = 'memory_remains_templates_cache_v1';
const FALLBACK_IMAGE = '/assets/product_placeholder.png';

export const DEFAULT_FEATURED_TEMPLATES = [
  { id: 'f1', title: 'SOULMATE - Premium Magazine', price: 399, compareAtPrice: 1599, badge: 'Bestseller', category: 'For Her', category_name: 'For Her', collection: 'Best Selling', requiredPhotos: 15, imageUrl: '/assets/aesthetic_planner_pack.png', description: 'Customizable A4 & A3 size posters available Premium Glossy Finish Premium Features 270 GSM Glossy Photo Paper Posters Borderless Prints Customizable available at any size and any pic', product_type: 'magazine', magazine_price: 399, template_price: 199, delivery_charge: 60, is_template_for_sale: true, is_active: true, sort_order: 1 },
  { id: 'f2', title: 'Things I Adore About him/Her', price: 699, compareAtPrice: 1299, badge: 'Bestseller', category: 'For Him', category_name: 'For Him', collection: 'Birthday Special', requiredPhotos: 10, imageUrl: '/assets/creator_profile.png', description: 'Customizable A4 & A3 size posters available Premium Glossy Finish Premium Features 270 GSM Glossy Photo Paper Posters Borderless Prints Customizable available at any size and any pic', product_type: 'magazine', magazine_price: 699, template_price: 299, delivery_charge: 60, is_template_for_sale: true, is_active: true, sort_order: 2 },
  { id: 'f3', title: 'Tu Chahiye Magazine', price: 299, compareAtPrice: 1299, badge: 'Bestseller', category: 'For Her', category_name: 'For Her', collection: 'Best Selling', requiredPhotos: 12, imageUrl: '/assets/instagram_stories_cozy.png', description: 'Customizable A4 & A3 size posters available Premium Glossy Finish Premium Features 270 GSM Glossy Photo Paper Posters Borderless Prints Customizable available at any size and any pic', product_type: 'poster', magazine_price: 299, template_price: 149, delivery_charge: 50, is_template_for_sale: true, is_active: true, sort_order: 3 },
  { id: 'f4', title: 'Vogue - Couple Edition', price: 299, compareAtPrice: 1599, badge: 'Bestseller', category: 'For Him', category_name: 'For Him', collection: 'Categories', requiredPhotos: 8, imageUrl: '/assets/instagram_carousel_summer.png', description: 'Customizable A4 & A3 size posters available Premium Glossy Finish Premium Features 270 GSM Glossy Photo Paper Posters Borderless Prints Customizable available at any size and any pic', product_type: 'wall_frame', magazine_price: 299, template_price: 199, delivery_charge: 80, is_template_for_sale: true, is_active: true, sort_order: 4 },
  { id: 'f5', title: '12 pages Viral Birthday Magazine', price: 499, compareAtPrice: 1599, badge: 'Bestseller', category: 'Birthday Special', category_name: 'Birthday Special', collection: 'Collections', requiredPhotos: 12, imageUrl: '/assets/scrapbook_collage_bundle.png', description: 'Customizable A4 & A3 size posters available Premium Glossy Finish Premium Features 270 GSM Glossy Photo Paper Posters Borderless Prints Customizable available at any size and any pic', product_type: 'magazine', magazine_price: 499, template_price: 199, delivery_charge: 60, is_template_for_sale: true, is_active: true, sort_order: 5 },
  { id: 'f6', title: 'Friend Core Memories Magazine', price: 299, compareAtPrice: 899, badge: 'Bestseller', category: 'Best Selling', category_name: 'Best Selling', collection: 'Featured', requiredPhotos: 14, imageUrl: '/assets/aesthetic_planner_pack.png', description: 'Customizable A4 & A3 size posters available Premium Glossy Finish Premium Features 270 GSM Glossy Photo Paper Posters Borderless Prints Customizable available at any size and any pic', product_type: 'sticker', magazine_price: 299, template_price: 99, delivery_charge: 40, is_template_for_sale: true, is_active: true, sort_order: 6 }
];

export function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

export function inferCollection(template = {}) {
  const raw = normalizeText(`${template.collection || template.category || template.segment || ''}`);
  const title = normalizeText(template.title || template.name);

  if (raw.includes('birthday') || title.includes('birthday')) return 'Birthday Special';
  if (raw.includes('her') || raw.includes('love') || title.includes('love') || title.includes('couple')) return 'For Her';
  if (raw.includes('him') || title.includes('him')) return 'For Him';
  if (raw.includes('premium') || title.includes('premium') || title.includes('planner')) return 'Premium';
  if (raw.includes('best') || title.includes('memory') || title.includes('scrapbook')) return 'Best Selling';
  return 'Featured';
}

export function inferRequiredPhotos(data = {}) {
  const explicit = Number(
    data.requiredPhotos ??
    data.requiredPhotoCount ??
    data.required_photo_count ??
    data.requiredImages ??
    data.requiredImageCount ??
    data.required_image_count ??
    data.pageCount ??
    data.page_count ??
    data.photoCount ??
    data.imageCount ??
    data.photosRequired ??
    data.photoLimit ??
    data.numImages
  );
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const title = normalizeText(data.title || data.name);
  const match = title.match(/(\d+)\s*(pages|page|photos|photo|images|img)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num > 0) return num;
  }

  if (title.includes('birthday')) return 12;
  if (title.includes('soulmate') || title.includes('magazine')) return 15;
  if (title.includes('couple') || title.includes('adore')) return 10;
  return 12;
}

export function comparePrice(template = {}) {
  const offerPct = Number(template.offerPercentage || template.offer_percentage || 0);
  const hasOffer = Boolean(template.hasOffer || template.has_offer || offerPct > 0);
  const basePrice = Number(template.originalPrice || template.original_price || template.price || template.customPrice || template.magazine_price || template.magazinePrice || 0);

  if (hasOffer && offerPct > 0 && basePrice > 0) {
    return basePrice;
  }

  const explicit = Number(
    template.compareAtPrice ??
    template.compare_at_price ??
    template.originalPrice ??
    template.original_price ??
    template.mrp ??
    template.regularPrice ??
    template.regular_price
  );
  if (Number.isFinite(explicit) && explicit > basePrice && basePrice > 0) {
    return explicit;
  }
  return 0;
}

export function discountPercent(template = {}) {
  const offerPct = Number(template.offerPercentage || template.offer_percentage || 0);
  if (offerPct > 0) {
    return Math.round(offerPct);
  }
  const basePrice = Number(template.price || template.magazine_price || template.magazinePrice || template.customPrice || 0);
  const compare = comparePrice(template);
  if (!basePrice || !compare || compare <= basePrice) {
    return 0;
  }
  return Math.round(((compare - basePrice) / compare) * 100);
}

export function effectivePrice(template = {}) {
  const basePrice = Number(template.originalPrice || template.original_price || template.price || template.customPrice || template.magazine_price || template.magazinePrice || 0);
  const offerPct = Number(template.offerPercentage || template.offer_percentage || 0);
  const hasOffer = Boolean(template.hasOffer || template.has_offer || offerPct > 0);

  if (hasOffer && offerPct > 0 && basePrice > 0) {
    const calculated = basePrice - (basePrice * offerPct / 100);
    return Number(calculated.toFixed(2));
  }
  return Number((template.price || basePrice || 0));
}

export function getCachedTemplates() {
  return safeJsonParse(localStorage.getItem(TEMPLATES_CACHE_KEY), []);
}

export function setCachedTemplates(templates) {
  if (Array.isArray(templates) && templates.length > 0) {
    localStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify(templates));
  }
}

export function normalizeTemplateData(docId, data = {}) {
  const rawImages = [
    ...(Array.isArray(data.images) ? data.images : []),
    ...(Array.isArray(data.showcaseImages) ? data.showcaseImages : []),
    ...(Array.isArray(data.gallery) ? data.gallery : []),
    ...(Array.isArray(data.galleryUrls) ? data.galleryUrls : []),
    ...(Array.isArray(data.gallery_urls) ? data.gallery_urls : []),
    ...(Array.isArray(data.photos) ? data.photos : []),
    ...(Array.isArray(data.additionalImages) ? data.additionalImages : [])
  ].filter((url) => typeof url === 'string' && url.trim().length > 0);

  if (typeof data.gallery_urls === 'string' && data.gallery_urls.trim()) {
    data.gallery_urls.split(',').forEach((u) => {
      if (u.trim()) rawImages.push(u.trim());
    });
  }

  const primaryImage = data.imageUrl || data.image_url || data.image || data.coverImage || data.photo || data.thumbnail || (rawImages.length > 0 ? rawImages[0] : '');
  const uniqueImages = Array.from(new Set([primaryImage, ...rawImages].filter((url) => typeof url === 'string' && url.trim().length > 0)));
  const galleryUrls = uniqueImages.filter((url) => url && url !== primaryImage);

  const effectiveId = String(docId || data.id || data._id || data.templateId || '');

  const productType = String(data.product_type || data.productType || 'magazine').trim();
  const categoryId = String(data.category_id || data.categoryId || (Array.isArray(data.categoryIds) && data.categoryIds.length > 0 ? data.categoryIds[0] : '')).trim();
  const categoryName = String(data.category_name || data.categoryName || data.category || (Array.isArray(data.categories) && data.categories.length > 0 ? data.categories[0] : '')).trim();

  const isActive = data.is_active !== undefined ? Boolean(data.is_active) : (data.isActive !== undefined ? Boolean(data.isActive) : true);
  const isTemplateForSale = data.is_template_for_sale !== undefined ? Boolean(data.is_template_for_sale) : (data.isTemplateForSale !== undefined ? Boolean(data.isTemplateForSale) : (data.allowDigitalSale !== false && Boolean(data.canvaLink || data.canvaUrl || data.templatePrice || data.template_price)));

  const magazinePrice = Number(data.magazine_price || data.magazinePrice || data.originalPrice || data.original_price || data.price || data.customPrice || 499);
  const templatePrice = Number(data.template_price || data.templatePrice || data.digitalPrice || data.digital_price || data.templateSalePrice || data.canvaPrice || 199);
  const deliveryCharge = Number(data.delivery_charge || data.deliveryCharge || 0);
  const sortOrder = Number(data.sort_order || data.sortOrder || data.order || 99);

  const offerPct = Number(data.offerPercentage || data.offer_percentage || 0);
  const hasOffer = Boolean((data.hasOffer || data.has_offer || offerPct > 0) && offerPct > 0 && magazinePrice > 0);

  const calcOfferPrice = hasOffer
    ? Number((magazinePrice - (magazinePrice * offerPct / 100)).toFixed(2))
    : magazinePrice;

  const descriptionText = data.description || data.magazineDescription || data.templateDescription || data.details || data.overview || data.desc || data.about || data.summary || data.subtitle || '';
  const collection = data.collection || categoryName || inferCollection(data);
  const badge = hasOffer ? `${Math.round(offerPct)}% OFF` : (data.badge || data.offer_badge || data.offerBadge || '');

  const comboPrices = data.comboPrices || data.combo_prices || {};
  const showcaseImages = Array.isArray(data.showcaseImages) ? data.showcaseImages : (Array.isArray(data.showcase_images) ? data.showcase_images : (Array.isArray(data.gallery) ? data.gallery : []));

  return {
    ...data,
    id: effectiveId,
    title: data.title || data.name || '',
    name: data.name || data.title || '',
    subtitle: data.subtitle || '',
    product_type: productType,
    productType: productType,
    category_id: categoryId,
    categoryId: categoryId,
    category_name: categoryName,
    categoryName: categoryName,
    category: categoryName,
    collection: collection,
    is_active: isActive,
    isActive: isActive,
    is_template_for_sale: isTemplateForSale,
    isTemplateForSale: isTemplateForSale,
    magazine_price: magazinePrice,
    magazinePrice: magazinePrice,
    template_price: templatePrice,
    templatePrice: templatePrice,
    delivery_charge: deliveryCharge,
    deliveryCharge: deliveryCharge,
    sort_order: sortOrder,
    sortOrder: sortOrder,
    price: calcOfferPrice,
    originalPrice: magazinePrice,
    offerPercentage: offerPct,
    hasOffer: hasOffer,
    compareAtPrice: hasOffer ? magazinePrice : (Number(data.compareAtPrice || data.compare_at_price || 0)),
    badge: badge,
    imageUrl: primaryImage,
    images: uniqueImages,
    galleryUrls: galleryUrls,
    showcaseImages: showcaseImages,
    comboPrices: comboPrices,
    minQuantity: Number(data.minQuantity || data.min_quantity || 5),
    maxQuantity: Number(data.maxQuantity || data.max_quantity || 20),
    magazineDescription: data.magazineDescription || descriptionText,
    templateDescription: data.templateDescription || descriptionText,
    description: descriptionText,
    requiredPhotos: inferRequiredPhotos(data)
  };
}

export async function fetchCategories(db) {
  if (db) {
    try {
      const snap = await db.collection('categories').get();
      if (snap && snap.docs && snap.docs.length > 0) {
        return snap.docs
          .map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              name: d.name || '',
              slug: d.slug || doc.id,
              icon: d.icon || '🏷️',
              is_active: d.is_active !== undefined ? Boolean(d.is_active) : (d.isActive !== false),
              sort_order: Number(d.sort_order || d.sortOrder || d.order || 99),
              ...d
            };
          })
          .filter((c) => c.is_active !== false)
          .sort((a, b) => a.sort_order - b.sort_order);
      }
    } catch (err) {
      console.warn('Firestore fetchCategories warning:', err);
    }
  }
  return [];
}

export async function fetchCollections(db) {
  if (db) {
    try {
      const colNames = ['collections', 'site_collections'];
      for (const colName of colNames) {
        try {
          const snap = await db.collection(colName).get();
          if (snap && snap.docs && snap.docs.length > 0) {
            const list = snap.docs
              .map((doc) => {
                const d = doc.data();
                return {
                  id: doc.id,
                  name: d.name || d.title || '',
                  slug: d.slug || doc.id,
                  description: d.description || '',
                  cover_image_url: d.cover_image_url || d.coverImageUrl || d.image || '',
                  template_ids: Array.isArray(d.template_ids) ? d.template_ids.map(String) : (Array.isArray(d.templateIds) ? d.templateIds.map(String) : []),
                  is_active: d.is_active !== undefined ? Boolean(d.is_active) : (d.isActive !== false),
                  sort_order: Number(d.sort_order || d.sortOrder || d.order || 99),
                  ...d
                };
              })
              .filter((c) => c.is_active !== false);

            if (list.length > 0) {
              list.sort((a, b) => a.sort_order - b.sort_order);
              return list;
            }
          }
        } catch (e) {
          console.warn(`Fetch collections from '${colName}' warning:`, e);
        }
      }
    } catch (err) {
      console.warn('Firestore fetchCollections warning:', err);
    }
  }
  return [];
}

export async function fetchTemplates(db, { limit, categoryId, productType } = {}) {
  const cached = getCachedTemplates();

  if (db) {
    try {
      let combinedDocs = [];
      const templatesSnap = await db.collection('templates').get();
      if (templatesSnap && templatesSnap.docs) {
        combinedDocs.push(...templatesSnap.docs.map((doc) => normalizeTemplateData(doc.id, doc.data())));
      }

      // Also fetch catalog_posters
      try {
        const postersSnap = await db.collection('catalog_posters').get();
        if (postersSnap && postersSnap.docs) {
          combinedDocs.push(...postersSnap.docs.map((doc) => normalizeTemplateData(doc.id, { productType: 'poster', product_type: 'poster', ...doc.data() })));
        }
      } catch (err) {
        console.warn('catalog_posters fetch warning:', err);
      }

      if (combinedDocs.length > 0) {
        let list = combinedDocs;
        list.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

        if (categoryId) {
          list = list.filter((t) => String(t.category_id) === String(categoryId) || normalizeText(t.category_name) === normalizeText(categoryId));
        }
        if (productType) {
          list = list.filter((t) => String(t.product_type).toLowerCase() === String(productType).toLowerCase());
        }
        if (limit && limit > 0) {
          list = list.slice(0, limit);
        }
        if (list.length > 0) {
          setCachedTemplates(list);
          return list;
        }
      }
    } catch (error) {
      console.warn('Error fetching templates:', error);
    }
  }

  if (cached && cached.length > 0) {
    return cached;
  }

  return DEFAULT_FEATURED_TEMPLATES;
}

export async function fetchTemplateById(db, targetId) {
  const cleanId = String(targetId).trim();
  const normId = normalizeText(cleanId);

  if (db) {
    try {
      const doc = await db.collection('templates').doc(cleanId).get();
      if (doc.exists) {
        return normalizeTemplateData(doc.id, doc.data());
      }
    } catch (err) {
      console.warn('fetchTemplateById direct doc fetch failed:', err);
    }

    try {
      const posterDoc = await db.collection('catalog_posters').doc(cleanId).get();
      if (posterDoc.exists) {
        return normalizeTemplateData(posterDoc.id, { productType: 'poster', product_type: 'poster', ...posterDoc.data() });
      }
    } catch (err) {
      console.warn('fetchTemplateById posterDoc fetch failed:', err);
    }

    try {
      const allTemplates = await fetchTemplates(db);
      if (allTemplates && allTemplates.length > 0) {
        const found = allTemplates.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId || normalizeText(t.title) === normId);
        if (found) return normalizeTemplateData(found.id, found);
      }
    } catch (err) {
      console.warn('fetchTemplateById fallback search failed:', err);
    }
  }

  const cached = getCachedTemplates();
  if (cached && cached.length > 0) {
    const foundCached = cached.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId);
    if (foundCached) return normalizeTemplateData(foundCached.id, foundCached);
  }

  const foundDefault = DEFAULT_FEATURED_TEMPLATES.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId);
  if (foundDefault) return normalizeTemplateData(foundDefault.id, foundDefault);

  return null;
}
