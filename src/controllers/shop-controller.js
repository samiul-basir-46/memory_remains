import { fetchTemplates, getCachedTemplates, setCachedTemplates, DEFAULT_FEATURED_TEMPLATES, discountPercent } from '../services/templates-service.js';
import { renderProductCardV2 } from '../components/product-card.js';
import { setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { openSurface, closeSurface } from '../components/site-shell.js';
import { qs, qsa } from '../utils/ui.js';

export async function renderShopPage(db) {
  const grid = qs('#templates-grid');
  if (!grid) return;

  let shopTemplates = [];
  let currentSort = 'recommended';
  let filterState = {
    inStock: false,
    discountRanges: [],
    minPrice: null,
    maxPrice: null
  };

  const urlParams = new URLSearchParams(window.location.search);
  const titleParam = urlParams.get('title') || urlParams.get('category') || urlParams.get('collection');
  const mainTitleEl = qs('#page-main-title');
  if (mainTitleEl && titleParam) {
    mainTitleEl.textContent = titleParam;
    document.title = `${titleParam} - Hearts and Beans`;
  }

  function filterAndSortTemplates(templatesList) {
    let result = [...templatesList];

    if (filterState.discountRanges && filterState.discountRanges.length > 0) {
      result = result.filter((t) => {
        const disc = discountPercent(t);
        return filterState.discountRanges.some((range) => {
          if (range === '0-20') return disc >= 0 && disc <= 20;
          if (range === '21-40') return disc >= 21 && disc <= 40;
          if (range === '41-60') return disc >= 41 && disc <= 60;
          if (range === '61-80') return disc >= 61 && disc <= 80;
          if (range === '81-100') return disc >= 81 && disc <= 100;
          return true;
        });
      });
    }

    if (filterState.minPrice !== null && !isNaN(filterState.minPrice)) {
      result = result.filter((t) => Number(t.price || 0) >= filterState.minPrice);
    }
    if (filterState.maxPrice !== null && !isNaN(filterState.maxPrice)) {
      result = result.filter((t) => Number(t.price || 0) <= filterState.maxPrice);
    }

    if (currentSort === 'price-asc') {
      result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (currentSort === 'price-desc') {
      result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (currentSort === 'title-asc') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (currentSort === 'title-desc') {
      result.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    } else if (currentSort === 'discount-desc') {
      result.sort((a, b) => discountPercent(b) - discountPercent(a));
    } else if (currentSort === 'discount-asc') {
      result.sort((a, b) => discountPercent(a) - discountPercent(b));
    }

    return result;
  }

  function updateActiveFilterBadges(renderCallback) {
    const container = qs('#active-filters-container');
    const clearBtn = qs('#clear-all-filters-btn');
    if (!container) return;

    let badgesHtml = '';
    let hasFilters = false;

    if (qs('#filter-in-stock')?.checked) {
      badgesHtml += `<span class="active-filter-badge">In Stock <button type="button" id="remove-instock-filter">&times;</button></span>`;
      hasFilters = true;
    }

    if (filterState.discountRanges && filterState.discountRanges.length > 0) {
      filterState.discountRanges.forEach((r) => {
        badgesHtml += `<span class="active-filter-badge">Discount ${r}% <button type="button" class="remove-discount-badge" data-val="${r}">&times;</button></span>`;
      });
      hasFilters = true;
    }

    container.innerHTML = badgesHtml;
    if (clearBtn) clearBtn.hidden = !hasFilters;

    qs('#remove-instock-filter')?.addEventListener('click', () => {
      if (qs('#filter-in-stock')) qs('#filter-in-stock').checked = false;
      updateActiveFilterBadges(renderCallback);
      qs('#apply-filter-btn')?.click();
    });

    qsa('.remove-discount-badge').forEach((b) => {
      b.addEventListener('click', () => {
        const val = b.dataset.val;
        const targetCb = document.querySelector(`.discount-filter-cb[value="${val}"]`);
        if (targetCb) targetCb.checked = false;
        qs('#apply-filter-btn')?.click();
      });
    });
  }

  function initFilterAndSortEvents(renderCallback) {
    const openBtn = qs('#open-filter-btn');
    const closeBtn = qs('#filter-drawer-close-btn');
    const drawerOverlay = qs('#filter-drawer-overlay');
    const drawer = qs('#filter-drawer');

    openBtn?.addEventListener('click', () => {
      openSurface(drawer, drawerOverlay);
    });

    closeBtn?.addEventListener('click', () => {
      closeSurface(drawer, drawerOverlay);
    });

    drawerOverlay?.addEventListener('click', () => {
      closeSurface(drawer, drawerOverlay);
    });

    qsa('.filter-accordion__header').forEach((hdr) => {
      hdr.addEventListener('click', () => {
        const accordion = hdr.closest('.filter-accordion');
        if (!accordion) return;
        const isOpen = accordion.classList.toggle('is-open');
        const icon = hdr.querySelector('i');
        if (icon) {
          icon.className = isOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
        }
      });
    });

    const minInput = qs('#price-slider-min');
    const maxInput = qs('#price-slider-max');
    const minDisplay = qs('#price-min-display');
    const maxDisplay = qs('#price-max-display');
    const trackFill = qs('#slider-track-fill');
    const priceSubtext = qs('#price-range-header-subtext');

    function updateDualSlider() {
      if (!minInput || !maxInput) return;
      let minVal = parseInt(minInput.value, 10);
      let maxVal = parseInt(maxInput.value, 10);

      const parsedMin = parseInt(minInput.min, 10);
      const minLimit = Number.isFinite(parsedMin) ? parsedMin : 0;
      const parsedMax = parseInt(maxInput.max, 10);
      const maxLimit = Number.isFinite(parsedMax) ? parsedMax : 2000;

      if (minVal > maxVal - 10) {
        minVal = maxVal - 10;
        minInput.value = minVal;
      }
      if (maxVal < minVal + 10) {
        maxVal = minVal + 10;
        maxInput.value = maxVal;
      }

      if (minDisplay) minDisplay.textContent = `₹${minVal}`;
      if (maxDisplay) maxDisplay.textContent = `₹${maxVal}`;

      const leftPercent = ((minVal - minLimit) / (maxLimit - minLimit)) * 100;
      const rightPercent = 100 - (((maxVal - minLimit) / (maxLimit - minLimit)) * 100);

      if (trackFill) {
        trackFill.style.left = `${leftPercent}%`;
        trackFill.style.right = `${rightPercent}%`;
      }

      filterState.minPrice = minVal > minLimit ? minVal : null;
      filterState.maxPrice = maxVal < maxLimit ? maxVal : null;

      if (priceSubtext) {
        if (minVal > minLimit || maxVal < maxLimit) {
          priceSubtext.style.display = 'inline';
        } else {
          priceSubtext.style.display = 'none';
        }
      }
    }

    minInput?.addEventListener('input', updateDualSlider);
    maxInput?.addEventListener('input', updateDualSlider);
    updateDualSlider();

    qs('#apply-filter-btn')?.addEventListener('click', () => {
      const selectedDiscounts = Array.from(document.querySelectorAll('.discount-filter-cb:checked')).map((el) => el.value);
      filterState.discountRanges = selectedDiscounts;
      updateDualSlider();

      updateActiveFilterBadges(renderCallback);
      closeSurface(drawer, drawerOverlay);
      if (renderCallback) renderCallback();
    });

    qs('#filter-reset-btn')?.addEventListener('click', () => {
      document.querySelectorAll('.discount-filter-cb').forEach((cb) => { cb.checked = false; });
      if (qs('#filter-in-stock')) qs('#filter-in-stock').checked = false;
      if (minInput) minInput.value = 0;
      if (maxInput) maxInput.value = 2000;
      updateDualSlider();
      filterState.discountRanges = [];
      updateActiveFilterBadges(renderCallback);
      if (renderCallback) renderCallback();
    });

    qs('#clear-all-filters-btn')?.addEventListener('click', () => {
      qs('#filter-reset-btn')?.click();
    });

    const sortBtn = qs('#sort-dropdown-btn');
    const sortMenu = qs('#sort-dropdown-menu');

    sortBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sortMenu) sortMenu.hidden = !sortMenu.hidden;
    });

    document.addEventListener('click', (e) => {
      if (!sortBtn?.contains(e.target) && !sortMenu?.contains(e.target)) {
        if (sortMenu) sortMenu.hidden = true;
      }
    });

    qsa('.sort-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        qsa('.sort-option').forEach((o) => o.classList.remove('is-active'));
        opt.classList.add('is-active');
        currentSort = opt.dataset.sort || 'recommended';
        const label = qs('#sort-current-label');
        if (label) label.textContent = opt.textContent.trim();
        if (sortMenu) sortMenu.hidden = true;
        if (renderCallback) renderCallback();
      });
    });
  }

  const renderCurrent = () => {
    let source = (shopTemplates && shopTemplates.length > 0) ? shopTemplates : DEFAULT_FEATURED_TEMPLATES;
    if (titleParam) {
      const normTitle = titleParam.toLowerCase();
      const categoryMatches = source.filter((t) => {
        const cat = (t.category || t.collection || '').toLowerCase();
        const badge = (t.badge || '').toLowerCase();
        const title = (t.title || '').toLowerCase();
        return cat.includes(normTitle) || badge.includes(normTitle) || title.includes(normTitle);
      });
      if (categoryMatches.length > 0) {
        source = categoryMatches;
      }
    }
    const filtered = filterAndSortTemplates(source);
    grid.innerHTML = filtered.map(renderProductCardV2).join('');
    setupLazyCloudinaryImages(grid);
  };

  initFilterAndSortEvents(renderCurrent);
  updateActiveFilterBadges(renderCurrent);

  try {
    const cached = getCachedTemplates();
    if (cached && cached.length > 0) {
      shopTemplates = cached;
    } else {
      shopTemplates = DEFAULT_FEATURED_TEMPLATES;
    }
    renderCurrent();

    const fresh = await fetchTemplates(db, { orderByCreated: false });
    if (fresh && fresh.length > 0) {
      shopTemplates = fresh;
      setCachedTemplates(fresh);
      renderCurrent();
    }
  } catch (error) {
    console.error('Failed to load shop templates:', error);
    if (!shopTemplates.length) {
      shopTemplates = DEFAULT_FEATURED_TEMPLATES;
      renderCurrent();
    }
  }
}
