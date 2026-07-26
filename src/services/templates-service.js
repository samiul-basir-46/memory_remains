import { safeJsonParse } from '../utils/ui.js';

export const API_BASE = "https://bkash-sms-gateway.onrender.com";
const TEMPLATES_CACHE_KEY = 'memory_remains_templates_cache_v3';
const CATEGORIES_CACHE_KEY = 'memory_remains_categories_cache_v3';
const COLLECTIONS_CACHE_KEY = 'memory_remains_collections_cache_v3';
const TEMPLATES_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let _memoryTemplatesCache = null;
let _memoryCategoriesCache = null;
let _memoryCollectionsCache = null;

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

      for (const colName of colNames) {
        try {
          const snap = await db.collection(colName).get();
          if (snap && snap.docs && snap.docs.length > 0) {
            for (const doc of snap.docs) {
              const d = doc.data();
              const name = d.name || d.title || '';
              const slug = (d.slug || doc.id || name).toLowerCase().trim();
              if (!name || seenSlugs.has(slug)) continue;
              seenSlugs.add(slug);

              const img = d.cover_image_url || d.coverImageUrl || d.image_url || d.imageUrl || d.image || '';
              uniqueList.push({
                id: doc.id,
                name: name,
                slug: d.slug || doc.id,
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
        } catch (e) {
          console.warn(`Fetch collections from '${colName}' warning:`, e);
        }
      }

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

export async function fetchTemplates(db, { limit, categoryId, productType, forceRefresh = false } = {}) {
  let masterList = !forceRefresh ? getCachedTemplates() : [];

  if (!masterList || masterList.length === 0) {
    if (db) {
      try {
        let combinedDocs = [];

        // 1. Fetch main templates collection
        try {
          const templatesSnap = await db.collection('templates').get();
          if (templatesSnap && templatesSnap.docs) {
            combinedDocs.push(...templatesSnap.docs.map((doc) => normalizeTemplateData(doc.id, doc.data())));
          }
        } catch (err) {
          console.warn('templates collection fetch warning:', err);
        }

        // 2. Fetch catalog_frames collection
        try {
          const framesSnap = await db.collection('catalog_frames').get();
          if (framesSnap && framesSnap.docs) {
            combinedDocs.push(...framesSnap.docs.map((doc) => normalizeTemplateData(doc.id, { productType: 'wall_frame', product_type: 'wall_frame', ...doc.data() })));
          }
        } catch (err) {
          console.warn('catalog_frames fetch warning:', err);
        }

        // 3. Fetch catalog_posters collection
        try {
          const postersSnap = await db.collection('catalog_posters').get();
          if (postersSnap && postersSnap.docs) {
            combinedDocs.push(...postersSnap.docs.map((doc) => normalizeTemplateData(doc.id, { productType: 'poster', product_type: 'poster', ...doc.data() })));
          }
        } catch (err) {
          console.warn('catalog_posters fetch warning:', err);
        }

        // 4. Fetch catalog_stickers collection
        try {
          const stickersSnap = await db.collection('catalog_stickers').get();
          if (stickersSnap && stickersSnap.docs) {
            combinedDocs.push(...stickersSnap.docs.map((doc) => normalizeTemplateData(doc.id, { productType: 'sticker', product_type: 'sticker', ...doc.data() })));
          }
        } catch (err) {
          console.warn('catalog_stickers fetch warning:', err);
        }

        // Deduplicate by ID
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
          masterList = uniqueDocs;
          setCachedTemplates(masterList);
        }
      } catch (error) {
        console.warn('Error fetching templates:', error);
      }
    }
  }

  // Filter in-memory from cached master list (0 Firestore reads on repeated filters/views!)
  let list = Array.isArray(masterList) ? [...masterList] : [];

  if (list.length > 0) {
    if (categoryId) {
      list = list.filter((t) => String(t.category_id) === String(categoryId) || normalizeText(t.category_name) === normalizeText(categoryId));
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

  const cached = getCachedTemplates();
  if (cached && cached.length > 0) {
    return cached;
  }

  return DEFAULT_FEATURED_TEMPLATES;
}

export async function fetchTemplateById(db, targetId) {
  const cleanId = String(targetId).trim();
  const normId = normalizeText(cleanId);

  // 1. Check in-memory / localStorage cache first (0 Firestore Reads!)
  const cached = getCachedTemplates();
  if (cached && cached.length > 0) {
    const foundCached = cached.find((t) => String(t.id) === cleanId || String(t.id).toLowerCase() === normId || normalizeText(t.title) === normId);
    if (foundCached) return normalizeTemplateData(foundCached.id, foundCached);
  }

  // 2. Query Firestore only if not found in cache
  if (db) {
    const collectionsToTry = ['templates', 'catalog_frames', 'catalog_posters', 'catalog_stickers'];
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
      const allTemplates = await fetchTemplates(db);
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
