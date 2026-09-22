import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

export async function openAnnouncementDialog() {
  const modalContainer = document.getElementById('admin-modals');
  if (!modalContainer) return;

  let currentSettings = { announcement: '', announcementEnabled: false, announcementLink: '' };
  try {
    currentSettings = await adminApi.getStoreSettings();
  } catch (err) {
    console.warn('Failed to load current announcement settings:', err);
  }

  const modalHtml = `
    <div id="announcement-modal-backdrop" class="admin-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="admin-modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <i class="fa-solid fa-bullhorn text-sm"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Announcement Bar</h3>
              <p class="text-xs text-slate-500 font-medium">Edit top store alert banner</p>
            </div>
          </div>
          <button id="close-announcement-modal-btn" class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Form Body -->
        <form id="announcement-form" class="p-6 space-y-4">
          
          <!-- Toggle Active -->
          <div class="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div class="text-xs font-bold text-slate-800">Banner Visibility</div>
              <div class="text-[11px] text-slate-500">Show or hide on web storefront</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="announcement-enabled-input" class="sr-only peer" ${currentSettings.announcementEnabled ? 'checked' : ''}>
              <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0F766E]"></div>
            </label>
          </div>

          <!-- Announcement Message -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Banner Text</label>
            <textarea 
              id="announcement-text-input" 
              rows="3" 
              required
              placeholder="e.g. Free shipping on all orders over ৳1500 this week!" 
              class="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all placeholder:text-slate-400"
            >${currentSettings.announcement || ''}</textarea>
          </div>

          <!-- Target Link -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Link URL (Optional)</label>
            <input 
              type="text" 
              id="announcement-link-input" 
              placeholder="e.g. /pages/featured/ or https://..." 
              value="${currentSettings.announcementLink || ''}"
              class="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all placeholder:text-slate-400"
            >
          </div>

          <!-- Actions -->
          <div class="pt-2 flex items-center justify-end gap-2">
            <button 
              type="button" 
              id="cancel-announcement-btn" 
              class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              id="save-announcement-btn" 
              class="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D9488] active:bg-[#115E59] rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <i class="fa-solid fa-floppy-disk text-xs"></i> Save Changes
            </button>
          </div>

        </form>

      </div>
    </div>
  `;

  modalContainer.innerHTML = modalHtml;
  const backdrop = document.getElementById('announcement-modal-backdrop');

  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const closeModal = () => {
    backdrop.classList.remove('is-open');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  document.getElementById('close-announcement-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-announcement-btn').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  const form = document.getElementById('announcement-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-announcement-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Saving...';

    const enabled = document.getElementById('announcement-enabled-input').checked;
    const text = document.getElementById('announcement-text-input').value.trim();
    const link = document.getElementById('announcement-link-input').value.trim();

    try {
      await adminApi.saveStoreSettings({
        announcement: text,
        announcementEnabled: enabled,
        announcementLink: link
      });
      adminState.showToast('success', 'Announcement banner updated successfully!');
      closeModal();
    } catch (err) {
      adminState.showToast('error', 'Failed to save settings: ' + err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });
}
