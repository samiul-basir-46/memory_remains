import { fetchTemplates, fetchCollections, getCachedTemplates, setCachedTemplates, DEFAULT_FEATURED_TEMPLATES, comparePrice, discountPercent } from '../services/templates-service.js';
import { renderProductCard } from '../components/product-card.js';
import { setupLazyCloudinaryImages, buildCloudinaryDeliveryUrl } from '../utils/cloudinary.js';
import { escapeHtml, qs } from '../utils/ui.js';

// ─── Showcase Card (large split-layout highlight) ──────────────────────────
function renderShowcaseCard(template = {}) {
  const price = Number(template.price || template.customPrice || 0);
  const compare = comparePrice(template);
  const discount = discountPercent(template);
  const templateId = template.id || template._id || template.templateId;
  const detailsUrl = templateId ? `/pages/product-details/?id=${encodeURIComponent(templateId)}` : '#';
  const primaryImg = template.imageUrl || '/assets/product_placeholder.png';
  const gallery = [primaryImg, ...(template.galleryUrls || [])].filter(Boolean);

  return `
    <div class="showcase-card bg-[#FFF5F0] rounded-2xl overflow-hidden shadow-2xl border border-[#F4C5B1] grid grid-cols-1 lg:grid-cols-12 max-w-5xl mx-auto my-2 max-h-[85vh] lg:max-h-[540px]">
      <div class="relative bg-[#2C1A14] lg:col-span-6 flex items-center justify-center p-4 overflow-hidden h-[360px] sm:h-[440px] lg:h-[540px] group">
        <img id="showcase-bg-${template.id || 'default'}" src="${buildCloudinaryDeliveryUrl(primaryImg, { width: 300 })}" alt="" class="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-125 pointer-events-none transition-all duration-300">
        <img id="showcase-img-${template.id || 'default'}" src="${buildCloudinaryDeliveryUrl(primaryImg, { width: 900 })}" alt="${escapeHtml(template.title || template.name)}" class="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl transition-all duration-300">
        ${gallery.length > 1 ? `
          <button type="button" onclick="const img=document.getElementById('showcase-img-${template.id}');const bg=document.getElementById('showcase-bg-${template.id}');const urls=${JSON.stringify(gallery).replace(/"/g, '&quot;')};let idx=parseInt(img.dataset.idx||0);idx=(idx-1+urls.length)%urls.length;img.src=urls[idx];if(bg)bg.src=urls[idx];img.dataset.idx=idx;" class="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FFF5F0]/90 text-[#2C1A14] flex items-center justify-center shadow-lg cursor-pointer hover:bg-[#FFF5F0] hover:scale-110 active:scale-95 text-xs z-20 border border-[#F4C5B1]"><i class="fa-solid fa-chevron-left"></i></button>
          <button type="button" onclick="const img=document.getElementById('showcase-img-${template.id}');const bg=document.getElementById('showcase-bg-${template.id}');const urls=${JSON.stringify(gallery).replace(/"/g, '&quot;')};let idx=parseInt(img.dataset.idx||0);idx=(idx+1)%urls.length;img.src=urls[idx];if(bg)bg.src=urls[idx];img.dataset.idx=idx;" class="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FFF5F0]/90 text-[#2C1A14] flex items-center justify-center shadow-lg cursor-pointer hover:bg-[#FFF5F0] hover:scale-110 active:scale-95 text-xs z-20 border border-[#F4C5B1]"><i class="fa-solid fa-chevron-right"></i></button>
        ` : ''}
      </div>
      <div class="bg-[#FFE8DF] lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-4 overflow-y-auto max-h-[540px]">
        <div>
          <h3 class="font-heading text-2xl md:text-3xl text-[#2C1A14] font-normal mb-3 leading-snug">
            <a href="${detailsUrl}" class="hover:text-[#C97B5F] transition-colors">${escapeHtml(template.title || template.name || 'Untitled Product')}</a>
          </h3>
          <div class="flex items-baseline gap-3 mb-1">
            <strong class="text-2xl md:text-3xl font-bold text-[#2C1A14]">৳${price}</strong>
            ${compare ? `<span class="text-[#8B4A38] line-through text-base opacity-75">৳${compare}</span>` : ''}
            ${discount ? `<span class="text-[#C97B5F] font-semibold text-base">${discount}% Off</span>` : ''}
          </div>
          <p class="text-xs text-[#8B4A38] mb-6">Incl. of all taxes</p>
          <div class="grid grid-cols-2 gap-4 mb-6">
            <button onclick="addTemplateToCart(${JSON.stringify(template).replace(/"/g, '&quot;')})" type="button" class="py-3 px-4 rounded-xl border-2 border-[#C97B5F] bg-[#FFF5F0] hover:bg-[#FFE8DF] text-[#8B4A38] font-bold text-sm transition-all cursor-pointer text-center active:scale-95 shadow-sm">Add To Cart</button>
            <button onclick="addTemplateToCart(${JSON.stringify(template).replace(/"/g, '&quot;')}); window.location.href='/pages/cart'" type="button" class="py-3 px-4 rounded-xl bg-[#C97B5F] hover:bg-[#8B4A38] text-[#FFF5F0] font-bold text-sm shadow-md transition-all cursor-pointer text-center active:scale-95">Buy Now</button>
          </div>
          <div class="space-y-2.5 text-xs text-[#2C1A14] pt-4 border-t border-[#F4C5B1]">
            <div class="flex items-center gap-2.5"><i class="fa-solid fa-truck text-[#C97B5F] text-sm"></i> <span>Delivered in 3-15 Days</span></div>
            <div class="flex items-center gap-2.5"><i class="fa-solid fa-box text-[#C97B5F] text-sm"></i> <span>Free Delivery on all purchases above ৳999</span></div>
          </div>
        </div>
        <div class="flex justify-between items-center text-xs font-semibold text-[#2C1A14] border-t border-[#F4C5B1] pt-4">
          <span>Personalized Gift Template</span>
          <a href="${detailsUrl}" class="text-[#C97B5F] hover:underline font-bold text-sm">View More</a>
        </div>
      </div>
    </div>
  `;
}

