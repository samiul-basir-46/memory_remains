import { fetchTemplates, getCachedTemplates, setCachedTemplates, DEFAULT_FEATURED_TEMPLATES, comparePrice, discountPercent } from '../services/templates-service.js';
import { renderProductCard } from '../components/product-card.js';
import { setupLazyCloudinaryImages, buildCloudinaryDeliveryUrl } from '../utils/cloudinary.js';
import { escapeHtml, qs } from '../utils/ui.js';

function renderShowcaseCard(template = {}) {
  const price = Number(template.price || template.customPrice || 0);
  const compare = comparePrice(template);
  const discount = discountPercent(template);
  const templateId = template.id || template._id || template.templateId;
  const detailsUrl = templateId ? `/pages/product-details?id=${encodeURIComponent(templateId)}` : '#';
  const primaryImg = template.imageUrl || '/assets/product_placeholder.png';
  const gallery = [primaryImg, ...(template.galleryUrls || [])].filter(Boolean);

  return `
    <div class="showcase-card bg-white rounded-2xl overflow-hidden shadow-2xl border border-pink-100 grid grid-cols-1 lg:grid-cols-12 max-w-5xl mx-auto my-2 max-h-[85vh] lg:max-h-[540px]">
      <!-- Left Column: Product Image Gallery (Fixed container showing 100% full uncropped image) -->
      <div class="relative bg-gray-950 lg:col-span-6 flex items-center justify-center p-4 overflow-hidden h-[360px] sm:h-[440px] lg:h-[540px] group">
        <!-- Ambient Blurred Background Image for rich visual aesthetics -->
        <img id="showcase-bg-${template.id || 'default'}" src="${buildCloudinaryDeliveryUrl(primaryImg, { width: 300 })}" alt="" class="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-125 pointer-events-none transition-all duration-300">

        <!-- 100% Uncropped Full View Display Image -->
        <img id="showcase-img-${template.id || 'default'}" src="${buildCloudinaryDeliveryUrl(primaryImg, { width: 900 })}" alt="${escapeHtml(template.title || template.name)}" class="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl transition-all duration-300">

        ${gallery.length > 1 ? `
          <button type="button" onclick="const img = document.getElementById('showcase-img-${template.id}'); const bg = document.getElementById('showcase-bg-${template.id}'); const urls = ${JSON.stringify(gallery).replace(/"/g, '&quot;')}; let idx = parseInt(img.dataset.idx || 0); idx = (idx - 1 + urls.length) % urls.length; img.src = urls[idx]; if(bg) bg.src = urls[idx]; img.dataset.idx = idx;" class="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-[#2A2A2A] flex items-center justify-center shadow-lg cursor-pointer hover:bg-white hover:scale-110 active:scale-95 text-xs z-20 border border-pink-100"><i class="fa-solid fa-chevron-left"></i></button>
          <button type="button" onclick="const img = document.getElementById('showcase-img-${template.id}'); const bg = document.getElementById('showcase-bg-${template.id}'); const urls = ${JSON.stringify(gallery).replace(/"/g, '&quot;')}; let idx = parseInt(img.dataset.idx || 0); idx = (idx + 1) % urls.length; img.src = urls[idx]; if(bg) bg.src = urls[idx]; img.dataset.idx = idx;" class="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-[#2A2A2A] flex items-center justify-center shadow-lg cursor-pointer hover:bg-white hover:scale-110 active:scale-95 text-xs z-20 border border-pink-100"><i class="fa-solid fa-chevron-right"></i></button>
        ` : ''}
      </div>

      <!-- Right Column: Product Info & Purchase Options -->
      <div class="bg-[#FDF0F4] lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-4 overflow-y-auto max-h-[540px]">
        <div>
          <h3 class="font-heading text-2xl md:text-3xl text-[#2A2A2A] font-normal mb-3 leading-snug">
            <a href="${detailsUrl}" class="hover:text-primary transition-colors">${escapeHtml(template.title || template.name || 'Untitled Product')}</a>
          </h3>
          <div class="flex items-baseline gap-3 mb-1">
            <strong class="text-2xl md:text-3xl font-bold text-[#2A2A2A]">₹${price}</strong>
            ${compare ? `<span class="text-gray-500 line-through text-base">₹${compare}</span>` : ''}
            ${discount ? `<span class="text-[#00664E] font-semibold text-base">${discount}% Off</span>` : ''}
          </div>
          <p class="text-xs text-text-soft mb-6">Incl. of all taxes</p>

          <div class="grid grid-cols-2 gap-4 mb-6">
            <button onclick="addTemplateToCart(${JSON.stringify(template).replace(/"/g, '&quot;')})" type="button" class="py-3 px-4 rounded-xl border-2 border-primary bg-white/80 hover:bg-white text-primary font-bold text-sm transition-all cursor-pointer text-center active:scale-95 shadow-sm">Add To Cart</button>
            <button onclick="addTemplateToCart(${JSON.stringify(template).replace(/"/g, '&quot;')}); window.location.href='/pages/cart'" type="button" class="py-3 px-4 rounded-xl bg-[#DC3C71] hover:bg-[#c23260] text-white font-bold text-sm shadow-md transition-all cursor-pointer text-center active:scale-95">Buy Now</button>
          </div>

          <div class="space-y-2.5 text-xs text-[#2A2A2A] pt-4 border-t border-pink-200/60">
            <div class="flex items-center gap-2.5"><i class="fa-solid fa-truck text-primary text-sm"></i> <span>Delivered in 3-15 Days</span></div>
            <div class="flex items-center gap-2.5"><i class="fa-solid fa-box text-primary text-sm"></i> <span>Free Delivery on all purchases above ₹999</span></div>
            <p class="text-[11px] text-text-soft pt-1">after placing order click on WhatsApp icon to share details (92503 03360)</p>
          </div>
        </div>

        <div class="flex justify-between items-center text-xs font-semibold text-[#2A2A2A] border-t border-pink-200/60 pt-4">
          <span>Personalized Gift Template</span>
          <a href="${detailsUrl}" class="text-primary hover:underline font-bold text-sm">View More</a>
        </div>
      </div>
    </div>
  `;
}

