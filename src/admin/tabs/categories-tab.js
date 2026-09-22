import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

export function renderCategoriesTab(container) {
  let categoriesList = [];

  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="p-5 border-b border-slate-200/80 bg-white flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Categories Management</h3>
          <p class="text-xs text-slate-500">Organize store categories and navigation badges</p>
        </div>
        <button id="add-category-btn" class="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
          <i class="fa-solid fa-plus text-xs"></i> Add Category
        </button>
      </div>

      <div id="categories-grid-content" class="flex-1 overflow-y-auto p-5 admin-custom-scroll bg-[#F8FAFC]">
        <div class="flex items-center justify-center py-16 text-slate-400 text-xs">
          <i class="fa-solid fa-spinner animate-spin text-lg mr-2 text-purple-600"></i> Loading categories...
        </div>
      </div>
    </div>
  `;

  const gridContainer = container.querySelector('#categories-grid-content');
  const addBtn = container.querySelector('#add-category-btn');

  const renderGrid = () => {
    if (categoriesList.length === 0) {
      gridContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 text-2xl mb-3">
            <i class="fa-solid fa-tags"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-700 mb-1">No Categories Yet</h4>
          <p class="text-xs text-slate-400 max-w-xs mb-4">Click "Add Category" to create your first category.</p>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        ${categoriesList.map(cat => `
          <div class="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold flex-shrink-0">
                <i class="fa-solid fa-tag text-sm"></i>
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="text-sm font-bold text-slate-900 truncate">${cat.name || 'Untitled'}</h4>
                <p class="text-[11px] text-slate-400 font-mono mt-0.5">${cat.slug || cat.id}</p>
                <div class="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                  <span class="bg-slate-100 px-2 py-0.5 rounded font-medium">Order: ${cat.order ?? 0}</span>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button data-action="edit" data-id="${cat.id}" class="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1">
                <i class="fa-solid fa-pen text-[10px]"></i> Edit
              </button>
              <button data-action="delete" data-id="${cat.id}" class="text-xs font-semibold text-rose-500 hover:text-rose-700 flex items-center gap-1">
                <i class="fa-solid fa-trash text-[10px]"></i> Delete
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    gridContainer.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const cat = categoriesList.find(c => c.id === id);

        if (action === 'edit' && cat) {
          openCategoryEditor(cat);
        } else if (action === 'delete') {
          if (!confirm(`Delete category "${cat?.name || id}"?`)) return;
          try {
            await adminApi.deleteCategory(id);
            adminState.showToast('success', 'Category deleted');
          } catch (err) {
            adminState.showToast('error', 'Failed to delete: ' + err.message);
          }
        }
      });
    });
  };

  const unsub = adminApi.watchCategories(list => {
    categoriesList = list;
    renderGrid();
  });
  adminState.addSubscription(unsub);

  addBtn.addEventListener('click', () => openCategoryEditor(null));
}

function openCategoryEditor(existingCat) {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  const isEdit = Boolean(existingCat);
  const data = existingCat || {};

  const modalHtml = `
    <div id="cat-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 class="text-sm font-bold text-slate-900">${isEdit ? 'Edit Category' : 'New Category'}</h3>
          <button id="close-cat-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="cat-form" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 uppercase">Category Name *</label>
            <input type="text" id="category-name-input" required value="${data.name || ''}" placeholder="e.g. Birthday Editions" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-purple-600">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 uppercase">Slug (Identifier)</label>
            <input type="text" id="category-slug-input" value="${data.slug || ''}" placeholder="e.g. birthday-editions" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-purple-600">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1 uppercase">Display Order (Sort)</label>
            <input type="number" id="category-order-input" value="${data.order ?? 0}" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-purple-600">
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" id="cancel-cat-modal-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" id="save-cat-modal-btn" class="px-5 py-2 text-xs font-bold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-xl flex items-center gap-1.5">
              <i class="fa-solid fa-check text-xs"></i> Save Category
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('cat-modal-backdrop');
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-cat-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-cat-modal-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  const form = document.getElementById('cat-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-cat-modal-btn');
    saveBtn.disabled = true;

    const name = document.getElementById('category-name-input').value.trim();
    let slug = document.getElementById('category-slug-input').value.trim();
    if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const order = Number(document.getElementById('category-order-input').value || 0);

    try {
      await adminApi.saveCategory(existingCat?.id, { name, slug, order });
      adminState.showToast('success', 'Category saved successfully!');
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Failed to save category: ' + err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });
}
