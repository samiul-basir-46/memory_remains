import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

export function renderWebUploadsTab(container) {
  let uploadsList = [];
  let currentFilter = adminState.getState().webUploadsFilter || 'all';
  let selectedIds = new Set();
  let searchQuery = '';

  container.innerHTML = `
    <div class="flex flex-col h-full">
      
      <!-- Top Filter & Search Bar -->
      <div class="p-4 sm:p-5 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-3">
        
        <!-- Filter Pills -->
        <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button data-filter="all" class="web-filter-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentFilter === 'all' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            All Submissions
          </button>
          <button data-filter="pending" class="web-filter-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentFilter === 'pending' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <i class="fa-solid fa-cloud-arrow-down mr-1"></i> Pending Download
          </button>
          <button data-filter="downloaded" class="web-filter-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${currentFilter === 'downloaded' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
            <i class="fa-solid fa-check mr-1"></i> Downloaded
          </button>
        </div>

        <!-- Search & Batch Download -->
        <div class="flex items-center gap-3">
          <div class="relative w-52 sm:w-64">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
              type="text" 
              id="web-uploads-search-input" 
              placeholder="Search customer, phone, order..." 
              class="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-600 focus:bg-white transition-all"
            >
          </div>

          <div id="web-bulk-toolbar" class="hidden flex items-center gap-2">
            <button id="batch-download-zip-btn" class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-file-zipper text-xs"></i> Download Batch ZIP (<span id="batch-count-num">0</span>)
            </button>
          </div>
        </div>

      </div>

      <!-- Uploads List Content -->
      <div id="web-uploads-content" class="flex-1 overflow-y-auto p-4 sm:p-5 admin-custom-scroll bg-[#F8FAFC]">
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
        (u.customerPhone && u.customerPhone.includes(searchQuery)) ||
        (u.orderId && u.orderId.toLowerCase().includes(searchQuery)) ||
        (u.productType && u.productType.toLowerCase().includes(searchQuery))
      );
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 text-2xl mb-3">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-700 mb-1">No Customer Submissions</h4>
          <p class="text-xs text-slate-400 max-w-xs">No web photo submissions match the selected filter.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = `
      <div class="grid grid-cols-1 gap-4">
        ${filtered.map(upload => {
          const isChecked = selectedIds.has(upload.id);
          const dateStr = upload.createdAt ? new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }).format(upload.createdAt) : '';

          return `
            <div class="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-rose-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group">
              
              <!-- Checkbox & Customer Metadata -->
              <div class="flex items-start gap-3.5 flex-1 min-w-0">
                <input 
                  type="checkbox" 
                  data-upload-id="${upload.id}" 
                  class="upload-checkbox mt-1 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  ${isChecked ? 'checked' : ''}
                >

                <div class="space-y-1.5 min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-bold text-slate-900 font-mono">#${upload.orderId}</span>
                    <span class="text-[11px] text-slate-400">• ${dateStr}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${upload.isDownloaded ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                      ${upload.isDownloaded ? '<i class="fa-solid fa-check text-[9px] mr-0.5"></i> Downloaded' : '<i class="fa-solid fa-circle text-[6px] mr-1 text-rose-500 animate-ping"></i> Pending Download'}
                    </span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      ${upload.productType}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span class="font-bold text-slate-800">${upload.customerName}</span>
                    ${upload.customerPhone ? `
                      <a href="tel:${upload.customerPhone}" class="text-rose-700 font-semibold hover:underline flex items-center gap-1">
                        <i class="fa-solid fa-phone text-[10px]"></i> ${upload.customerPhone}
                      </a>
                    ` : ''}
                  </div>

                  ${upload.itemDescription ? `
                    <p class="text-xs text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">${upload.itemDescription}</p>
                  ` : ''}
                </div>
              </div>

              <!-- Thumbnails Preview Strip -->
              <div class="flex items-center gap-2 flex-shrink-0">
                <div class="flex -space-x-3 overflow-hidden py-1">
                  ${upload.imageUrls.slice(0, 4).map((url, i) => `
                    <img class="inline-block h-10 w-10 rounded-xl ring-2 ring-white object-cover shadow-xs" src="${url}" alt="Photo ${i + 1}" loading="lazy">
                  `).join('')}
                </div>
                <span class="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  ${upload.imageUrls.length} photos
                </span>
              </div>

              <!-- Actions: Download ZIP & Toggle Downloaded -->
              <div class="flex items-center justify-end gap-2 flex-shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <button 
                  data-action="download-zip" 
                  data-upload-id="${upload.id}" 
                  class="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <i class="fa-solid fa-file-zipper text-xs"></i> Download ZIP
                </button>

                <button 
                  data-action="toggle-status" 
                  data-upload-id="${upload.id}" 
                  data-is-downloaded="${upload.isDownloaded}"
                  class="px-3 py-2 border ${upload.isDownloaded ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  title="${upload.isDownloaded ? 'Mark as Pending' : 'Mark as Downloaded'}"
                >
                  <i class="fa-solid ${upload.isDownloaded ? 'fa-arrow-rotate-left' : 'fa-check'} text-xs"></i>
                </button>
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
    listContainer.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const uploadId = btn.getAttribute('data-upload-id');
        const upload = uploadsList.find(u => u.id === uploadId);
        if (!upload) return;

        if (action === 'download-zip') {
          await downloadSubmissionZip(upload, btn);
        } else if (action === 'toggle-status') {
          const newStatus = !upload.isDownloaded;
          await adminApi.updateWebArchiveDownloaded(uploadId, newStatus);
          adminState.showToast('info', newStatus ? 'Marked as downloaded' : 'Marked as pending');
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

    try {
      const zip = new window.JSZip();
      const folder = zip.folder(`Order_${upload.orderId}`);

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
      const filename = `Order_${upload.orderId}_${upload.customerName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
      window.saveAs(zipBlob, filename);

      // Auto mark as downloaded
      await adminApi.updateWebArchiveDownloaded(upload.id, true);
      adminState.showToast('success', `Downloaded ${filename}`);
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

          const folder = masterZip.folder(`Order_${upload.orderId}_${upload.customerName.replace(/[^a-zA-Z0-9]/g, '_')}`);
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
        }

        const masterBlob = await masterZip.generateAsync({ type: 'blob' });
        window.saveAs(masterBlob, `Batch_Uploads_${Date.now()}.zip`);
        adminState.showToast('success', 'Batch ZIP downloaded successfully!');
        selectedIds.clear();
        updateBulkToolbar();
      } catch (err) {
        adminState.showToast('error', 'Batch download failed: ' + err.message);
      } finally {
        batchDownloadBtn.disabled = false;
        batchDownloadBtn.innerHTML = `<i class="fa-solid fa-file-zipper text-xs"></i> Download Batch ZIP (<span id="batch-count-num">0</span>)`;
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
        b.className = `web-filter-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${isCurrent ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`;
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