// ─── Filter products by keyword in title/type/category ─────────────────────
function filterByKeyword(list, keywords) {
  return list.filter((t) => {
    const hay = `${t.title || ''} ${t.name || ''} ${t.product_type || ''} ${t.category || ''} ${t.collection || ''}`.toLowerCase();
    return keywords.some((k) => hay.includes(k.toLowerCase()));
  });
}

// ─── Category metadata ──────────────────────────────────────────────────────
const CAT_META = {
  'FOR HIM': { icon: 'fa-person', tagline: 'Gifts for Guys', bg: 'linear-gradient(135deg,#2C1A14,#8B4A38)' },
  'FOR HER': { icon: 'fa-person-dress', tagline: 'Special for Her', bg: 'linear-gradient(135deg,#8B4A38,#C97B5F)' },
  'Birthday Special': { icon: 'fa-cake-candles', tagline: 'Make It Memorable', bg: 'linear-gradient(135deg,#C97B5F,#F4C5B1)' },
  'Anniversary': { icon: 'fa-heart', tagline: 'Romantic Stories', bg: 'linear-gradient(135deg,#8B4A38,#C97B5F)' },
  'Best Selling': { icon: 'fa-fire', tagline: 'Top Loved Items', bg: 'linear-gradient(135deg,#2C1A14,#C97B5F)' },
  'Self Love': { icon: 'fa-spa', tagline: 'Personalized Art', bg: 'linear-gradient(135deg,#8B4A38,#F4C5B1)' },
};

