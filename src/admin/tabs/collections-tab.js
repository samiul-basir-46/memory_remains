import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

export function renderCollectionsTab(container) {
  let collectionsList = [];

  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="p-5 border-b border-slate-200/80 bg-white flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Collections Management</h3>
          <p class="text-xs text-slate-500">Curate curated store collections and themes</p>
        </div>
        <button id="add-collection-btn" class="px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
          <i class="fa-solid fa-plus text-xs"></i> Add Collection
        </button>
      </div>

      <div id="collections-grid-content" class="flex-1 overflow-y-auto p-5 admin-custom-scroll bg-[#F8FAFC]">
        <div class="flex items-center justify-center py-16 text-slate-400 text-xs">
          <i class="fa-solid fa-spinner animate-spin text-lg mr-2 text-sky-600"></i> Loading collections...
        </div>
      </div>
    </div>
  `;

  const gridContainer = container.querySelector('#collections-grid-content');
  const addBtn = container.querySelector('#add-collection-btn');

  const renderGrid = () => {
    if (collectionsList.length === 0) {
      gridContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 text-2xl mb-3">
            <i class="fa-solid fa-layer-group"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-700 mb-1">No Collections Yet</h4>
          <p class="text-xs text-slate-400 max-w-xs mb-4">Click "Add Collection" to create your first themed collection.</p>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        ${collectionsList.map(col => {
          const imgUrl = col.coverUrl || col.imageUrl || '/assets/scrapbook_collage_bundle.png';
          return `
            <div class="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between group">
              <div class="aspect-16/9 bg-slate-100 relative overflow-hidden">
                <img src="${imgUrl}" alt="${col.name || 'Collection'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='/assets/scrapbook_collage_bundle.png'">
              </div>

              <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 class="text-sm font-bold text-slate-900 line-clamp-1">${col.name || col.title || 'Untitled'}</h4>
                  <p class="text-[11px] text-slate-400 font-mono mt-0.5">${col.slug || col.id}</p>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button data-action="edit" data-id="${col.id}" class="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1">
                    <i class="fa-solid fa-pen text-[10px]"></i> Edit
                  </button>
                  <button data-action="delete" data-id="${col.id}" class="text-xs font-semibold text-rose-500 hover:text-rose-700 flex items-center gap-1">
                    <i class="fa-solid fa-trash text-[10px]"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    gridContainer.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const col = collectionsList.find(c => c.id === id);

        if (action === 'edit' && col) {
          openCollectionEditor(col);
        } else if (action === 'delete') {
          if (!confirm(`Delete collection "${col?.name || id}"?`)) return;
          try {
            await adminApi.deleteCollection(id);
            adminState.showToast('success', 'Collection deleted');
          } catch (err) {
            adminState.showToast('error', 'Failed to delete: ' + err.message);
          }
        }
      });
    });
  };

  const unsub = adminApi.watchCollections(list => {
    collectionsList = list;
    renderGrid();
  });
  adminState.addSubscription(unsub);

  addBtn.addEventListener('click', () => openCollectionEditor(null));
}

function openCollectionEditor(existingCol) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const isEdit = Boolean(existingCol);
  const data = existingCol || {};

  const modalHtml = `
    <div id="col-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 class="text-sm font-bold text-slate-900">${isEdit ? 'Edit Collection' : 'New Collection'}</h3>
          <button id="close-col-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="col-form" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 uppercase">Collection Title *</label>
            <input type="text" id="col-name-input" required value="${data.name || data.title || ''}" placeholder="e.g. Vintage Memories" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 uppercase">Slug</label>
            <input type="text" id="col-slug-input" value="${data.slug || ''}" placeholder="e.g. vintage-memories" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 uppercase">Cover Image URL</label>
            <input type="text" id="col-img-input" value="${data.coverUrl || data.imageUrl || ''}" placeholder="https://res.cloudinary.com/..." class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600">
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-col-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" id="save-col-modal-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-xl flex items-center gap-1.5">
              <i class="fa-solid fa-check text-xs"></i> Save Collection
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('col-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-col-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-col-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const form = document.getElementById('col-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-col-modal-btn');
    saveBtn.disabled = true;

    const name = document.getElementById('col-name-input').value.trim();
    let slug = document.getElementById('col-slug-input').value.trim();
    if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const coverUrl = document.getElementById('col-img-input').value.trim();

    try {
      await adminApi.saveCollection(existingCol?.id, { name, title: name, slug, coverUrl });
      adminState.showToast('success', 'Collection saved successfully!');
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Failed to save collection: ' + err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });
}
