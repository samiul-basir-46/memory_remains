import { safeJsonParse } from '../utils/ui.js';

export const API_BASE = "https://bkash-sms-gateway.onrender.com";
const TEMPLATES_CACHE_KEY = 'memory_remains_templates_cache_v3';
const CATEGORIES_CACHE_KEY = 'memory_remains_categories_cache_v3';
const COLLECTIONS_CACHE_KEY = 'memory_remains_collections_cache_v3';
const TEMPLATES_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let _memoryTemplatesCache = null;
let _memoryCategoriesCache = null;
let _memoryCollectionsCache = null;

// ─── Helper utilities ────────────────────────────────────────────────────────
export function normalizeText(str) {
  return String(str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

export function comparePrice(template = {}) {
  const comp = Number(template.compareAtPrice || template.compare_at_price || template.originalPrice || 0);
  const p = Number(template.price || template.customPrice || 0);
  return (comp > p) ? comp : null;
}

export function discountPercent(template = {}) {
  const comp = comparePrice(template);
  const p = Number(template.price || template.customPrice || 0);
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
  const price = Number(data.price || data.customPrice || 0);
  const compareAtPrice = Number(data.compareAtPrice || data.compare_at_price || data.originalPrice || 0);
  const img = data.imageUrl || data.image_url || data.cover_image_url || data.coverImageUrl || data.image || '';
  const pType = String(data.productType || data.product_type || 'magazine').toLowerCase().replace(/\s+/g, '_');
  const badge = data.badge || data.offer_badge || '';
  
  const rawShowcase = Array.isArray(data.showcaseImages) ? data.showcaseImages : (Array.isArray(data.galleryUrls) ? data.galleryUrls : []);
  const showcaseImages = rawShowcase.filter(Boolean);

  return {
    id,
    _id: id,
    templateId: id,
    title,
    name,
    price,
    compareAtPrice,
    compare_at_price: compareAtPrice,
    imageUrl: img,
    image_url: img,
    cover_image_url: img,
    coverImageUrl: img,
    productType: pType,
    product_type: pType,
    badge,
    offer_badge: badge,
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
    specs: data.specs || {},
    description: data.description || data.magazineDescription || data.templateDescription || data.subtitle || '',
    requiredPhotos: Number(data.requiredPhotos || data.photosCount || 12),
    minQuantity: Number(data.minQuantity || 1),
    maxQuantity: Number(data.maxQuantity || 50),
    supportedQuantities: Array.isArray(data.supportedQuantities) ? data.supportedQuantities : [],
    sort_order: Number(data.sort_order || data.order || 99),
    ...data
  };
}

export const DEFAULT_FEATURED_TEMPLATES = [
  {
    id: 'default-marvel-poster',
    title: 'Marvel Awesome Poster',
    name: 'Marvel Awesome Poster',
    price: 299,
    compareAtPrice: 399,
    imageUrl: 'https://res.cloudinary.com/cmpl84gp/image/upload/v1785044020/passkpuxfreyvurvuyvk.jpg',
    product_type: 'poster',
    productType: 'poster',
    badge: 'new',
    isFeatured: true,
    is_featured: true,
    isActive: true,
    is_active: true,
    description: 'Awesome Marvel custom poster collection.',
    requiredPhotos: 10
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
    } catch (_) {}
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
  } catch (_) {}
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

  // 1. Check in-memory / localStorage cache first
  const cached = getCachedTemplates();
  if (cached && cached.length > 0) {
    const foundCached = cached.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId || normalizeText(t.title) === normId);
    if (foundCached) return normalizeTemplateData(foundCached.id, foundCached);
  }

  // 2. Query Firestore only if not found in cache
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

  const foundDefault = DEFAULT_FEATURED_TEMPLATES.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId);
  if (foundDefault) return normalizeTemplateData(foundDefault.id, foundDefault);

  return null;
}