export async function renderHomePage(db) {
  let homeTemplates = [];

  const collections = [
    { title: 'FOR HER', display: 'FOR HER', linkTitle: 'FOR HER' },
    { title: 'I Love My Self', display: 'I LOVE<br>MY SELF', linkTitle: 'I Love My Self' },
    { title: 'Best Selling', display: 'BEST<br>SELLING', linkTitle: 'Best Selling' },
    { title: 'Birthday Special', display: 'BIRTHDAY<br>SPECIAL', linkTitle: 'Birthday Special' }
  ];

  const categories = ['FOR HIM', 'FOR HER', 'Birthday Special', 'Anniversary', 'Best Selling', 'Self Love'];

  const renderHomeSections = (templatesList = []) => {
    const list = (templatesList && templatesList.length > 0) ? templatesList : DEFAULT_FEATURED_TEMPLATES;

    // 1. Featured Products Slider
    const featuredCarousel = qs('#featured-carousel');
    if (featuredCarousel) {
      const featuredList = list.slice(0, 5);
      featuredCarousel.innerHTML = featuredList.map(renderProductCard).join('');
    }

    // 2. Shop by Collection (Dark Maroon Cards)
    const collectionsGrid = qs('#collections-grid');
    if (collectionsGrid) {
      collectionsGrid.innerHTML = collections.map((col) => `
        <a href="/collections/paid-products?title=${encodeURIComponent(col.linkTitle)}" class="megamenu-card flex flex-col gap-3 no-underline group">
          <div class="megamenu-card-bg bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-4 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl">
            <span class="text-white font-heading text-2xl font-bold leading-tight text-glow">${col.display}</span>
          </div>
          <span class="megamenu-card-title text-text-dark text-sm font-semibold text-center group-hover:text-primary transition-colors">${escapeHtml(col.title)}</span>
        </a>
      `).join('');
    }

    // 3. Best Selling Showcase
    const bestSellingEl = qs('#best-selling-highlight');
    if (bestSellingEl) {
      const bestItem = list[0] || DEFAULT_FEATURED_TEMPLATES[0];
      bestSellingEl.innerHTML = renderShowcaseCard(bestItem);
    }

    // 4. Premium Magazine Vogue Showcase
    const vogueEl = qs('#vogue-highlight');
    if (vogueEl) {
      const vogueItem = list.find((t) => (t.title || '').toLowerCase().includes('vogue')) || list[1] || DEFAULT_FEATURED_TEMPLATES[1];
      vogueEl.innerHTML = renderShowcaseCard(vogueItem);
    }

    // 5. Premium Magazine Soulmate Showcase
    const soulmateEl = qs('#soulmate-highlight');
    if (soulmateEl) {
      const soulmateItem = list.find((t) => (t.title || '').toLowerCase().includes('soulmate')) || list[2] || DEFAULT_FEATURED_TEMPLATES[2];
      soulmateEl.innerHTML = renderShowcaseCard(soulmateItem);
    }

    // 6. Premium Magazine Couple Showcase
    const coupleEl = qs('#couple-highlight');
    if (coupleEl) {
      const coupleItem = list.find((t) => (t.title || '').toLowerCase().includes('couple')) || list[3] || DEFAULT_FEATURED_TEMPLATES[3];
      coupleEl.innerHTML = renderShowcaseCard(coupleItem);
    }

    // 7. Categories Circles
    const categoriesCircleGrid = qs('#categories-circle-grid');
    if (categoriesCircleGrid) {
      categoriesCircleGrid.innerHTML = categories.map((cat) => `
        <a href="/collections/paid-products?title=${encodeURIComponent(cat)}" class="category-circle-card group no-underline text-center flex flex-col items-center gap-3">
          <div class="w-24 h-24 rounded-full bg-[#fdf6f0] border-2 border-primary flex items-center justify-center text-2xl text-primary shadow-sm group-hover:scale-110 transition-transform">
            <i class="fa-solid fa-heart"></i>
          </div>
          <span class="text-sm font-semibold text-[#2A2A2A] group-hover:text-primary transition-colors">${escapeHtml(cat)}</span>
        </a>
      `).join('');
    }

    setupLazyCloudinaryImages(document);
  };

  const initCarouselButtons = () => {
    const featCarousel = qs('#featured-carousel');
    const prevFeat = qs('#prev-featured-btn');
    const nextFeat = qs('#next-featured-btn');

    if (featCarousel && prevFeat && nextFeat) {
      prevFeat.addEventListener('click', () => {
        featCarousel.scrollBy({ left: -300, behavior: 'smooth' });
      });
      nextFeat.addEventListener('click', () => {
        featCarousel.scrollBy({ left: 300, behavior: 'smooth' });
      });
    }
  };

  try {
    const cached = getCachedTemplates();
    if (cached && cached.length > 0) {
      homeTemplates = cached;
      renderHomeSections(homeTemplates);
    } else {
      renderHomeSections(DEFAULT_FEATURED_TEMPLATES);
    }

    initCarouselButtons();

    const fresh = await fetchTemplates(db, { orderByCreated: false });
    if (fresh && fresh.length > 0) {
      homeTemplates = fresh;
      setCachedTemplates(fresh);
      renderHomeSections(homeTemplates);
    }
  } catch (error) {
    console.error('Failed to load home templates:', error);
    renderHomeSections(DEFAULT_FEATURED_TEMPLATES);
  }
}
