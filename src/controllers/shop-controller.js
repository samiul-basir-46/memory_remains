import { fetchTemplates, fetchCategories, fetchCollections, getCachedTemplates, setCachedTemplates, DEFAULT_FEATURED_TEMPLATES, discountPercent } from '../services/templates-service.js';
import { renderProductCardV2 } from '../components/product-card.js';
import { renderProductGridSkeleton, renderEmptyState, renderErrorState } from '../components/skeleton.js';
import { setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { openSurface, closeSurface } from '../components/site-shell.js';
import { addTemplateToCart } from '../services/cart-service.js';
import { escapeHtml, qs, qsa } from '../utils/ui.js';

export async function renderShopPage(db) {
  const grid = qs('#templates-grid');
  if (!grid) return;

  grid.innerHTML = renderProductGridSkeleton(8);

  let allTemplates = [];
  let categoriesList = [];
  let collectionsList = [];

  let activeFilters = {
    categoryId: null,
    collectionSlug: null,
    productType: null,
    discountRanges: [],
    minPrice: null,
    maxPrice: null
  };

  let currentSort = 'recommended';

  const urlParams = new URLSearchParams(window.location.search);
  const initialParam = urlParams.get('title') || urlParams.get('category') || urlParams.get('collection');

  const renderSidebarAndMobileChips = () => {
    const desktopCatGroup = qs('#sidebar-categories-group');
    const desktopColGroup = qs('#sidebar-collections-group');
    const desktopCatList = qs('#sidebar-categories-list');
    const desktopColList = qs('#sidebar-collections-list');
    const mobileChips = qs('#mobile-sidebar-chips');

    if (desktopCatGroup && desktopCatList) {
      if (categoriesList.length === 0) {
        desktopCatGroup.hidden = true;
      } else {
        desktopCatGroup.hidden = false;
        desktopCatList.innerHTML = categoriesList.map((cat) => {
          const isSelected = activeFilters.categoryId === cat.id;
          const iconClass = cat.icon || 'fa-solid fa-tag';
          return `
            <button type="button" data-cat-id="${escapeHtml(cat.id)}" class="sidebar-cat-btn w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${isSelected ? 'bg-pink-50 text-primary font-bold shadow-sm' : 'text-gray-700 hover:bg-gray-50 hover:text-primary'}">
              <i class="${iconClass} text-xs text-primary/80"></i>
              <span class="truncate">${escapeHtml(cat.name)}</span>
            </button>
          `;
        }).join('');

        qsa('.sidebar-cat-btn', desktopCatList).forEach((btn) => {
          btn.onclick = (e) => {
            const catId = e.currentTarget.dataset.catId;
            if (activeFilters.categoryId === catId) {
              activeFilters.categoryId = null;
            } else {
              activeFilters.categoryId = catId;
              activeFilters.collectionSlug = null;
            }
            filterAndRender();
          };
        });
      }
    }

    if (desktopColGroup && desktopColList) {
      if (collectionsList.length === 0) {
        desktopColGroup.hidden = true;
      } else {
        desktopColGroup.hidden = false;
        desktopColList.innerHTML = collectionsList.map((col) => {
          const isSelected = activeFilters.collectionSlug === col.slug;
          return `
            <button type="button" data-col-slug="${escapeHtml(col.slug)}" class="sidebar-col-btn w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${isSelected ? 'bg-pink-50 text-primary font-bold shadow-sm' : 'text-gray-700 hover:bg-gray-50 hover:text-primary'}">
              <span class="truncate">${escapeHtml(col.name)}</span>
            </button>
          `;
        }).join('');

        qsa('.sidebar-col-btn', desktopColList).forEach((btn) => {
          btn.onclick = (e) => {
            const slug = e.currentTarget.dataset.colSlug;
            if (activeFilters.collectionSlug === slug) {
              activeFilters.collectionSlug = null;
            } else {
              activeFilters.collectionSlug = slug;
              activeFilters.categoryId = null;
            }
            filterAndRender();
          };
        });
      }
    }

    if (mobileChips) {
      const items = [
        { type: 'all', label: 'All Products', isSelected: !activeFilters.categoryId && !activeFilters.collectionSlug },
        ...categoriesList.map((c) => ({ type: 'cat', id: c.id, label: c.name, isSelected: activeFilters.categoryId === c.id })),
        ...collectionsList.map((c) => ({ type: 'col', slug: c.slug, label: c.name, isSelected: activeFilters.collectionSlug === c.slug }))
      ];

      mobileChips.innerHTML = items.map((item) => `
        <button type="button" data-chip-type="${item.type}" data-chip-id="${item.id || ''}" data-chip-slug="${item.slug || ''}" class="mobile-nav-chip px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${item.isSelected ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-pink-50'}">
          ${escapeHtml(item.label)}
        </button>
      `).join('');

      qsa('.mobile-nav-chip', mobileChips).forEach((chip) => {
        chip.onclick = (e) => {
          const type = e.currentTarget.dataset.chipType;
          const id = e.currentTarget.dataset.chipId;
          const slug = e.currentTarget.dataset.chipSlug;

          if (type === 'all') {
            clearAllFilters();
          } else if (type === 'cat') {
            activeFilters.categoryId = id;
            activeFilters.collectionSlug = null;
          } else if (type === 'col') {
            activeFilters.collectionSlug = slug;
            activeFilters.categoryId = null;
          }
          filterAndRender();
        };
      });
    }

    const allBtn = qs('#sidebar-all-products-btn');
    if (allBtn) {
      allBtn.onclick = () => {
        clearAllFilters();
        filterAndRender();
      };
    }

    qsa('.sidebar-type-btn').forEach((btn) => {
      const t = btn.dataset.sidebarType;
      const isActive = t === 'all' ? !activeFilters.productType : activeFilters.productType === t;
      btn.className = `sidebar-type-btn w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${isActive ? 'bg-pink-50 text-primary font-bold' : 'text-gray-700 hover:bg-gray-50 hover:text-primary'}`;
      btn.onclick = () => {
        activeFilters.productType = (t === 'all') ? null : t;
        if (t !== 'all') {
          activeFilters.categoryId = null;
          activeFilters.collectionSlug = null;
        }
        filterAndRender();
      };
    });
  };

  const TYPE_META = {
    magazine: { emoji: '📖', label: 'Magazines' },
    poster: { emoji: '📜', label: 'Posters' },
    wall_frame: { emoji: '🖼️', label: 'Wall Frames' },
    sticker: { emoji: '🏷️', label: 'Stickers' }
  };

  const renderProductTypeChips = () => {
    const container = qs('#product-type-chips');
    if (!container) return;

    const rawTypes = Array.from(new Set(allTemplates.map((t) => (t.product_type || t.productType || 'magazine').toLowerCase().replace(/\s+/g, '_')))).filter(Boolean);

    const order = ['magazine', 'wall_frame', 'poster', 'sticker'];
    rawTypes.sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const typeList = [
      { value: null, label: 'All Products', emoji: '✨' },
      ...rawTypes.map((t) => {
        const m = TYPE_META[t];
        return { value: t, label: m ? m.label : t.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), emoji: m ? m.emoji : '📦' };
      })
    ];

    container.innerHTML = typeList.map((item) => {
      const isSelected = activeFilters.productType === item.value;
      const activeClass = 'bg-primary text-white px-4 py-1.5 rounded-full text-sm font-bold cursor-pointer transition-all shadow-sm whitespace-nowrap';
      const inactiveClass = 'border border-gray-200 text-gray-600 hover:border-primary hover:text-primary px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-all bg-white whitespace-nowrap';
      return `<button type="button" data-product-type="${item.value || 'all'}" class="product-type-chip ${isSelected ? activeClass : inactiveClass}">${item.emoji} ${escapeHtml(item.label)}</button>`;
    }).join('');

    qsa('.product-type-chip', container).forEach((chip) => {
      chip.onclick = (e) => {
        const val = e.currentTarget.dataset.productType;
        if (val === 'all') {
          activeFilters.productType = null;
        } else {
          activeFilters.productType = activeFilters.productType === val ? null : val;
        }
        filterAndRender();
      };
    });
  };

  const renderActiveFilterDisplay = (count) => {
    const bar = qs('#active-filter-indicator-bar');
    const chipsList = qs('#active-filter-chips-list');
    const countDisplay = qs('#product-count-display');

    if (countDisplay) {
      countDisplay.textContent = `Showing ${count} product${count === 1 ? '' : 's'}`;
    }

    if (!bar || !chipsList) return;

    const activeList = [];

    if (activeFilters.categoryId) {
      const catObj = categoriesList.find((c) => c.id === activeFilters.categoryId);
      activeList.push({ key: 'categoryId', label: catObj ? catObj.name : 'Category' });
    }

    if (activeFilters.collectionSlug) {
      const colObj = collectionsList.find((c) => c.slug === activeFilters.collectionSlug);
      activeList.push({ key: 'collectionSlug', label: colObj ? colObj.name : 'Collection' });
    }

    if (activeFilters.productType) {
      const displayType = activeFilters.productType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      activeList.push({ key: 'productType', label: displayType });
    }

    if (activeList.length === 0) {
      bar.classList.add('opacity-0', 'hidden');
      bar.classList.remove('opacity-100');
      return;
    }

    bar.classList.remove('hidden');
    setTimeout(() => {
      bar.classList.remove('opacity-0');
      bar.classList.add('opacity-100');
    }, 10);

    chipsList.innerHTML = activeList.map((item) => `
      <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-pink-200 text-primary text-xs font-bold rounded-full shadow-sm">
        ${escapeHtml(item.label)}
        <button type="button" data-remove-key="${item.key}" class="remove-filter-x hover:text-red-600 cursor-pointer ml-0.5 font-bold">&times;</button>
      </span>
    `).join('');

    qsa('.remove-filter-x', chipsList).forEach((btn) => {
      btn.onclick = (e) => {
        const key = e.currentTarget.dataset.removeKey;
        activeFilters[key] = null;
        filterAndRender();
      };
    });
  };

  const renderCollectionBanner = () => {
    const banner = qs('#collection-detail-header');
    if (!banner) return;

    if (!activeFilters.collectionSlug) {
      banner.hidden = true;
      return;
    }

    const colObj = collectionsList.find((c) => c.slug === activeFilters.collectionSlug);
    if (!colObj) {
      banner.hidden = true;
      return;
    }

    const titleEl = qs('#collection-title');
    const descEl = qs('#collection-desc');
    const bgEl = qs('#collection-banner-bg');
    const backBtn = qs('#collection-back-btn');

    if (titleEl) titleEl.textContent = colObj.name;
    if (descEl) descEl.textContent = colObj.description || 'Curated collection templates.';

    if (colObj.cover_image_url && colObj.cover_image_url.trim()) {
      if (bgEl) {
        bgEl.style.backgroundImage = `url('${colObj.cover_image_url}')`;
        bgEl.hidden = false;
      }
    } else if (bgEl) {
      bgEl.hidden = true;
    }

    if (backBtn) {
      backBtn.onclick = () => {
        activeFilters.collectionSlug = null;
        filterAndRender();
      };
    }

    banner.hidden = false;
  };

  const applyFiltering = () => {
    let result = [...allTemplates];

    if (activeFilters.collectionSlug) {
      const colObj = collectionsList.find((c) => c.slug === activeFilters.collectionSlug);
      if (colObj && Array.isArray(colObj.template_ids) && colObj.template_ids.length > 0) {
        result = result.filter((t) => colObj.template_ids.includes(String(t.id)));
      } else if (colObj) {
        const normCol = colObj.name.toLowerCase();
        result = result.filter((t) => (t.collection || '').toLowerCase().includes(normCol));
      }
    }

    if (activeFilters.categoryId) {
      result = result.filter((t) => String(t.category_id || t.categoryId) === String(activeFilters.categoryId));
    }

    if (activeFilters.productType) {
      result = result.filter((t) => (t.product_type || t.productType || 'magazine').toLowerCase() === activeFilters.productType.toLowerCase());
    }

    if (activeFilters.discountRanges && activeFilters.discountRanges.length > 0) {
      result = result.filter((t) => {
        const disc = discountPercent(t);
        return activeFilters.discountRanges.some((range) => {
          if (range === '0-20') return disc >= 0 && disc <= 20;
          if (range === '21-40') return disc >= 21 && disc <= 40;
          if (range === '41-60') return disc >= 41 && disc <= 60;
          if (range === '61-80') return disc >= 61 && disc <= 80;
          if (range === '81-100') return disc >= 81 && disc <= 100;
          return true;
        });
      });
    }

    if (activeFilters.minPrice !== null && !isNaN(activeFilters.minPrice)) {
      result = result.filter((t) => Number(t.price || 0) >= activeFilters.minPrice);
    }
    if (activeFilters.maxPrice !== null && !isNaN(activeFilters.maxPrice)) {
      result = result.filter((t) => Number(t.price || 0) <= activeFilters.maxPrice);
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
  };

  const clearAllFilters = () => {
    activeFilters.categoryId = null;
    activeFilters.collectionSlug = null;
    activeFilters.productType = null;
    activeFilters.discountRanges = [];
    activeFilters.minPrice = null;
    activeFilters.maxPrice = null;
  };

  const filterAndRender = () => {
    renderSidebarAndMobileChips();
    renderProductTypeChips();
    renderCollectionBanner();

    const filtered = applyFiltering();
    renderActiveFilterDisplay(filtered.length);

    if (filtered.length === 0) {
      grid.innerHTML = renderEmptyState({
        title: 'No products found',
        message: 'No products match your selected category or product type filter.',
        actionText: 'Show All Products',
        actionUrl: 'javascript:void(0)'
      });

      const btn = grid.querySelector('a');
      if (btn) {
        btn.onclick = (e) => {
          e.preventDefault();
          clearAllFilters();
          filterAndRender();
        };
      }
      return;
    }

    grid.innerHTML = filtered.map(renderProductCardV2).join('');
    grid.classList.add('fade-in-content');
    setupLazyCloudinaryImages(grid);

    qsa('.card-add-to-cart', grid).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const rawData = decodeURIComponent(btn.dataset.template || '{}');
          const tplData = JSON.parse(rawData);
          const mode = btn.dataset.mode || 'magazine';
          const titleSuffix = mode === 'template' ? ' (Digital Template)' : '';
          const usePrice = mode === 'template' ? (tplData.template_price || tplData.price) : tplData.price;
          addTemplateToCart({
            ...tplData,
            title: `${tplData.title || 'Product'}${titleSuffix}`,
            price: usePrice,
            purchaseMode: mode
          });
        } catch (err) {
          console.warn('Cart add error:', err);
        }
      });
    });
  };

  const initSortEvents = () => {
    const filterBtn = qs('#open-filter-btn');
    const filterDrawer = qs('#filter-drawer');
    const closeFilterBtn = qs('#filter-drawer-close-btn');
    const filterOverlay = qs('#filter-drawer-overlay');
    const sortBtn = qs('#sort-dropdown-btn');
    const sortMenu = qs('#sort-dropdown-menu');

    if (filterBtn && filterDrawer) {
      filterBtn.onclick = () => {
        filterDrawer.classList.add('is-open');
        openSurface(filterDrawer, filterOverlay);
      };
    }

    if (closeFilterBtn && filterDrawer) {
      closeFilterBtn.onclick = () => {
        filterDrawer.classList.remove('is-open');
        closeSurface(filterDrawer, filterOverlay);
      };
    }

    if (filterOverlay && filterDrawer) {
      filterOverlay.onclick = () => {
        filterDrawer.classList.remove('is-open');
        closeSurface(filterDrawer, filterOverlay);
      };
    }

    document.addEventListener('click', (e) => {
      if (filterDrawer && filterDrawer.classList.contains('is-open')) {
        const isClickInside = filterDrawer.contains(e.target);
        const isClickOnOpenBtn = filterBtn && filterBtn.contains(e.target);
        if (!isClickInside && !isClickOnOpenBtn) {
          filterDrawer.classList.remove('is-open');
          closeSurface(filterDrawer, filterOverlay);
        }
      }
    });

    if (sortBtn && sortMenu) {
      sortBtn.onclick = (e) => {
        e.stopPropagation();
        sortMenu.hidden = !sortMenu.hidden;
      };

      document.onclick = (e) => {
        if (!sortBtn.contains(e.target) && !sortMenu.contains(e.target)) {
          sortMenu.hidden = true;
        }
      };
    }

    qsa('.sort-option').forEach((opt) => {
      opt.onclick = () => {
        qsa('.sort-option').forEach((o) => o.classList.remove('is-active'));
        opt.classList.add('is-active');
        currentSort = opt.dataset.sort || 'recommended';
        const label = qs('#sort-current-label');
        if (label) label.textContent = opt.textContent.trim();
        if (sortMenu) sortMenu.hidden = true;
        filterAndRender();
      };
    });
  };

  initSortEvents();

  try {
    const cached = getCachedTemplates();
    if (cached && cached.length > 0) {
      allTemplates = cached;
      filterAndRender();
    }

    const [cats, cols, templates] = await Promise.all([
      fetchCategories(db),
      fetchCollections(db),
      fetchTemplates(db)
    ]);

    categoriesList = cats || [];
    collectionsList = cols || [];

    if (templates && templates.length > 0) {
      allTemplates = templates;
      setCachedTemplates(templates);
    } else if (!allTemplates.length) {
      allTemplates = DEFAULT_FEATURED_TEMPLATES;
    }

    if (initialParam) {
      const normInit = initialParam.toLowerCase();
      const matchedCat = categoriesList.find((c) => c.name.toLowerCase() === normInit || c.slug.toLowerCase() === normInit || c.id === initialParam);
      const matchedCol = collectionsList.find((c) => c.name.toLowerCase() === normInit || c.slug.toLowerCase() === normInit || c.id === initialParam);

      if (matchedCat) {
        activeFilters.categoryId = matchedCat.id;
      } else if (matchedCol) {
        activeFilters.collectionSlug = matchedCol.slug;
      }
    }

    filterAndRender();
  } catch (error) {
    console.error('Failed to load shop page templates:', error);
    if (!allTemplates.length) {
      grid.innerHTML = renderErrorState({
        title: 'Failed to Load Products',
        message: 'Unable to connect to product server.',
        onRetry: () => renderShopPage(db)
      });
    }
  }
}
