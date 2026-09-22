import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

export function renderCatalogTab(container) {
  let currentSubTab = adminState.getState().catalogSubTab || 'templates';
  let itemsList = [];
  let searchQuery = '';
  let activeUnsub = null;

  const subTabConfigs = {
    templates: {
      collection: 'templates',
      title: 'Magazine Templates',
      icon: 'fa-solid fa-book-open',
      singular: 'Magazine Template'
    },
    frames: {
      collection: 'catalog_frames',
      title: 'Wall Frames',
      icon: 'fa-solid fa-crop-simple',
      singular: 'Wall Frame'
    },
    posters: {
      collection: 'catalog_posters',
      title: 'Posters',
      icon: 'fa-solid fa-image',
      singular: 'Poster Pack'
    },
    stickers: {
      collection: 'catalog_stickers',
      title: 'Stickers',
      icon: 'fa-solid fa-note-sticky',
      singular: 'Sticker Pack'
    }
  };

  container.innerHTML = `
    <div class="flex flex-col h-full bg-[#F8FAFC]">
      
      <!-- Sub-tabs Header Bar -->
      <div class="px-5 py-4 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-4">
        
        <!-- Segmented Sub Tabs -->
        <div class="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl overflow-x-auto admin-custom-scroll">
          <button data-subtab="templates" class="catalog-subtab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentSubTab === 'templates' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <i class="fa-solid fa-book-open mr-1.5"></i> Magazine Templates
          </button>
          <button data-subtab="frames" class="catalog-subtab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentSubTab === 'frames' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <i class="fa-solid fa-crop-simple mr-1.5"></i> Wall Frames
          </button>
          <button data-subtab="posters" class="catalog-subtab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentSubTab === 'posters' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <i class="fa-solid fa-image mr-1.5"></i> Posters
          </button>
          <button data-subtab="stickers" class="catalog-subtab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentSubTab === 'stickers' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <i class="fa-solid fa-note-sticky mr-1.5"></i> Stickers
          </button>
        </div>

        <!-- Add Button & Search -->
        <div class="flex items-center gap-3">
          <div class="relative w-48 sm:w-60">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
              type="text" 
              id="catalog-search-input" 
              placeholder="Filter items..." 
              class="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-600 focus:bg-white transition-all placeholder:text-slate-400"
            >
          </div>

          <button id="add-catalog-item-btn" class="px-4 py-2 bg-[#0F766E] hover:bg-[#0D9488] active:bg-[#115E59] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5">
            <i class="fa-solid fa-plus text-xs"></i> Add <span id="add-btn-type-label">${subTabConfigs[currentSubTab].singular}</span>
          </button>
        </div>

      </div>

      <!-- Items Grid View -->
      <div id="catalog-items-grid" class="flex-1 overflow-y-auto p-5 admin-custom-scroll">
        <div class="flex items-center justify-center py-16 text-slate-400 text-xs">
          <i class="fa-solid fa-spinner animate-spin text-lg mr-2 text-teal-600"></i> Loading catalog items...
        </div>
      </div>

    </div>
  `;

  const gridContainer = container.querySelector('#catalog-items-grid');
  const searchInput = container.querySelector('#catalog-search-input');
  const addBtn = container.querySelector('#add-catalog-item-btn');
  const addBtnTypeLabel = container.querySelector('#add-btn-type-label');
  const subTabBtns = container.querySelectorAll('.catalog-subtab-btn');

  const renderGrid = () => {
    let filtered = itemsList;
    if (searchQuery) {
      filtered = itemsList.filter(it => 
        (it.title && it.title.toLowerCase().includes(searchQuery)) ||
        (it.name && it.name.toLowerCase().includes(searchQuery)) ||
        (it.category && it.category.toLowerCase().includes(searchQuery)) ||
        (it.description && it.description.toLowerCase().includes(searchQuery)) ||
        (it.occasion && it.occasion.toLowerCase().includes(searchQuery))
      );
    }

    if (filtered.length === 0) {
      gridContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 text-2xl mb-3">
            <i class="fa-solid fa-boxes-stacked"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-700 mb-1">No Items in this Category</h4>
          <p class="text-xs text-slate-400 max-w-xs mb-4">Click "Add ${subTabConfigs[currentSubTab].singular}" to create a new product item.</p>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        ${filtered.map(item => {
          const title = item.title || item.name || 'Untitled';
          const imgUrl = item.imageUrl || item.coverUrl || item.previewUrl || item.catalog_preview_url || '/assets/product_placeholder.png';
          
          let displayPrice = 'N/A';
          if (item.price) displayPrice = `৳${item.price}`;
          else if (item.pageTiers && item.pageTiers.length > 0) displayPrice = `৳${item.pageTiers[0].price}`;
          else if (item.comboPrices && item.comboPrices['5']) displayPrice = `৳${item.comboPrices['5']}`;

          const offerPct = Number(item.offerPercentage || item.discountPercent || 0);
          const occasion = item.occasion || item.category || '';
          const badge = typeof item.badge === 'string' ? item.badge : (Array.isArray(item.badge) ? item.badge[0] : '');

          return `
            <div class="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-teal-500/50 transition-all duration-200 flex flex-col group">
              
              <!-- Item Image Cover -->
              <div class="relative aspect-4/3 bg-slate-100 overflow-hidden">
                <img src="${imgUrl}" alt="${title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='/assets/product_placeholder.png'">
                
                <!-- Price Badge -->
                <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  ${offerPct > 0 ? `
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-xs">
                      ${offerPct}% OFF
                    </span>
                  ` : ''}
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/95 backdrop-blur-sm text-slate-900 shadow-xs">
                    ${displayPrice}
                  </span>
                </div>

                ${badge ? `
                  <div class="absolute top-2.5 left-2.5">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600/90 text-white shadow-xs">
                      ${badge}
                    </span>
                  </div>
                ` : ''}
              </div>

              <!-- Item Content -->
              <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 class="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">${title}</h4>
                  
                  <div class="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                    ${occasion ? `<span class="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">${occasion}</span>` : ''}
                    ${item.pageTiers?.length ? `<span class="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md font-medium">${item.pageTiers.length} Tiers</span>` : ''}
                    ${item.specs?.material ? `<span class="bg-slate-100 px-2 py-0.5 rounded-md">${item.specs.material}</span>` : ''}
                    ${item.specs?.size ? `<span class="bg-slate-100 px-2 py-0.5 rounded-md">${item.specs.size}</span>` : ''}
                    ${item.specs?.paper_type ? `<span class="bg-slate-100 px-2 py-0.5 rounded-md">${item.specs.paper_type}</span>` : ''}
                    ${item.specs?.pack_quantity ? `<span class="bg-slate-100 px-2 py-0.5 rounded-md">${item.specs.pack_quantity}</span>` : ''}
                  </div>

                  ${item.description ? `<p class="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">${item.description}</p>` : ''}
                </div>

                <!-- Footer Actions -->
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button data-action="edit" data-item-id="${item.id}" class="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1">
                    <i class="fa-solid fa-pen text-[10px]"></i> Edit
                  </button>
                  <button data-action="delete" data-item-id="${item.id}" class="text-xs font-semibold text-rose-500 hover:text-rose-700 flex items-center gap-1">
                    <i class="fa-solid fa-trash text-[10px]"></i> Delete
                  </button>
                </div>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    // Wire Card Events
    gridContainer.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = btn.getAttribute('data-action');
        const itemId = btn.getAttribute('data-item-id');
        const item = itemsList.find(it => it.id === itemId);

        if (action === 'edit' && item) {
          openEditorForCurrentTab(currentSubTab, item);
        } else if (action === 'delete') {
          if (!confirm(`Permanently delete this ${subTabConfigs[currentSubTab].singular}?`)) return;
          try {
            await adminApi.deleteCatalogItem(subTabConfigs[currentSubTab].collection, itemId);
            adminState.showToast('success', 'Item deleted successfully');
          } catch (err) {
            adminState.showToast('error', 'Failed to delete: ' + err.message);
          }
        }
      });
    });
  };

  const switchSubTab = (subTab) => {
    currentSubTab = subTab;
    adminState.setCatalogSubTab(subTab);

    subTabBtns.forEach(b => {
      const isCurrent = b.getAttribute('data-subtab') === subTab;
      b.className = `catalog-subtab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${isCurrent ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`;
    });

    addBtnTypeLabel.textContent = subTabConfigs[subTab].singular;

    if (activeUnsub) activeUnsub();
    gridContainer.innerHTML = `
      <div class="flex items-center justify-center py-16 text-slate-400 text-xs">
        <i class="fa-solid fa-spinner animate-spin text-lg mr-2 text-teal-600"></i> Loading ${subTabConfigs[subTab].title}...
      </div>
    `;

    activeUnsub = adminApi.watchCatalogCollection(subTabConfigs[subTab].collection, items => {
      itemsList = items;
      renderGrid();
    });
    adminState.addSubscription(activeUnsub);
  };

  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchSubTab(btn.getAttribute('data-subtab')));
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderGrid();
  });

  addBtn.addEventListener('click', () => {
    openEditorForCurrentTab(currentSubTab, null);
  });

  // Initial load
  switchSubTab(currentSubTab);
}

function openEditorForCurrentTab(subTab, item) {
  if (subTab === 'templates') {
    openTemplateEditorModal(item);
  } else if (subTab === 'frames') {
    openFrameEditorModal(item);
  } else if (subTab === 'posters') {
    openPosterEditorModal(item);
  } else if (subTab === 'stickers') {
    openStickerEditorModal(item);
  }
}

/**
 * 1. MAGAZINE TEMPLATE EDITOR (Matching Flutter template_editor_dialog.dart)
 */
function openTemplateEditorModal(existingItem) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const isEdit = Boolean(existingItem);
  const data = existingItem || {};

  const predefinedOccasions = [
    'Personal', 'Birthday', 'BF/GF', 'Anniversary', 'Marriage',
    'Parents', 'Special Day', 'Farewell', 'Best Friend', 'Other'
  ];

  let currentOccasion = data.occasion || data.category || 'Personal';
  let isOtherOccasion = !predefinedOccasions.slice(0, -1).includes(currentOccasion);
  let otherOccasionVal = isOtherOccasion ? currentOccasion : '';

  // Badges
  const standardBadges = ['Bestseller', 'New', 'Trending', 'Special Offer', 'Popular'];
  let selectedBadges = [];
  if (Array.isArray(data.badge)) selectedBadges = [...data.badge];
  else if (typeof data.badge === 'string' && data.badge) selectedBadges = [data.badge];

  // Magazine Page Tiers
  let pageTiers = Array.isArray(data.pageTiers || data.page_tiers) ? JSON.parse(JSON.stringify(data.pageTiers || data.page_tiers)) : [
    { pages: 4, label: '4 Pages', price: 550, minPhotos: 8, maxPhotos: 12 },
    { pages: 8, label: '8 Pages', price: 950, minPhotos: 15, maxPhotos: 20 },
    { pages: 12, label: '12 Pages', price: 1350, minPhotos: 22, maxPhotos: 30 }
  ];

  // Showcase Gallery Images
  let showcaseImages = Array.isArray(data.showcaseImages || data.galleryImages) ? [...(data.showcaseImages || data.galleryImages)] : [];

  let currentSection = 0; // 0: Basic & Pricing, 1: Specs & Page Tiers, 2: Media & Gallery

  const modalHtml = `
    <div id="template-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div class="admin-modal-card w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-book-open text-base"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">${isEdit ? 'Edit' : 'Add'} Magazine Template</h3>
              <p class="text-xs text-slate-500">Configure template pricing, page tiers, specs & gallery</p>
            </div>
          </div>
          <button id="close-template-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Section Navigation Tabs -->
        <div class="px-6 pt-3 bg-white border-b border-slate-200 flex items-center gap-4 text-xs font-bold flex-shrink-0">
          <button data-sec="0" class="sec-tab-btn pb-2.5 border-b-2 transition-all border-[#0F766E] text-[#0F766E]">
            1. Basic & Pricing
          </button>
          <button data-sec="1" class="sec-tab-btn pb-2.5 border-b-2 transition-all border-transparent text-slate-500 hover:text-slate-800">
            2. Specs & Page Tiers
          </button>
          <button data-sec="2" class="sec-tab-btn pb-2.5 border-b-2 transition-all border-transparent text-slate-500 hover:text-slate-800">
            3. Media & Showcase Gallery
          </button>
        </div>

        <!-- Form Body -->
        <form id="template-editor-form" class="p-6 overflow-y-auto space-y-5 admin-custom-scroll flex-1">
          
          <!-- SECTION 0: Basic & Pricing -->
          <div id="sec-panel-0" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Title / Name *</label>
              <input type="text" id="tmpl-title" required value="${data.title || data.name || ''}" placeholder="e.g. Modern Minimalist Magazine" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Subtitle</label>
                <input type="text" id="tmpl-subtitle" value="${data.subtitle || ''}" placeholder="e.g. Elegant Birthday Edition" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Occasion *</label>
                <select id="tmpl-occasion-select" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600 bg-white">
                  ${predefinedOccasions.map(occ => `
                    <option value="${occ}" ${(!isOtherOccasion && currentOccasion === occ) || (isOtherOccasion && occ === 'Other') ? 'selected' : ''}>
                      ${occ}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div id="tmpl-other-occasion-container" class="${isOtherOccasion ? '' : 'hidden'}">
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Custom Occasion Name</label>
              <input type="text" id="tmpl-other-occasion-input" value="${otherOccasionVal}" placeholder="e.g. Graduation Day" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>

            <!-- Pricing Row -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Base Price (BDT) *</label>
                <input type="number" id="tmpl-price" required value="${data.price || data.customPrice || 550}" placeholder="550" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Offer % (Discount)</label>
                <input type="number" id="tmpl-offer-pct" value="${data.offerPercentage || ''}" placeholder="0" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Canva Template Price (BDT)</label>
                <input type="number" id="tmpl-digital-price" value="${data.digitalPrice || data.templateSalePrice || ''}" placeholder="250" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
              </div>
            </div>

            <div id="calculated-offer-preview" class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold hidden">
              Final Offer Price: <strong id="calc-offer-val">৳0</strong>
            </div>

            <!-- Badges Selector -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Badges / Tags</label>
              <div class="flex flex-wrap items-center gap-1.5 mb-2" id="badge-chips-container">
                ${standardBadges.map(b => {
                  const active = selectedBadges.includes(b);
                  return `
                    <button type="button" data-badge="${b}" class="badge-chip px-3 py-1 rounded-full text-xs font-bold transition-all border ${active ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}">
                      ${b}
                    </button>
                  `;
                }).join('')}
              </div>
              <input type="text" id="tmpl-custom-badge" placeholder="Add custom badge text (e.g. Top Rated)" class="w-full px-3.5 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Canva Master Template URL</label>
              <input type="text" id="tmpl-canva-link" value="${data.canvaUrl || data.canva_link || ''}" placeholder="https://canva.com/design/..." class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Description</label>
              <textarea id="tmpl-desc" rows="3" placeholder="Tell customers about the design, style, and typography..." class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">${data.description || ''}</textarea>
            </div>
          </div>

          <!-- SECTION 1: Specs & Page Tiers -->
          <div id="sec-panel-1" class="space-y-5 hidden">
            
            <!-- Toggles Row -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="tmpl-sale-toggle" class="w-4 h-4 rounded text-teal-600" ${data.isTemplateForSale ? 'checked' : ''}>
                <span class="font-semibold text-slate-800">For Sale on Canva</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="tmpl-featured-toggle" class="w-4 h-4 rounded text-teal-600" ${data.isFeatured ? 'checked' : ''}>
                <span class="font-semibold text-slate-800">Featured Showcase</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="tmpl-active-toggle" class="w-4 h-4 rounded text-teal-600" ${data.isActive !== false ? 'checked' : ''}>
                <span class="font-semibold text-slate-800">Active / Visible</span>
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Orientation</label>
                <select id="tmpl-orientation" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600 bg-white">
                  <option value="Portrait" ${data.orientation === 'Portrait' ? 'selected' : ''}>Portrait</option>
                  <option value="Landscape" ${data.orientation === 'Landscape' ? 'selected' : ''}>Landscape</option>
                  <option value="Square" ${data.orientation === 'Square' ? 'selected' : ''}>Square</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Default Page Count</label>
                <input type="number" id="tmpl-page-count" value="${data.pageCount || 8}" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Dimensions</label>
                <input type="text" id="tmpl-dimensions" value="${data.dimensions || 'A4 (8.27 x 11.69 in)'}" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
              </div>
            </div>

            <!-- Page Tiers Builder (Exact Match to Flutter MagazinePageTier) -->
            <div class="border border-slate-200 rounded-xl overflow-hidden">
              <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Magazine Page Tiers & Limits</h4>
                  <p class="text-[11px] text-slate-500">Configure page variations with required photo count range and pricing</p>
                </div>
                <button type="button" id="add-page-tier-btn" class="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-xs">
                  <i class="fa-solid fa-plus text-xs"></i> Add Page Tier
                </button>
              </div>

              <div id="page-tiers-list-container" class="divide-y divide-slate-100 p-2">
                <!-- Injected dynamically -->
              </div>
            </div>

          </div>

          <!-- SECTION 2: Media & Showcase Gallery -->
          <div id="sec-panel-2" class="space-y-5 hidden">
            
            <!-- Cover Image Upload Box -->
            <div class="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-slate-700 uppercase tracking-wider">Cover Image *</label>
                <span class="text-[11px] text-slate-400">Main thumbnail shown in catalog</span>
              </div>

              <div class="flex flex-col sm:flex-row items-center gap-4">
                <div class="w-24 h-24 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
                  <img id="cover-preview-img" src="${data.imageUrl || data.coverUrl || '/assets/product_placeholder.png'}" class="w-full h-full object-cover" onerror="this.src='/assets/product_placeholder.png'">
                </div>

                <div class="flex-1 space-y-2 w-full">
                  <input type="text" id="tmpl-cover-url" value="${data.imageUrl || data.coverUrl || ''}" placeholder="Image URL (Cloudinary, Firebase, or external)" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600 bg-white">
                  
                  <div class="flex items-center gap-2">
                    <label class="px-3 py-1.5 bg-white border border-slate-300 hover:border-teal-600 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs">
                      <i class="fa-solid fa-cloud-arrow-up text-teal-600"></i>
                      <span>Upload from Device</span>
                      <input type="file" id="cover-file-input" accept="image/*" class="hidden">
                    </label>
                    <span id="cover-upload-status" class="text-xs text-slate-400 font-medium"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Showcase Gallery Images (Multiple) -->
            <div class="border border-slate-200 rounded-2xl p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Showcase Gallery Photos</h4>
                  <p class="text-[11px] text-slate-400">Additional preview images displayed on customer product details</p>
                </div>

                <label class="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs">
                  <i class="fa-solid fa-plus text-xs"></i>
                  <span>Upload Photos</span>
                  <input type="file" id="gallery-file-input" multiple accept="image/*" class="hidden">
                </label>
              </div>

              <!-- Gallery Preview Grid -->
              <div id="gallery-thumbnails-grid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 min-h-[80px] p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                <!-- Injected dynamically -->
              </div>
            </div>

          </div>

          <!-- Bottom Footer Navigation & Submit -->
          <div class="pt-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
            <button type="button" id="prev-sec-btn" class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors hidden">
              <i class="fa-solid fa-chevron-left mr-1"></i> Back
            </button>
            <div class="flex items-center gap-2 ml-auto">
              <button type="button" id="next-sec-btn" class="px-5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Next <i class="fa-solid fa-chevron-right ml-1"></i>
              </button>
              <button type="submit" id="save-template-btn" class="px-6 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
                <i class="fa-solid fa-check text-xs"></i> Save Template
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('template-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-template-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  // Section Tab Buttons
  const secTabs = modalContainer.querySelectorAll('.sec-tab-btn');
  const secPanels = [
    document.getElementById('sec-panel-0'),
    document.getElementById('sec-panel-1'),
    document.getElementById('sec-panel-2')
  ];
  const prevSecBtn = document.getElementById('prev-sec-btn');
  const nextSecBtn = document.getElementById('next-sec-btn');

  const showSection = (idx) => {
    currentSection = idx;
    secPanels.forEach((p, i) => {
      if (i === idx) p.classList.remove('hidden');
      else p.classList.add('hidden');
    });

    secTabs.forEach((tab, i) => {
      if (i === idx) {
        tab.className = 'sec-tab-btn pb-2.5 border-b-2 transition-all border-[#0F766E] text-[#0F766E]';
      } else {
        tab.className = 'sec-tab-btn pb-2.5 border-b-2 transition-all border-transparent text-slate-500 hover:text-slate-800';
      }
    });

    if (idx === 0) prevSecBtn.classList.add('hidden');
    else prevSecBtn.classList.remove('hidden');

    if (idx === 2) nextSecBtn.classList.add('hidden');
    else nextSecBtn.classList.remove('hidden');
  };

  secTabs.forEach(btn => {
    btn.addEventListener('click', () => showSection(Number(btn.getAttribute('data-sec'))));
  });

  prevSecBtn.addEventListener('click', () => {
    if (currentSection > 0) showSection(currentSection - 1);
  });
  nextSecBtn.addEventListener('click', () => {
    if (currentSection < 2) showSection(currentSection + 1);
  });

  // Occasion selector toggle for 'Other'
  const occasionSelect = document.getElementById('tmpl-occasion-select');
  const otherOccasionContainer = document.getElementById('tmpl-other-occasion-container');
  occasionSelect.addEventListener('change', () => {
    if (occasionSelect.value === 'Other') {
      otherOccasionContainer.classList.remove('hidden');
    } else {
      otherOccasionContainer.classList.add('hidden');
    }
  });

  // Offer % live calculation
  const priceInput = document.getElementById('tmpl-price');
  const offerPctInput = document.getElementById('tmpl-offer-pct');
  const calcBox = document.getElementById('calculated-offer-preview');
  const calcVal = document.getElementById('calc-offer-val');

  const updateOfferCalc = () => {
    const base = Number(priceInput.value || 0);
    const pct = Number(offerPctInput.value || 0);
    if (base > 0 && pct > 0) {
      const discounted = base - (base * pct / 100);
      calcVal.textContent = `৳${discounted.toFixed(0)} (${pct}% OFF from ৳${base})`;
      calcBox.classList.remove('hidden');
    } else {
      calcBox.classList.add('hidden');
    }
  };
  priceInput.addEventListener('input', updateOfferCalc);
  offerPctInput.addEventListener('input', updateOfferCalc);
  updateOfferCalc();

  // Badges chips toggle
  modalContainer.querySelectorAll('.badge-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const b = chip.getAttribute('data-badge');
      if (selectedBadges.includes(b)) {
        selectedBadges = selectedBadges.filter(x => x !== b);
        chip.className = 'badge-chip px-3 py-1 rounded-full text-xs font-bold transition-all border bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200';
      } else {
        selectedBadges.push(b);
        chip.className = 'badge-chip px-3 py-1 rounded-full text-xs font-bold transition-all border bg-teal-600 text-white border-teal-600';
      }
    });
  });

  // Page Tiers Renderer
  const tiersContainer = document.getElementById('page-tiers-list-container');
  const renderTiers = () => {
    if (pageTiers.length === 0) {
      tiersContainer.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">No page tiers configured. Click "+ Add Page Tier".</div>';
      return;
    }

    tiersContainer.innerHTML = pageTiers.map((tier, idx) => `
      <div class="p-3 flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border border-slate-200/60 my-1">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 font-bold flex items-center justify-center text-xs">
            ${tier.pages}p
          </div>
          <div>
            <div class="text-xs font-bold text-slate-800">${tier.pages} Pages Edition</div>
            <div class="text-[11px] text-slate-400">Photos: ${tier.minPhotos || tier.pages * 2} – ${tier.maxPhotos || tier.pages * 3} photos</div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-slate-400 font-medium">Price:</span>
            <input type="number" value="${tier.price}" data-tier-idx="${idx}" data-field="price" class="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 font-bold text-slate-800">
          </div>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-slate-400 font-medium">Min:</span>
            <input type="number" value="${tier.minPhotos || tier.pages * 2}" data-tier-idx="${idx}" data-field="minPhotos" class="w-14 px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600">
          </div>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-slate-400 font-medium">Max:</span>
            <input type="number" value="${tier.maxPhotos || tier.pages * 3}" data-tier-idx="${idx}" data-field="maxPhotos" class="w-14 px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600">
          </div>

          <button type="button" data-remove-tier="${idx}" class="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors" title="Delete Tier">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `).join('');

    tiersContainer.querySelectorAll('input[data-tier-idx]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-tier-idx'));
        const field = e.target.getAttribute('data-field');
        pageTiers[idx][field] = Number(e.target.value);
      });
    });

    tiersContainer.querySelectorAll('button[data-remove-tier]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove-tier'));
        pageTiers.splice(idx, 1);
        renderTiers();
      });
    });
  };

  document.getElementById('add-page-tier-btn').addEventListener('click', () => {
    const lastTier = pageTiers[pageTiers.length - 1];
    const newPages = lastTier ? lastTier.pages + 4 : 8;
    const newPrice = lastTier ? lastTier.price + 400 : 950;
    pageTiers.push({
      pages: newPages,
      label: `${newPages} Pages`,
      price: newPrice,
      minPhotos: newPages * 2,
      maxPhotos: newPages * 3
    });
    renderTiers();
  });
  renderTiers();

  // Cover Image Direct File Upload & URL sync
  const coverUrlInput = document.getElementById('tmpl-cover-url');
  const coverPreview = document.getElementById('cover-preview-img');
  const coverFileInput = document.getElementById('cover-file-input');
  const coverUploadStatus = document.getElementById('cover-upload-status');

  coverUrlInput.addEventListener('input', () => {
    coverPreview.src = coverUrlInput.value.trim() || '/assets/product_placeholder.png';
  });

  coverFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    coverUploadStatus.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-teal-600"></i> Uploading to Cloudinary...';
    try {
      const uploadedUrl = await adminApi.uploadImageToCloudinary(file, 'templates');
      coverUrlInput.value = uploadedUrl;
      coverPreview.src = uploadedUrl;
      coverUploadStatus.innerHTML = '<span class="text-emerald-600 font-bold">✓ Uploaded!</span>';
      adminState.showToast('success', 'Cover photo uploaded successfully!');
    } catch (err) {
      coverUploadStatus.innerHTML = `<span class="text-rose-500 font-bold">Upload failed: ${err.message}</span>`;
      adminState.showToast('error', 'Upload failed: ' + err.message);
    }
  });

  // Showcase Gallery Images Renderer
  const galleryGrid = document.getElementById('gallery-thumbnails-grid');
  const galleryFileInput = document.getElementById('gallery-file-input');

  const renderGallery = () => {
    if (showcaseImages.length === 0) {
      galleryGrid.innerHTML = '<div class="col-span-full py-6 text-center text-xs text-slate-400">No showcase gallery images added yet. Click "Upload Photos".</div>';
      return;
    }

    galleryGrid.innerHTML = showcaseImages.map((url, idx) => `
      <div class="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white group shadow-xs">
        <img src="${url}" class="w-full h-full object-cover">
        <button type="button" data-del-img="${idx}" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600">
          <i class="fa-solid fa-xmark text-[10px]"></i>
        </button>
      </div>
    `).join('');

    galleryGrid.querySelectorAll('button[data-del-img]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-del-img'));
        showcaseImages.splice(idx, 1);
        renderGallery();
      });
    });
  };

  galleryFileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    adminState.showToast('info', `Uploading ${files.length} gallery photos...`);
    for (const file of files) {
      try {
        const url = await adminApi.uploadImageToCloudinary(file, 'templates/gallery');
        showcaseImages.push(url);
      } catch (err) {
        console.warn('Gallery upload failed for a file:', err);
      }
    }
    renderGallery();
    adminState.showToast('success', 'Gallery photos uploaded!');
  });
  renderGallery();

  // Form Submit Handler
  const form = document.getElementById('template-editor-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-template-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Saving...';

    const basePrice = Number(document.getElementById('tmpl-price').value || 550);
    const offerPct = Number(document.getElementById('tmpl-offer-pct').value || 0);
    const hasOffer = offerPct > 0;
    const calculatedOfferPrice = hasOffer ? (basePrice - (basePrice * offerPct / 100)) : basePrice;

    const finalOccasion = occasionSelect.value === 'Other'
      ? (document.getElementById('tmpl-other-occasion-input').value.trim() || 'Other')
      : occasionSelect.value;

    const customBadge = document.getElementById('tmpl-custom-badge').value.trim();
    if (customBadge && !selectedBadges.includes(customBadge)) {
      selectedBadges.push(customBadge);
    }

    const pagePricesMap = {};
    pageTiers.forEach(t => {
      pagePricesMap[String(t.pages)] = t.price;
    });

    const payload = {
      title: document.getElementById('tmpl-title').value.trim(),
      name: document.getElementById('tmpl-title').value.trim(),
      subtitle: document.getElementById('tmpl-subtitle').value.trim(),
      description: document.getElementById('tmpl-desc').value.trim(),
      category: finalOccasion,
      occasion: finalOccasion,
      collection: finalOccasion,
      target_audience: finalOccasion,
      badge: hasOffer ? `${offerPct.toFixed(0)}% OFF` : (selectedBadges[0] || ''),
      badges: selectedBadges,
      offer_badge: selectedBadges.join(', '),
      
      // Pricing
      price: basePrice,
      customPrice: basePrice,
      originalPrice: basePrice,
      offerPercentage: hasOffer ? offerPct : 0,
      hasOffer: hasOffer,
      offerPrice: hasOffer ? calculatedOfferPrice : 0,
      digitalPrice: Number(document.getElementById('tmpl-digital-price').value || 0),
      templateSalePrice: Number(document.getElementById('tmpl-digital-price').value || 0),
      
      // Page Tiers & limits
      pageTiers: pageTiers,
      pagePrices: pagePricesMap,
      pageCount: Number(document.getElementById('tmpl-page-count').value || 8),
      orientation: document.getElementById('tmpl-orientation').value,
      dimensions: document.getElementById('tmpl-dimensions').value.trim(),

      // Flags
      isTemplateForSale: document.getElementById('tmpl-sale-toggle').checked,
      isFeatured: document.getElementById('tmpl-featured-toggle').checked,
      isActive: document.getElementById('tmpl-active-toggle').checked,
      productType: 'magazine',

      // Links & Media
      canvaUrl: document.getElementById('tmpl-canva-link').value.trim(),
      canva_link: document.getElementById('tmpl-canva-link').value.trim(),
      imageUrl: coverUrlInput.value.trim(),
      coverUrl: coverUrlInput.value.trim(),
      showcaseImages: showcaseImages,
      galleryImages: showcaseImages
    };

    try {
      await adminApi.saveCatalogItem('templates', existingItem?.id, payload);
      adminState.showToast('success', 'Magazine template saved successfully!');
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Failed to save template: ' + err.message);
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check text-xs"></i> Save Template';
    }
  });
}

/**
 * 2. POSTER PACK EDITOR (Matching Flutter poster_editor_dialog.dart)
 */
function openPosterEditorModal(existingItem) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const isEdit = Boolean(existingItem);
  const data = existingItem || {};
  const combo = data.comboPrices || {};
  let showcaseImages = Array.isArray(data.showcaseImages || data.galleryImages) ? [...(data.showcaseImages || data.galleryImages)] : [];

  const modalHtml = `
    <div id="poster-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div class="admin-modal-card w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-image text-base"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">${isEdit ? 'Edit' : 'Add'} Poster Pack</h3>
              <p class="text-xs text-slate-500">Configure combo pack pricing, paper specs & design gallery</p>
            </div>
          </div>
          <button id="close-poster-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="poster-editor-form" class="p-6 overflow-y-auto space-y-4 admin-custom-scroll">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Title *</label>
            <input type="text" id="poster-title" required value="${data.title || data.name || ''}" placeholder="e.g. Vintage Anime Poster Combo" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
          </div>

          <!-- Specs -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Paper Type</label>
              <input type="text" id="poster-paper" value="${data.specs?.paper_type || data.paperType || '300 GSM Matte'}" placeholder="300 GSM Matte" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Dimensions / Size</label>
              <input type="text" id="poster-size" value="${data.specs?.size || data.size || '6x8 Inch (Wallboard)'}" placeholder="6x8 Inch (Wallboard)" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
          </div>

          <!-- Combo Pack Pricing (Matching Flutter) -->
          <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">Combo Pack Tier Pricing (BDT)</label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <span class="text-[11px] font-semibold text-slate-500 block mb-1">5 Pcs Pack</span>
                <input type="number" id="poster-p5" value="${combo['5'] || data.price || 500}" class="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg">
              </div>
              <div>
                <span class="text-[11px] font-semibold text-slate-500 block mb-1">10 Pcs Pack</span>
                <input type="number" id="poster-p10" value="${combo['10'] || 900}" class="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg">
              </div>
              <div>
                <span class="text-[11px] font-semibold text-slate-500 block mb-1">15 Pcs Pack</span>
                <input type="number" id="poster-p15" value="${combo['15'] || 1300}" class="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg">
              </div>
              <div>
                <span class="text-[11px] font-semibold text-slate-500 block mb-1">20 Pcs Pack</span>
                <input type="number" id="poster-p20" value="${combo['20'] || 1600}" class="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg">
              </div>
            </div>
          </div>

          <!-- Cover Image Upload -->
          <div class="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
            <label class="block text-xs font-bold text-slate-700 uppercase">Cover Image *</label>
            <div class="flex items-center gap-3">
              <img id="poster-preview-img" src="${data.imageUrl || '/assets/product_placeholder.png'}" class="w-16 h-16 rounded-lg object-cover border border-slate-200">
              <input type="text" id="poster-img-url" value="${data.imageUrl || ''}" placeholder="Image URL" class="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600 bg-white">
              <label class="px-3 py-2 bg-white border border-slate-300 hover:border-teal-600 text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                Upload
                <input type="file" id="poster-file-input" accept="image/*" class="hidden">
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Description</label>
            <textarea id="poster-desc" rows="2" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">${data.description || ''}</textarea>
          </div>

          <div class="flex items-center gap-4 pt-2">
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" id="poster-featured" class="w-4 h-4 rounded text-teal-600" ${data.isFeatured ? 'checked' : ''}>
              <span>Featured Showcase</span>
            </label>
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" id="poster-active" class="w-4 h-4 rounded text-teal-600" ${data.isActive !== false ? 'checked' : ''}>
              <span>Active / Visible</span>
            </label>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-poster-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" id="save-poster-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-xl transition-colors">Save Poster</button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('poster-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-poster-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-poster-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const imgInput = document.getElementById('poster-img-url');
  const preview = document.getElementById('poster-preview-img');
  const fileInput = document.getElementById('poster-file-input');

  imgInput.addEventListener('input', () => { preview.src = imgInput.value.trim() || '/assets/product_placeholder.png'; });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await adminApi.uploadImageToCloudinary(file, 'posters');
      imgInput.value = url;
      preview.src = url;
      adminState.showToast('success', 'Poster image uploaded!');
    } catch (err) {
      adminState.showToast('error', 'Upload failed: ' + err.message);
    }
  });

  const form = document.getElementById('poster-editor-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-poster-btn');
    saveBtn.disabled = true;

    const p5 = Number(document.getElementById('poster-p5').value || 500);
    const p10 = Number(document.getElementById('poster-p10').value || 900);
    const p15 = Number(document.getElementById('poster-p15').value || 1300);
    const p20 = Number(document.getElementById('poster-p20').value || 1600);

    const payload = {
      title: document.getElementById('poster-title').value.trim(),
      name: document.getElementById('poster-title').value.trim(),
      description: document.getElementById('poster-desc').value.trim(),
      imageUrl: imgInput.value.trim(),
      catalog_preview_url: imgInput.value.trim(),
      price: p5,
      comboPrices: { '5': p5, '10': p10, '15': p15, '20': p20 },
      specs: {
        paper_type: document.getElementById('poster-paper').value.trim(),
        size: document.getElementById('poster-size').value.trim()
      },
      isFeatured: document.getElementById('poster-featured').checked,
      isActive: document.getElementById('poster-active').checked,
      productType: 'poster'
    };

    try {
      await adminApi.saveCatalogItem('catalog_posters', existingItem?.id, payload);
      adminState.showToast('success', 'Poster pack saved!');
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Save error: ' + err.message);
      saveBtn.disabled = false;
    }
  });
}

/**
 * 3. WALL FRAME EDITOR (Matching Flutter frame_editor_dialog.dart)
 */
function openFrameEditorModal(existingItem) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const isEdit = Boolean(existingItem);
  const data = existingItem || {};

  const modalHtml = `
    <div id="frame-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div class="admin-modal-card w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-crop-simple text-base"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">${isEdit ? 'Edit' : 'Add'} Wall Frame</h3>
              <p class="text-xs text-slate-500">Configure frame material, size, color and pricing</p>
            </div>
          </div>
          <button id="close-frame-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="frame-editor-form" class="p-6 overflow-y-auto space-y-4 admin-custom-scroll">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Title / Name *</label>
            <input type="text" id="frame-title" required value="${data.title || data.name || ''}" placeholder="e.g. Minimalist Black Wall Frame" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Price (BDT) *</label>
              <input type="number" id="frame-price" required value="${data.price || ''}" placeholder="e.g. 850" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Material</label>
              <input type="text" id="frame-material" value="${data.specs?.material || data.material || 'Teak Wood'}" placeholder="Teak Wood" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Dimensions / Size</label>
              <input type="text" id="frame-size" value="${data.specs?.size || data.size || '12x18 inch (A3)'}" placeholder="12x18 inch (A3)" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Color / Finish</label>
              <input type="text" id="frame-color" value="${data.specs?.color || data.color || 'Matte Black'}" placeholder="Matte Black" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
          </div>

          <!-- Cover Image Upload -->
          <div class="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
            <label class="block text-xs font-bold text-slate-700 uppercase">Frame Image *</label>
            <div class="flex items-center gap-3">
              <img id="frame-preview-img" src="${data.imageUrl || '/assets/product_placeholder.png'}" class="w-16 h-16 rounded-lg object-cover border border-slate-200">
              <input type="text" id="frame-img-url" value="${data.imageUrl || ''}" placeholder="Image URL" class="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600 bg-white">
              <label class="px-3 py-2 bg-white border border-slate-300 hover:border-teal-600 text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                Upload
                <input type="file" id="frame-file-input" accept="image/*" class="hidden">
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Description</label>
            <textarea id="frame-desc" rows="2" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">${data.description || ''}</textarea>
          </div>

          <div class="flex items-center gap-4 pt-2">
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" id="frame-featured" class="w-4 h-4 rounded text-teal-600" ${data.isFeatured ? 'checked' : ''}>
              <span>Featured</span>
            </label>
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" id="frame-active" class="w-4 h-4 rounded text-teal-600" ${data.isActive !== false ? 'checked' : ''}>
              <span>Active / Visible</span>
            </label>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-frame-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" id="save-frame-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-xl transition-colors">Save Frame</button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('frame-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-frame-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-frame-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const imgInput = document.getElementById('frame-img-url');
  const preview = document.getElementById('frame-preview-img');
  const fileInput = document.getElementById('frame-file-input');

  imgInput.addEventListener('input', () => { preview.src = imgInput.value.trim() || '/assets/product_placeholder.png'; });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await adminApi.uploadImageToCloudinary(file, 'frames');
      imgInput.value = url;
      preview.src = url;
      adminState.showToast('success', 'Frame image uploaded!');
    } catch (err) {
      adminState.showToast('error', 'Upload failed: ' + err.message);
    }
  });

  const form = document.getElementById('frame-editor-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-frame-btn');
    saveBtn.disabled = true;

    const payload = {
      title: document.getElementById('frame-title').value.trim(),
      name: document.getElementById('frame-title').value.trim(),
      description: document.getElementById('frame-desc').value.trim(),
      price: Number(document.getElementById('frame-price').value || 0),
      imageUrl: imgInput.value.trim(),
      catalog_preview_url: imgInput.value.trim(),
      specs: {
        material: document.getElementById('frame-material').value.trim(),
        size: document.getElementById('frame-size').value.trim(),
        color: document.getElementById('frame-color').value.trim()
      },
      isFeatured: document.getElementById('frame-featured').checked,
      isActive: document.getElementById('frame-active').checked,
      productType: 'frame'
    };

    try {
      await adminApi.saveCatalogItem('catalog_frames', existingItem?.id, payload);
      adminState.showToast('success', 'Wall frame saved successfully!');
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Save error: ' + err.message);
      saveBtn.disabled = false;
    }
  });
}

/**
 * 4. STICKER PACK EDITOR (Matching Flutter sticker_editor_dialog.dart)
 */
function openStickerEditorModal(existingItem) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const isEdit = Boolean(existingItem);
  const data = existingItem || {};

  const modalHtml = `
    <div id="sticker-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div class="admin-modal-card w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
              <i class="fa-solid fa-note-sticky text-base"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">${isEdit ? 'Edit' : 'Add'} Sticker Pack</h3>
              <p class="text-xs text-slate-500">Configure sticker pack material, finish, and pricing</p>
            </div>
          </div>
          <button id="close-sticker-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="sticker-editor-form" class="p-6 overflow-y-auto space-y-4 admin-custom-scroll">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Title / Name *</label>
            <input type="text" id="sticker-title" required value="${data.title || data.name || ''}" placeholder="e.g. Aesthetic Laptop Stickers Pack" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Price (BDT) *</label>
              <input type="number" id="sticker-price" required value="${data.price || ''}" placeholder="e.g. 290" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Pack Quantity</label>
              <input type="text" id="sticker-qty" value="${data.specs?.pack_quantity || data.packQuantity || '10 Stickers'}" placeholder="10 Stickers" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Material</label>
              <input type="text" id="sticker-material" value="${data.specs?.material || data.material || 'Vinyl Waterproof'}" placeholder="Vinyl Waterproof" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Finish Type</label>
              <input type="text" id="sticker-finish" value="${data.specs?.finish || data.finish || 'Glossy Die-Cut'}" placeholder="Glossy Die-Cut" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
          </div>

          <!-- Cover Image Upload -->
          <div class="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50/50">
            <label class="block text-xs font-bold text-slate-700 uppercase">Sticker Image *</label>
            <div class="flex items-center gap-3">
              <img id="sticker-preview-img" src="${data.imageUrl || '/assets/product_placeholder.png'}" class="w-16 h-16 rounded-lg object-cover border border-slate-200">
              <input type="text" id="sticker-img-url" value="${data.imageUrl || ''}" placeholder="Image URL" class="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600 bg-white">
              <label class="px-3 py-2 bg-white border border-slate-300 hover:border-teal-600 text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                Upload
                <input type="file" id="sticker-file-input" accept="image/*" class="hidden">
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1 uppercase">Description</label>
            <textarea id="sticker-desc" rows="2" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">${data.description || ''}</textarea>
          </div>

          <div class="flex items-center gap-4 pt-2">
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" id="sticker-featured" class="w-4 h-4 rounded text-teal-600" ${data.isFeatured ? 'checked' : ''}>
              <span>Featured</span>
            </label>
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" id="sticker-active" class="w-4 h-4 rounded text-teal-600" ${data.isActive !== false ? 'checked' : ''}>
              <span>Active / Visible</span>
            </label>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-sticker-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" id="save-sticker-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-xl transition-colors">Save Stickers</button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('sticker-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-sticker-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-sticker-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const imgInput = document.getElementById('sticker-img-url');
  const preview = document.getElementById('sticker-preview-img');
  const fileInput = document.getElementById('sticker-file-input');

  imgInput.addEventListener('input', () => { preview.src = imgInput.value.trim() || '/assets/product_placeholder.png'; });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await adminApi.uploadImageToCloudinary(file, 'stickers');
      imgInput.value = url;
      preview.src = url;
      adminState.showToast('success', 'Sticker image uploaded!');
    } catch (err) {
      adminState.showToast('error', 'Upload failed: ' + err.message);
    }
  });

  const form = document.getElementById('sticker-editor-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-sticker-btn');
    saveBtn.disabled = true;

    const payload = {
      title: document.getElementById('sticker-title').value.trim(),
      name: document.getElementById('sticker-title').value.trim(),
      description: document.getElementById('sticker-desc').value.trim(),
      price: Number(document.getElementById('sticker-price').value || 0),
      imageUrl: imgInput.value.trim(),
      catalog_preview_url: imgInput.value.trim(),
      specs: {
        material: document.getElementById('sticker-material').value.trim(),
        pack_quantity: document.getElementById('sticker-qty').value.trim(),
        finish: document.getElementById('sticker-finish').value.trim()
      },
      isFeatured: document.getElementById('sticker-featured').checked,
      isActive: document.getElementById('sticker-active').checked,
      productType: 'sticker'
    };

    try {
      await adminApi.saveCatalogItem('catalog_stickers', existingItem?.id, payload);
      adminState.showToast('success', 'Sticker pack saved successfully!');
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Save error: ' + err.message);
      saveBtn.disabled = false;
    }
  });
}
