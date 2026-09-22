import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';
import { openWebArchiveGalleryModal } from '../dialogs/web-archive-gallery-modal.js';

export function renderWebUploadsTab(container) {
  let uploadsList = [];
  let currentFilter = adminState.getState().webUploadsFilter || 'all';
  let selectedIds = new Set();
  let searchQuery = '';

  container.innerHTML = `
    <div class="flex flex-col h-full bg-[#F8FAFC]">
      
      <!-- Top Filter & Search Bar (Responsive Mobile & Desktop) -->
      <div class="p-3 sm:p-5 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        <!-- Filter Pills -->
        <div class="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button data-filter="all" class="web-filter-btn flex-1 sm:flex-none text-center px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentFilter === 'all' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            All
          </button>
          <button data-filter="pending" class="web-filter-btn flex-1 sm:flex-none text-center px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentFilter === 'pending' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <i class="fa-solid fa-cloud-arrow-down mr-1"></i> Pending
          </button>
          <button data-filter="downloaded" class="web-filter-btn flex-1 sm:flex-none text-center px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentFilter === 'downloaded' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <i class="fa-solid fa-check mr-1"></i> Downloaded
          </button>
        </div>

        <!-- Search & Batch Download -->
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <div class="relative flex-1 sm:w-80">
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
              type="text" 
              id="web-uploads-search-input" 
              placeholder="Search by name, filename, code..." 
              class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-600 focus:bg-white transition-all"
            >
          </div>

          <div id="web-bulk-toolbar" class="hidden flex items-center gap-2">
            <button id="batch-download-zip-btn" class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <i class="fa-solid fa-file-zipper text-xs"></i> Batch ZIP (<span id="batch-count-num">0</span>)
            </button>
          </div>
        </div>

      </div>

      <!-- Uploads List Content -->
      <div id="web-uploads-content" class="flex-1 overflow-y-auto p-3 sm:p-5 admin-custom-scroll">
        <div class="flex items-center justify-center py-16 text-slate-400 text-xs">
          <i class="fa-solid fa-spinner animate-spin text-lg mr-2 text-rose-600"></i> Loading web submissions...
        </div>
      </div>

    </div>
  `;

  const listContainer = container.querySelector('#web-uploads-content');
  const searchInput = container.querySelector('#web-uploads-search-input');
  const filterBtns = container.querySelectorAll('.web-filter-btn');
  const bulkToolbar = container.querySelector('#web-bulk-toolbar');
  const batchCountNum = container.querySelector('#batch-count-num');
  const batchDownloadBtn = container.querySelector('#batch-download-zip-btn');

  const updateBulkToolbar = () => {
    if (selectedIds.size > 0) {
      bulkToolbar.classList.remove('hidden');
      batchCountNum.textContent = selectedIds.size;
    } else {
      bulkToolbar.classList.add('hidden');
    }
  };

  const renderUploadCards = () => {
    let filtered = uploadsList;

    if (currentFilter === 'pending') {
      filtered = filtered.filter(u => !u.isDownloaded);
    } else if (currentFilter === 'downloaded') {
      filtered = filtered.filter(u => u.isDownloaded);
    }

    if (searchQuery) {
      filtered = filtered.filter(u =>
        (u.customerName && u.customerName.toLowerCase().includes(searchQuery)) ||
        (u.formattedName && u.formattedName.toLowerCase().includes(searchQuery)) ||
        (u.filename && u.filename.toLowerCase().includes(searchQuery)) ||
        (u.refCode && u.refCode.toLowerCase().includes(searchQuery)) ||
        (u.customerPhone && u.customerPhone.includes(searchQuery)) ||
        (u.orderId && u.orderId.toLowerCase().includes(searchQuery)) ||
        (u.productType && u.productType.toLowerCase().includes(searchQuery))
      );
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 text-2xl mb-3 shadow-xs">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-700 mb-1">No Customer Submissions</h4>
          <p class="text-xs text-slate-400 max-w-xs">No customer archives match the selected filter or search query.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = `
      <div class="grid grid-cols-1 gap-3 sm:gap-3.5">
        ${filtered.map(upload => {
          const isChecked = selectedIds.has(upload.id);
          const dateStr = upload.createdAt ? new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }).format(upload.createdAt) : '';

          const displayName = upload.formattedName || upload.customerName || 'Web Upload';
          const filename = upload.filename || `${displayName}.zip`;

          return `
            <div class="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-5 shadow-xs hover:border-rose-300 transition-all flex flex-col gap-3 group">
              
              <!-- Card Header Row: Checkbox + Customer Name + Status Badge -->
              <div class="flex items-center justify-between gap-2.5 min-w-0">
                <div class="flex items-center gap-2.5 min-w-0">
                  <input 
                    type="checkbox" 
                    data-upload-id="${upload.id}" 
                    class="upload-checkbox w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer flex-shrink-0"
                    ${isChecked ? 'checked' : ''}
                  >
                  <h4 
                    class="text-sm sm:text-base font-extrabold text-slate-900 hover:text-rose-600 transition-colors cursor-pointer truncate flex items-center gap-1.5" 
                    data-action="view-photos" 
                    data-upload-id="${upload.id}"
                    title="Click to view all photos"
                  >
                    <i class="fa-solid fa-user text-rose-500 text-xs flex-shrink-0"></i>
                    <span class="truncate">${displayName}</span>
                  </h4>
                </div>

                <!-- Status Badge -->
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                  upload.isDownloaded 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }">
                  ${upload.isDownloaded ? '<i class="fa-solid fa-check text-[9px] mr-1"></i> Downloaded' : '<i class="fa-solid fa-circle text-[6px] mr-1 text-rose-500 animate-ping"></i> Pending'}
                </span>
              </div>

              <!-- Metadata Line: ID, Date, Product Type, Filename & Phone -->
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                <span class="font-bold text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/70">
                  #${upload.refCode || upload.orderId}
                </span>
                <span class="text-slate-400">•</span>
                <span class="text-slate-500 flex items-center gap-1">
                  <i class="fa-regular fa-clock text-[10px] text-slate-400"></i> ${dateStr}
                </span>
                <span class="text-slate-400">•</span>
                <span class="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  ${upload.productType}
                </span>
                ${filename ? `
                  <span class="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 truncate max-w-[200px]" title="${filename}">
                    <i class="fa-regular fa-file-zipper text-[10px] mr-1 text-slate-400"></i>${filename}
                  </span>
                ` : ''}
                ${upload.customerPhone ? `
                  <span class="text-slate-400">•</span>
                  <a href="tel:${upload.customerPhone}" class="text-rose-700 font-semibold hover:underline flex items-center gap-1">
                    <i class="fa-solid fa-phone text-[9px]"></i> ${upload.customerPhone}
                  </a>
                ` : ''}
              </div>

              ${upload.itemDescription ? `
                <p class="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">${upload.itemDescription}</p>
              ` : ''}

              <!-- Thumbnails & Action Controls (Responsive Row) -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
                
                <!-- Thumbnails Strip + Clickable Photo Count Pill -->
                <div class="flex items-center gap-2">
                  <div class="flex -space-x-2.5 overflow-hidden py-0.5">
                    ${upload.imageUrls.slice(0, 4).map((url, i) => `
                      <img 
                        class="inline-block h-10 w-10 sm:h-11 sm:w-11 rounded-xl ring-2 ring-white object-cover shadow-2xs cursor-pointer hover:scale-110 hover:ring-rose-400 hover:z-10 transition-all" 
                        src="${url}" 
                        alt="Photo ${i + 1}" 
                        loading="lazy" 
                        data-action="view-photos" 
                        data-upload-id="${upload.id}"
                        title="Click to view photo"
                      >
                    `).join('')}
                  </div>
                  
                  <button 
                    data-action="view-photos" 
                    data-upload-id="${upload.id}" 
                    class="text-xs font-bold text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 hover:border-rose-300 border border-slate-200 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                    title="Click to view all photos"
                  >
                    <i class="fa-regular fa-images text-rose-600"></i>
                    <span>${upload.imageUrls.length} photos</span>
                  </button>
                </div>

                <!-- Action Buttons: Download ZIP, Status Toggle, Delete -->
                <div class="flex items-center gap-2">
                  <!-- Download ZIP Button -->
                  <button 
                    data-action="download-zip" 
                    data-upload-id="${upload.id}" 
                    class="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <i class="fa-solid fa-file-zipper text-xs"></i> Download ZIP
                  </button>

                  <!-- Toggle Downloaded Status -->
                  <button 
                    data-action="toggle-status" 
                    data-upload-id="${upload.id}" 
                    data-is-downloaded="${upload.isDownloaded}"
                    class="w-9 h-9 border ${upload.isDownloaded ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} text-xs font-bold rounded-xl transition-colors flex items-center justify-center flex-shrink-0"
                    title="${upload.isDownloaded ? 'Mark as Pending' : 'Mark as Downloaded'}"
                  >
                    <i class="fa-solid ${upload.isDownloaded ? 'fa-arrow-rotate-left' : 'fa-check'} text-xs"></i>
                  </button>

                  <!-- Delete Submission Button -->
                  <button 
                    data-action="delete-archive" 
                    data-upload-id="${upload.id}" 
                    class="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition-colors flex-shrink-0"
                    title="Delete Submission"
                  >
                    <i class="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>

              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    // Wire Card Checkboxes
    listContainer.querySelectorAll('.upload-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-upload-id');
        if (e.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateBulkToolbar();
      });
    });

    // Wire Actions
    listContainer.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = btn.getAttribute('data-action');
        const uploadId = btn.getAttribute('data-upload-id');
        const upload = uploadsList.find(u => u.id === uploadId);
        if (!upload) return;

        if (action === 'view-photos') {
          openWebArchiveGalleryModal(upload);
        } else if (action === 'download-zip') {
          await downloadSubmissionZip(upload, btn);
        } else if (action === 'toggle-status') {
          const newStatus = !upload.isDownloaded;
          await adminApi.updateWebArchiveDownloaded(uploadId, newStatus);
          upload.isDownloaded = newStatus;
          adminState.showToast('info', newStatus ? 'Marked as downloaded' : 'Marked as pending');
        } else if (action === 'delete-archive') {
          const name = upload.formattedName || upload.customerName || 'this submission';
          if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
          try {
            await adminApi.deleteWebArchive(uploadId);
            adminState.showToast('info', 'Customer upload deleted');
          } catch (err) {
            adminState.showToast('error', 'Failed to delete: ' + err.message);
          }
        }
      });
    });
  };

  // Helper to download single submission photos as ZIP
  const downloadSubmissionZip = async (upload, btnElement) => {
    if (!window.JSZip || !window.saveAs) {
      adminState.showToast('error', 'ZIP generator is loading, please try again in a moment');
      return;
    }

    const origHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Creating ZIP...';

    const displayName = upload.formattedName || upload.customerName || 'Web_Upload';
    const filename = upload.filename ? (upload.filename.endsWith('.zip') ? upload.filename : `${upload.filename}.zip`) : `${displayName}.zip`;

    try {
      const zip = new window.JSZip();
      const folderName = displayName.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const folder = zip.folder(folderName);

      for (let i = 0; i < upload.imageUrls.length; i++) {
        const url = upload.imageUrls[i];
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const ext = url.split('.').pop().split('?')[0] || 'jpg';
          folder.file(`photo_${i + 1}.${ext}`, blob);
        } catch (e) {
          console.warn(`Failed to fetch photo ${i + 1}:`, e);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      window.saveAs(zipBlob, filename);

      // Auto mark as downloaded
      await adminApi.updateWebArchiveDownloaded(upload.id, true);
      upload.isDownloaded = true;
      adminState.showToast('success', `Downloaded ${filename}`);
      renderUploadCards();
    } catch (err) {
      adminState.showToast('error', 'Failed to generate ZIP: ' + err.message);
    } finally {
      btnElement.disabled = false;
      btnElement.innerHTML = origHtml;
    }
  };

  // Batch ZIP Download
  if (batchDownloadBtn) {
    batchDownloadBtn.addEventListener('click', async () => {
      if (selectedIds.size === 0) return;
      if (!window.JSZip || !window.saveAs) return;

      batchDownloadBtn.disabled = true;
      batchDownloadBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Generating Batch ZIP...';

      try {
        const masterZip = new window.JSZip();

        for (const id of selectedIds) {
          const upload = uploadsList.find(u => u.id === id);
          if (!upload) continue;

          const displayName = upload.formattedName || upload.customerName || 'Web_Upload';
          const folderName = displayName.replace(/[^a-zA-Z0-9_\-]/g, '_');
          const folder = masterZip.folder(folderName);

          for (let i = 0; i < upload.imageUrls.length; i++) {
            const url = upload.imageUrls[i];
            try {
              const resp = await fetch(url);
              const blob = await resp.blob();
              const ext = url.split('.').pop().split('?')[0] || 'jpg';
              folder.file(`photo_${i + 1}.${ext}`, blob);
            } catch (e) {
              console.warn(e);
            }
          }
          // Mark downloaded
          await adminApi.updateWebArchiveDownloaded(upload.id, true);
          upload.isDownloaded = true;
        }

        const masterBlob = await masterZip.generateAsync({ type: 'blob' });
        window.saveAs(masterBlob, `Batch_Uploads_${Date.now()}.zip`);
        adminState.showToast('success', 'Batch ZIP downloaded successfully!');
        selectedIds.clear();
        updateBulkToolbar();
        renderUploadCards();
      } catch (err) {
        adminState.showToast('error', 'Batch download failed: ' + err.message);
      } finally {
        batchDownloadBtn.disabled = false;
        batchDownloadBtn.innerHTML = `<i class="fa-solid fa-file-zipper text-xs"></i> Batch ZIP (<span id="batch-count-num">0</span>)`;
      }
    });
  }

  // Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.getAttribute('data-filter');
      adminState.setWebUploadsFilter(currentFilter);
      filterBtns.forEach(b => {
        const isCurrent = b.getAttribute('data-filter') === currentFilter;
        b.className = `web-filter-btn flex-1 sm:flex-none text-center px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${isCurrent ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`;
      });
      renderUploadCards();
    });
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderUploadCards();
  });

  // Watch web archives in real-time
  const unsub = adminApi.watchWebArchives(list => {
    uploadsList = list;
    renderUploadCards();
  });
  adminState.addSubscription(unsub);
}