export async function renderHomePage(db) {
  let homeTemplates = [];
  let fetchedCollections = [];

  const categories = ['FOR HIM', 'FOR HER', 'Birthday Special', 'Anniversary', 'Best Selling', 'Self Love'];

  const renderHomeSections = (templatesList = [], collectionsList = []) => {
    const list = templatesList || [];

    // ── Collections grid ──────────────────────────────────────────────────
    let collectionsToRender = [];
    if (collectionsList && collectionsList.length > 0) {
      collectionsToRender = collectionsList.map((c) => ({
        name: c.name || c.title || 'Collection',
        slug: c.slug || c.id || c.name,
        cover_image_url: c.cover_image_url || c.coverImageUrl || c.image || ''
      }));
    } else {
      const colMap = new Map();
      list.forEach((t) => {
        const colName = (t.collection || t.category || '').trim();
        if (colName && !colMap.has(colName.toLowerCase())) {
          colMap.set(colName.toLowerCase(), { name: colName, slug: colName, cover_image_url: t.imageUrl || '' });
        }
      });
      collectionsToRender = Array.from(colMap.values());
      if (collectionsToRender.length === 0) {
        collectionsToRender = [
          { name: 'FOR HER', slug: 'FOR HER' },
          { name: 'Self Love', slug: 'Self Love' },
          { name: 'Best Selling', slug: 'Best Selling' },
          { name: 'Birthday Special', slug: 'Birthday Special' }
        ];
      }
    }
    if (collectionsToRender.length > 8) collectionsToRender = collectionsToRender.slice(0, 8);

    const featuredCarousel = qs('#featured-carousel');
    if (featuredCarousel) {
      let featuredItems = list.filter((t) => t.isFeatured === true || t.is_featured === true || String(t.isFeatured) === 'true' || String(t.is_featured) === 'true');
      if (featuredItems.length === 0 && list.length > 0) {
        featuredItems = list;
      }
      if (featuredItems.length > 0) {
        featuredCarousel.innerHTML = featuredItems.slice(0, 8).map(renderProductCard).join('');
      } else {
        featuredCarousel.innerHTML = '';
      }
    }

    const heroPreview = qs('#hero-preview');
    if (heroPreview) {
      const productsWithImages = list.filter((t) => t.imageUrl && typeof t.imageUrl === 'string' && t.imageUrl.trim().length > 0);
      const top3 = productsWithImages.slice(0, 3);
      if (top3.length > 0) {
        heroPreview.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;opacity:0.9;">
            ${top3.slice(0, 2).map((t) => {
          const img = buildCloudinaryDeliveryUrl(t.imageUrl, { width: 350 });
          const url = t.id ? `/pages/product-details/?id=${encodeURIComponent(t.id)}` : '#';
          return `
                <a href="${url}" style="border-radius:18px;overflow:hidden;display:block;box-shadow:0 14px 40px rgba(0,0,0,0.35);border:2px solid rgba(255,255,255,0.15);text-decoration:none;" class="transition-transform duration-300 hover:scale-105">
                  <img src="${img}" alt="${escapeHtml(t.title || '')}" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block;">
                </a>
              `;
        }).join('')}
            ${top3[2] ? (() => {
            const t = top3[2];
            const img = buildCloudinaryDeliveryUrl(t.imageUrl, { width: 350 });
            const url = t.id ? `/pages/product-details/?id=${encodeURIComponent(t.id)}` : '#';
            return `
                <a href="${url}" style="grid-column:1/-1;border-radius:18px;overflow:hidden;display:block;box-shadow:0 14px 40px rgba(0,0,0,0.35);border:2px solid rgba(255,255,255,0.15);text-decoration:none;" class="transition-transform duration-300 hover:scale-105">
                  <img src="${img}" alt="${escapeHtml(t.title || '')}" style="width:100%;height:140px;object-fit:cover;display:block;">
                </a>
              `;
          })() : ''}
          </div>
        `;
      }
    }

    // 3. Magazine row
    const magazineRow = qs('#magazine-row');
    const mobileMagCarousel = qs('#mobile-magazine-carousel');
    if (list.length > 0) {
      const magazineItems = list.filter((t) => {
        const pType = String(t.product_type || t.productType || '').toLowerCase();
        const title = String(t.title || t.name || '').toLowerCase();
        const cat = String(t.category || t.collection || '').toLowerCase();
        return (pType === 'magazine' || pType === 'template' || title.includes('magazine') || title.includes('vogue') || cat.includes('magazine')) && pType !== 'poster' && pType !== 'wall_frame' && pType !== 'sticker';
      });
      if (magazineRow) {
        if (magazineItems.length > 0) {
          magazineRow.innerHTML = magazineItems.slice(0, 8).map(renderProductCard).join('');
        } else {
          magazineRow.innerHTML = '';
        }
      }
      if (mobileMagCarousel) {
        if (magazineItems.length > 0) {
          mobileMagCarousel.innerHTML = magazineItems.slice(0, 6).map(renderProductCard).join('');
        } else {
          mobileMagCarousel.innerHTML = '';
        }
      }
    }
    const bestSellingEl = qs('#best-selling-highlight');
    if (bestSellingEl && list.length > 0) {
      const bestItem = list.find((t) => (t.badge || '').toString().toLowerCase().includes('bestseller'))
        || list.find((t) => (t.title || '').toLowerCase().includes('best'))
        || list[0];
      if (bestItem) bestSellingEl.innerHTML = renderShowcaseCard(bestItem);
    }
    const frameRow = qs('#frame-row');
    if (frameRow && list.length > 0) {
      const frameItems = list.filter((t) => {
        const pType = String(t.product_type || t.productType || '').toLowerCase();
        const title = String(t.title || t.name || '').toLowerCase();
        const cat = String(t.category || t.collection || '').toLowerCase();
        return pType.includes('frame') || title.includes('frame') || cat.includes('frame');
      });
      if (frameItems.length > 0) {
        frameRow.innerHTML = frameItems.slice(0, 8).map(renderProductCard).join('');
      } else {
        frameRow.innerHTML = '';
      }
    }
    const vogueEl = qs('#vogue-highlight');
    if (vogueEl && list.length > 0) {
      const vogueItem = list.find((t) => (t.title || '').toLowerCase().includes('vogue'))
        || list.find((t) => (t.product_type || '').toLowerCase() === 'magazine');
      if (vogueItem) {
        vogueEl.innerHTML = renderShowcaseCard(vogueItem);
      } else if (vogueEl.closest('section')) {
        vogueEl.closest('section').style.display = 'none';
      }
    }
    const collectionsGrid = qs('#collections-grid');
    if (collectionsGrid) {
      collectionsGrid.innerHTML = collectionsToRender.map((col) => {
        const name = col.name;
        const coverImg = col.cover_image_url;
        const linkUrl = `/collections/paid-products?title=${encodeURIComponent(name)}`;
        return `
          <a href="${linkUrl}" class="megamenu-card flex flex-col gap-3 no-underline group">
            <div class="megamenu-card-bg relative bg-[#360505] rounded-xl aspect-[3/4] overflow-hidden flex items-center justify-center p-4 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl">
              ${coverImg ? `
                <img src="${buildCloudinaryDeliveryUrl(coverImg, { width: 400 })}" alt="${escapeHtml(name)}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-75 transition-opacity">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              ` : ''}
              <span class="relative z-10 text-white font-heading text-2xl font-bold leading-tight text-glow uppercase">${escapeHtml(name)}</span>
            </div>
            <span class="megamenu-card-title text-text-dark text-sm font-semibold text-center group-hover:text-primary transition-colors">${escapeHtml(name)}</span>
          </a>
        `;
      }).join('');
    }
    const soulmateEl = qs('#soulmate-highlight');
    if (soulmateEl && list.length > 0) {
      const soulmateItem = list.find((t) => (t.title || '').toLowerCase().includes('soulmate'))
        || list.find((t) => (t.product_type || '').toLowerCase() === 'magazine');
      if (soulmateItem) {
        soulmateEl.innerHTML = renderShowcaseCard(soulmateItem);
      } else if (soulmateEl.closest('section')) {
        soulmateEl.closest('section').style.display = 'none';
      }
    }

    // 9. Couple Showcase
    const coupleEl = qs('#couple-highlight');
    if (coupleEl && list.length > 0) {
      const coupleItem = list.find((t) => (t.title || '').toLowerCase().includes('couple'))
        || list.find((t) => (t.product_type || '').toLowerCase() === 'magazine');
      if (coupleItem) {
        coupleEl.innerHTML = renderShowcaseCard(coupleItem);
      } else if (coupleEl.closest('section')) {
        coupleEl.closest('section').style.display = 'none';
      }
    }

    // 10. Categories — BIG visual cards
    const categoriesCircleGrid = qs('#categories-circle-grid');
    if (categoriesCircleGrid) {
      categoriesCircleGrid.innerHTML = categories.map((cat) => {
        const meta = CAT_META[cat] || { icon: 'fa-tag', tagline: 'Personalized Gifts', bg: 'linear-gradient(135deg,#3b1c1c,#C97B5F)' };

        // Find a matching product image for background if available
        const catProduct = list.find((t) =>
          ((t.title || '').toLowerCase().includes(cat.toLowerCase()) ||
            (t.category || '').toLowerCase().includes(cat.toLowerCase()) ||
            (t.collection || '').toLowerCase().includes(cat.toLowerCase())) &&
          t.imageUrl && t.imageUrl.trim().length > 0
        );

        const hasRealImg = Boolean(catProduct && catProduct.imageUrl && catProduct.imageUrl.startsWith('http'));
        const bgImg = hasRealImg ? buildCloudinaryDeliveryUrl(catProduct.imageUrl, { width: 400 }) : null;

        return `
          <a href="/collections/paid-products?title=${encodeURIComponent(cat)}" class="cat-big-card group" style="background:${meta.bg};">
            ${bgImg ? `<img src="${bgImg}" alt="${escapeHtml(cat)}" class="cat-big-card-img">` : ''}
            <div class="cat-big-card-overlay"></div>
            <div class="cat-big-card-content">
              <div class="cat-big-icon">
                <i class="fa-solid ${meta.icon}"></i>
              </div>
              <h4 class="cat-big-name">${escapeHtml(cat)}</h4>
              <span class="cat-big-sub">${escapeHtml(meta.tagline)}</span>
              <span class="cat-big-btn">Explore <i class="fa-solid fa-chevron-right text-[9px] ml-1"></i></span>
            </div>
          </a>
        `;
      }).join('');
    }

    setupLazyCloudinaryImages(document);
  };

  const initCarouselButtons = () => {
    const featCarousel = qs('#featured-carousel');
    const prevFeat = qs('#prev-featured-btn');
    const nextFeat = qs('#next-featured-btn');
    if (featCarousel && prevFeat && nextFeat) {
      prevFeat.addEventListener('click', () => { featCarousel.scrollBy({ left: -300, behavior: 'smooth' }); });
      nextFeat.addEventListener('click', () => { featCarousel.scrollBy({ left: 300, behavior: 'smooth' }); });
    }
  };

  try {
    const cached = getCachedTemplates();
    const hasRealCachedImages = cached && cached.length > 0 && cached.some((t) => t.imageUrl && t.imageUrl.startsWith('http'));

    if (hasRealCachedImages) {
      homeTemplates = cached;
      renderHomeSections(homeTemplates, fetchedCollections);
      initCarouselButtons();
    }

    const [freshTemplates, cols] = await Promise.all([
      fetchTemplates(db, { forceRefresh: true }),
      fetchCollections(db, { forceRefresh: true })
    ]);

    if (cols && cols.length > 0) fetchedCollections = cols;

    if (freshTemplates && freshTemplates.length > 0) {
      homeTemplates = freshTemplates;
      setCachedTemplates(freshTemplates);
      renderHomeSections(homeTemplates, fetchedCollections);
      initCarouselButtons();
    }
  } catch (error) {
    console.error('Failed to load home templates:', error);
  }
}
