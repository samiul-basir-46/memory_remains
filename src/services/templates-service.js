import { safeJsonParse } from '../utils/ui.js';

const TEMPLATES_CACHE_KEY = 'memory_remains_templates_cache_v1';
const FALLBACK_IMAGE = '/assets/product_placeholder.png';

export const DEFAULT_FEATURED_TEMPLATES = [
  { id: 'f1', title: 'SOULMATE - Premium Magazine', price: 399, compareAtPrice: 1599, badge: 'Bestseller', category: 'For Her', collection: 'Best Selling', requiredPhotos: 15, imageUrl: '/assets/aesthetic_planner_pack.png' },
  { id: 'f2', title: 'Things I Adore About him/Her', price: 699, compareAtPrice: 1299, badge: 'Bestseller', category: 'For Him', collection: 'Birthday Special', requiredPhotos: 10, imageUrl: '/assets/creator_profile.png' },
  { id: 'f3', title: 'Tu Chahiye Magazine', price: 299, compareAtPrice: 1299, badge: 'Bestseller', category: 'For Her', collection: 'Best Selling', requiredPhotos: 12, imageUrl: '/assets/instagram_stories_cozy.png' },
  { id: 'f4', title: 'Vogue - Couple Edition', price: 299, compareAtPrice: 1599, badge: 'Bestseller', category: 'For Him', collection: 'Categories', requiredPhotos: 8, imageUrl: '/assets/instagram_carousel_summer.png' },
  { id: 'f5', title: '12 pages Viral Birthday Magazine', price: 499, compareAtPrice: 1599, badge: 'Bestseller', category: 'Birthday Special', collection: 'Collections', requiredPhotos: 12, imageUrl: '/assets/scrapbook_collage_bundle.png' },
  { id: 'f6', title: 'Friend Core Memories Magazine', price: 299, compareAtPrice: 899, badge: 'Bestseller', category: 'Best Selling', collection: 'Featured', requiredPhotos: 14, imageUrl: '/assets/aesthetic_planner_pack.png' },
  { id: 'f7', title: 'Vogue - Couple Edition', price: 299, compareAtPrice: 1599, badge: 'Bestseller', category: 'For Her', collection: 'Featured', requiredPhotos: 8, imageUrl: '/assets/creator_profile.png' },
  { id: 'f8', title: 'Customize Couple Magazine', price: 299, compareAtPrice: 999, badge: 'Bestseller', category: 'For Him', collection: 'Featured', requiredPhotos: 16, imageUrl: '/assets/instagram_stories_cozy.png' }
];

export function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

export function inferCollection(template = {}) {
  const raw = normalizeText(`${template.collection || template.category || template.segment || ''}`);
  const title = normalizeText(template.title);

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
    data.photoCount ??
    data.requiredImages ??
    data.imageCount ??
    data.photosRequired ??
    data.photoLimit ??
    data.numImages
  );
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const title = normalizeText(data.title);
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
  const explicit = Number(template.compareAtPrice || template.originalPrice || template.mrp || template.regularPrice);
  const price = Number(template.price || 0);
  if (Number.isFinite(explicit) && explicit > price) {
    return explicit;
  }
  return price ? Number((price * 2).toFixed(2)) : 0;
}

