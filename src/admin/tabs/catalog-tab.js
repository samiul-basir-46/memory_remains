import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

export function renderCatalogTab(container) {
  let currentSubTab = adminState.getState().catalogSubTab || 'templates';
  let itemsList = [];
  let searchQuery = '';

  const subTabConfigs = {
    templates: {
      collection: 'templates',
      title: 'Magazine Templates',
      icon: 'fa-solid fa-book-open',
      singular: 'Template',
      fields: ['title', 'price', 'category', 'requiredPhotos', 'coverUrl', 'description']
    },
    frames: {
      collection: 'catalog_frames',
      title: 'Wall Frames',
      icon: 'fa-solid fa-crop-simple',
      singular: 'Frame',
      fields: ['title', 'price', 'size', 'imageUrl', 'description']
    },
    posters: {
      collection: 'catalog_posters',
      title: 'Posters',
      icon: 'fa-solid fa-image',
      singular: 'Poster',
      fields: ['title', 'paperType', 'imageUrl', 'category']
    },
    stickers: {
      collection: 'catalog_stickers',
      title: 'Stickers',
      icon: 'fa-solid fa-note-sticky',
      singular: 'Sticker',
      fields: ['title', 'price', 'imageUrl', 'category']
    }
  };

  container.innerHTML = `
    <div class="flex flex-col h-full">
      
      <!-- Sub-tabs Header Bar -->
      <div class="px-5 py-4 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-4">
        
        <!-- Segmented Sub Tabs -->
        <div class="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl">
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
              class="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
            >
          </div>

          <button id="add-catalog-item-btn" class="px-4 py-2 bg-[#0F766E] hover:bg-[#0D9488] active:bg-[#115E59] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5">
            <i class="fa-solid fa-plus text-xs"></i> Add <span id="add-btn-type-label">Item</span>
          </button>
        </div>

      </div>

      <!-- Items Grid View -->
      <div id="catalog-items-grid" class="flex-1 overflow-y-auto p-5 admin-custom-scroll bg-[#F8FAFC]">
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

  let activeUnsub = null;

  const renderGrid = () => {
    let filtered = itemsList;
    if (searchQuery) {
      filtered = itemsList.filter(it => 
        (it.title && it.title.toLowerCase().includes(searchQuery)) ||
        (it.name && it.name.toLowerCase().includes(searchQuery)) ||
        (it.category && it.category.toLowerCase().includes(searchQuery)) ||
        (it.description && it.description.toLowerCase().includes(searchQuery))
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
          const imgUrl = item.coverUrl || item.imageUrl || item.previewUrl || '/assets/product_placeholder.png';
          const price = item.price ? `৳${item.price}` : (item.tiers ? `৳${item.tiers[0]?.price || 'N/A'}` : 'N/A');

          return `
            <div class="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-teal-500/50 transition-all duration-200 flex flex-col group">
              <!-- Item Image Cover -->
              <div class="relative aspect-4/3 bg-slate-100 overflow-hidden">
                <img src="${imgUrl}" alt="${title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='/assets/product_placeholder.png'">
                <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-sm text-slate-800 shadow-xs">
                    ${price}
                  </span>
                </div>
              </div>

              <!-- Item Content -->
              <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 class="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">${title}</h4>
                  <div class="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                    ${item.category ? `<span class="bg-slate-100 px-2 py-0.5 rounded font-medium">${item.category}</span>` : ''}
                    ${item.requiredPhotos ? `<span><i class="fa-solid fa-images text-slate-400 mr-0.5"></i> ${item.requiredPhotos} photos</span>` : ''}
                    ${item.size ? `<span><i class="fa-solid fa-expand text-slate-400 mr-0.5"></i> ${item.size}</span>` : ''}
                    ${item.paperType ? `<span>${item.paperType}</span>` : ''}
                  </div>
                  ${item.description ? `<p class="text-xs text-slate-400 mt-2 line-clamp-2">${item.description}</p>` : ''}
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
          openCatalogItemEditor(subTabConfigs[currentSubTab], item);
        } else if (action === 'delete') {
          if (!confirm(`Delete this item permanently?`)) return;
          try {
            await adminApi.deleteCatalogItem(subTabConfigs[currentSubTab].collection, itemId);
            adminState.showToast('success', 'Item deleted');
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
    openCatalogItemEditor(subTabConfigs[currentSubTab], null);
  });

  // Initial load
  switchSubTab(currentSubTab);
}

/**
 * Add / Edit Modal for Catalog Item
 */
function openCatalogItemEditor(config, existingItem) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const isEdit = Boolean(existingItem);
  const data = existingItem || {};

  const modalHtml = `
    <div id="catalog-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold">
              <i class="${config.icon} text-sm"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">${isEdit ? 'Edit' : 'Add'} ${config.singular}</h3>
              <p class="text-xs text-slate-500">${config.title}</p>
            </div>
          </div>
          <button id="close-catalog-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="catalog-item-form" class="p-6 overflow-y-auto space-y-4 admin-custom-scroll">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Title / Name *</label>
            <input type="text" id="cat-item-title" required value="${data.title || data.name || ''}" placeholder="e.g. Modern Magazine Template" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Price (BDT) *</label>
              <input type="number" id="cat-item-price" required value="${data.price || ''}" placeholder="e.g. 750" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Category</label>
              <input type="text" id="cat-item-category" value="${data.category || ''}" placeholder="e.g. Birthday, Anniversary" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Image / Cover URL</label>
            <input type="text" id="cat-item-img" value="${data.coverUrl || data.imageUrl || data.previewUrl || ''}" placeholder="https://res.cloudinary.com/..." class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
          </div>

          ${config.collection === 'templates' ? `
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Required Photos</label>
                <input type="number" id="cat-item-photos" value="${data.requiredPhotos || 12}" placeholder="12" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Canva Template Link</label>
                <input type="text" id="cat-item-canva" value="${data.canvaLink || ''}" placeholder="https://canva.com/..." class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">
              </div>
            </div>
          ` : ''}

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Description</label>
            <textarea id="cat-item-desc" rows="2" placeholder="Product details..." class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-600">${data.description || ''}</textarea>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-catalog-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" id="save-catalog-modal-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] rounded-xl transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-check text-xs"></i> Save ${config.singular}
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('catalog-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-catalog-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-catalog-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const form = document.getElementById('catalog-item-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-catalog-modal-btn');
    saveBtn.disabled = true;

    const payload = {
      title: document.getElementById('cat-item-title').value.trim(),
      price: Number(document.getElementById('cat-item-price').value.trim()),
      category: document.getElementById('cat-item-category').value.trim(),
      description: document.getElementById('cat-item-desc').value.trim(),
    };

    const imgVal = document.getElementById('cat-item-img').value.trim();
    if (config.collection === 'templates') {
      payload.coverUrl = imgVal;
      payload.requiredPhotos = Number(document.getElementById('cat-item-photos')?.value || 12);
      payload.canvaLink = document.getElementById('cat-item-canva')?.value.trim() || '';
    } else {
      payload.imageUrl = imgVal;
    }

    try {
      await adminApi.saveCatalogItem(config.collection, existingItem?.id, payload);
      adminState.showToast('success', `${config.singular} saved successfully!`);
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Failed to save item: ' + err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });
}