export function discountPercent(template = {}) {
  const price = Number(template.price || 0);
  const compare = comparePrice(template);
  if (!price || !compare || compare <= price) {
    return 0;
  }
  return Math.round(((compare - price) / compare) * 100);
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
    ...(Array.isArray(data.photos) ? data.photos : []),
    ...(Array.isArray(data.additionalImages) ? data.additionalImages : [])
  ].filter((url) => typeof url === 'string' && url.trim().length > 0);

  const primaryImage = data.imageUrl || data.image || data.coverImage || data.photo || data.thumbnail || (rawImages.length > 0 ? rawImages[0] : '');

  const uniqueImages = Array.from(new Set([primaryImage, ...rawImages].filter((url) => typeof url === 'string' && url.trim().length > 0)));
  const galleryUrls = uniqueImages.filter((url) => url && url !== primaryImage);

  const effectiveId = docId || data.id || data._id || data.templateId || '';

  const rawTypes = data.saleTypes || {};
  const isMagOnly = data.productType === 'magazine' || data.productType === 'Magazine (Photo Upload Order Only)';
  const isTplOnly = data.productType === 'template' || data.productType === 'Template (Digital Canva Link Only)';

  const saleTypes = {
    magazine: rawTypes.magazine !== undefined ? Boolean(rawTypes.magazine) : (!isTplOnly),
    template: rawTypes.template !== undefined ? Boolean(rawTypes.template) : (!isMagOnly && (data.allowDigitalSale !== false || Boolean(data.canvaLink || data.digitalPrice || data.templatePrice)))
  };

  const magazinePrice = Number(data.magazinePrice || data.printPrice || data.price || 499);
  const templatePrice = Number(data.templatePrice || data.digitalPrice || data.canvaPrice || 199);

  return {
    ...data,
    id: effectiveId,
    imageUrl: primaryImage,
    images: uniqueImages.slice(0, 3),
    galleryUrls: galleryUrls,
    saleTypes: saleTypes,
    magazinePrice: magazinePrice,
    templatePrice: templatePrice,
    magazineDescription: data.magazineDescription || data.description || '',
    templateDescription: data.templateDescription || data.description || '',
    requiredPhotos: inferRequiredPhotos(data)
  };
}

export async function fetchTemplates(db, { limit, orderByCreated = true } = {}) {
  if (!db) return [];
  try {
    let ref = db.collection('templates');
    if (orderByCreated) {
      try {
        ref = ref.orderBy('createdAt', 'desc');
      } catch (e) {
        ref = db.collection('templates');
      }
    }
    if (limit) {
      ref = ref.limit(limit);
    }
    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => normalizeTemplateData(doc.id, doc.data()));
  } catch (error) {
    console.warn('Error fetching templates from Firestore, trying simple collection fetch:', error);
    try {
      const snapshot = await db.collection('templates').get();
      return snapshot.docs.map((doc) => normalizeTemplateData(doc.id, doc.data()));
    } catch (e2) {
      console.error('All Firestore template fetches failed:', e2);
      return [];
    }
  }
}

export async function fetchTemplateById(db, targetId) {
  if (!targetId) return null;
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
      const querySnap = await db.collection('templates').where('id', '==', cleanId).get();
      if (!querySnap.empty) {
        const firstDoc = querySnap.docs[0];
        return normalizeTemplateData(firstDoc.id, firstDoc.data());
      }
    } catch (err2) {
      console.warn('fetchTemplateById query by id field failed:', err2);
    }

    try {
      const dbTemplates = await fetchTemplates(db);
      if (dbTemplates && dbTemplates.length > 0) {
        const matched = dbTemplates.find((t) =>
          t.id === cleanId ||
          String(t.id).toLowerCase() === normId ||
          normalizeText(t.title) === normId ||
          (normalizeText(t.title) && normId && normalizeText(t.title).includes(normId)) ||
          (normId && normalizeText(t.title) && normId.includes(normalizeText(t.title)))
        );
        if (matched) return matched;
      }
    } catch (err3) {
      console.warn('fetchTemplateById search in fetchTemplates failed:', err3);
    }
  }

  const cached = getCachedTemplates();
  if (cached && cached.length > 0) {
    const foundCached = cached.find((t) =>
      t.id === cleanId ||
      String(t.id).toLowerCase() === normId ||
      normalizeText(t.title) === normId ||
      (normalizeText(t.title) && normId && normalizeText(t.title).includes(normId))
    );
    if (foundCached) return normalizeTemplateData(foundCached.id, foundCached);
  }

  const foundDefault = DEFAULT_FEATURED_TEMPLATES.find((t) =>
    t.id === cleanId ||
    String(t.id).toLowerCase() === normId ||
    normalizeText(t.title) === normId ||
    (normalizeText(t.title) && normId && normalizeText(t.title).includes(normId))
  );
  if (foundDefault) return normalizeTemplateData(foundDefault.id, foundDefault);

  return null;
}
