import { adminApi } from '../admin-api.js';
import { adminState } from '../admin-state.js';

/**
 * Open interactive Photo Gallery & Lightbox Modal for a Web Archive submission
 * @param {Object} upload - Upload archive data
 */
export function openWebArchiveGalleryModal(upload) {
  const modalContainer = document.getElementById('admin-modals') || document.body;

  const displayName = upload.formattedName || upload.customerName || 'Web Upload';
  const filename = upload.filename || `${displayName}.zip`;
  const images = upload.imageUrls || [];
  let currentActiveIndex = 0;
  let viewMode = 'grid'; // 'grid' | 'lightbox'

  const dateStr = upload.createdAt ? new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(upload.createdAt) : '';

  const modalEl = document.createElement('div');
  modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-900/80 backdrop-blur-sm animate-fade-in';
  modalEl.id = 'web-archive-gallery-modal';

  const renderModal = () => {
    modalEl.innerHTML = `
      <div class="bg-white rounded-2xl sm:rounded-3xl w-full max-w-5xl h-[94vh] sm:h-[92vh] max-h-[850px] shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-scale-up">
        
        <!-- Modal Top Bar Header (Mobile & Desktop Optimized) -->
        <div class="p-3 sm:px-5 sm:py-4 border-b border-slate-200 bg-white flex flex-col gap-2 flex-shrink-0">
          
          <!-- Top Row: Icon + Title + Status + Action Buttons -->
          <div class="flex items-center justify-between gap-2.5 min-w-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0 shadow-2xs">
                <i class="fa-solid fa-images text-xs sm:text-base"></i>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                  <h3 class="text-sm sm:text-base font-bold text-slate-900 truncate" title="${displayName}">${displayName}</h3>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    upload.isDownloaded 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }">
                    ${upload.isDownloaded ? '<i class="fa-solid fa-check text-[8px] mr-0.5"></i> Downloaded' : '<i class="fa-solid fa-cloud-arrow-down text-[8px] mr-0.5"></i> Pending'}
                  </span>
                  <span class="text-[10px] sm:text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100/60">
                    ${images.length} Photos
                  </span>
                </div>
              </div>
            </div>

            <!-- Action Buttons: Mode Switcher, Download ZIP, Close -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <!-- View Mode Switcher (Desktop only) -->
              <div class="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 mr-1">
                <button id="view-mode-grid-btn" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}" title="Grid View">
                  <i class="fa-solid fa-grip mr-1 text-xs"></i> Grid
                </button>
                <button id="view-mode-lightbox-btn" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'lightbox' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}" title="Slider View">
                  <i class="fa-regular fa-image mr-1 text-xs"></i> Slider
                </button>
              </div>

              <!-- Download ZIP Button -->
              <button id="modal-download-zip-btn" class="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5">
                <i class="fa-solid fa-download text-xs"></i>
                <span class="hidden sm:inline">Download ZIP</span>
              </button>

              <!-- Close Modal Button -->
              <button id="modal-close-btn" class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors">
                <i class="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
          </div>

          <!-- Bottom Sub-Row: Date, Filename & Phone (Clean Single Line on Mobile) -->
          <div class="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100/80">
            <div class="flex items-center gap-2 truncate">
              <span><i class="fa-regular fa-calendar text-[10px] mr-1 text-slate-400"></i>${dateStr}</span>
              ${filename ? `<span class="hidden sm:inline">•</span><span class="font-mono text-slate-500 truncate max-w-[200px] hidden sm:inline"><i class="fa-regular fa-file-zipper text-[10px] mr-1 text-slate-400"></i>${filename}</span>` : ''}
              ${upload.customerPhone ? `<span>•</span><a href="tel:${upload.customerPhone}" class="text-rose-700 font-semibold hover:underline flex items-center gap-1"><i class="fa-solid fa-phone text-[9px]"></i>${upload.customerPhone}</a>` : ''}
            </div>
            <div class="font-mono text-slate-400 text-[10px] flex-shrink-0">
              #${upload.orderId}
            </div>
          </div>

        </div>

        <!-- Modal Body Content: Grid or Lightbox -->
        <div class="flex-1 overflow-hidden flex flex-col bg-[#F8FAFC]">
          ${viewMode === 'grid' ? renderGridViewHtml() : renderLightboxViewHtml()}
        </div>

        <!-- Modal Footer Bar (Mobile Optimized) -->
        <div class="px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-2 text-xs text-slate-500 flex-shrink-0">
          <div class="flex items-center gap-2 truncate">
            <span class="truncate">ID: <code class="font-mono text-slate-700 font-bold">#${upload.orderId}</code></span>
            ${upload.itemDescription ? `<span class="hidden sm:inline">• Note: <em class="text-slate-600 truncate">${upload.itemDescription}</em></span>` : ''}
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button id="modal-toggle-status-btn" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5">
              <i class="fa-solid ${upload.isDownloaded ? 'fa-arrow-rotate-left' : 'fa-check'} text-xs"></i>
              <span>${upload.isDownloaded ? 'Mark as Pending' : 'Mark Downloaded'}</span>
            </button>
          </div>
        </div>

      </div>
    `;

    wireModalEvents();
  };

  /**
   * Render All Photos in a Responsive Grid
   */
  const renderGridViewHtml = () => {
    if (images.length === 0) {
      return `
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 text-2xl mb-3">
            <i class="fa-regular fa-image"></i>
          </div>
          <p class="text-sm font-bold text-slate-700">No photos found in this archive</p>
        </div>
      `;
    }

    return `
      <div class="flex-1 overflow-y-auto p-3 sm:p-6 admin-custom-scroll">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
          ${images.map((url, idx) => `
            <div class="photo-grid-card group relative aspect-square bg-slate-100 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200/90 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer" data-photo-index="${idx}">
              <img src="${url}" alt="Photo ${idx + 1}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy">
              
              <!-- Top Left Index Badge -->
              <div class="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 py-0.5 sm:px-2 rounded-md bg-slate-900/75 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-bold">
                #${idx + 1}
              </div>

              <!-- Hover Action Overlay -->
              <div class="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-lg transition-transform hover:scale-110" title="Zoom in">
                  <i class="fa-solid fa-magnifying-glass-plus text-xs text-rose-600"></i>
                </button>
                <a href="${url}" target="_blank" rel="noopener noreferrer" download="photo_${idx + 1}.jpg" class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-lg transition-transform hover:scale-110" title="Open / Download Full Res" onclick="event.stopPropagation()">
                  <i class="fa-solid fa-arrow-down text-xs text-slate-700"></i>
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  /**
   * Render Large Lightbox Slider View
   */
  const renderLightboxViewHtml = () => {
    if (images.length === 0) return '';
    const currentUrl = images[currentActiveIndex] || images[0];

    return `
      <div class="flex-1 flex flex-col overflow-hidden bg-slate-950 text-white relative">
        
        <!-- Lightbox Top Controls -->
        <div class="p-2.5 sm:p-3 px-3 sm:px-5 bg-slate-900/80 backdrop-blur-md flex items-center justify-between z-10 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-lg bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[11px] sm:text-xs font-bold">
              ${currentActiveIndex + 1} / ${images.length}
            </span>
            <button id="lb-back-to-grid-btn" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-grip text-[10px]"></i> <span class="hidden sm:inline">Back to</span> Grid
            </button>
          </div>

          <div class="flex items-center gap-1.5">
            <a href="${currentUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1" title="Open original in new tab">
              <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i> <span class="hidden sm:inline">Original</span>
            </a>
            <a href="${currentUrl}" download="photo_${currentActiveIndex + 1}.jpg" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1" title="Download photo">
              <i class="fa-solid fa-download text-[9px]"></i> <span class="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>

        <!-- Large Image Stage -->
        <div class="flex-1 flex items-center justify-center p-3 relative min-h-0 select-none">
          <!-- Previous Button -->
          <button id="lb-prev-btn" class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-slate-900/80 hover:bg-rose-600 border border-slate-700 hover:border-rose-500 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 z-10" title="Previous photo (Left Arrow)">
            <i class="fa-solid fa-chevron-left text-xs sm:text-sm"></i>
          </button>

          <!-- The Main Photo -->
          <div class="max-w-full max-h-full flex items-center justify-center">
            <img src="${currentUrl}" alt="Photo ${currentActiveIndex + 1}" class="max-w-full max-h-[62vh] object-contain rounded-xl sm:rounded-2xl shadow-2xl border border-slate-800 animate-fade-in" id="lb-main-image">
          </div>

          <!-- Next Button -->
          <button id="lb-next-btn" class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-slate-900/80 hover:bg-rose-600 border border-slate-700 hover:border-rose-500 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 z-10" title="Next photo (Right Arrow)">
            <i class="fa-solid fa-chevron-right text-xs sm:text-sm"></i>
          </button>
        </div>

        <!-- Bottom Filmstrip Thumbnails -->
        <div class="p-2 sm:p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-1.5 sm:gap-2 overflow-x-auto admin-custom-scroll flex-shrink-0">
          ${images.map((url, idx) => `
            <div class="filmstrip-thumb w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl overflow-hidden border-2 cursor-pointer flex-shrink-0 transition-all ${
              idx === currentActiveIndex ? 'border-rose-500 scale-105 ring-2 ring-rose-500/50' : 'border-slate-700 opacity-60 hover:opacity-100'
            }" data-jump-index="${idx}">
              <img src="${url}" alt="Thumb ${idx + 1}" class="w-full h-full object-cover">
            </div>
          `).join('')}
        </div>

      </div>
    `;
  };

  /**
   * Wire Interactive Controls
   */
  const wireModalEvents = () => {
    // Close button
    modalEl.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);

    // Click backdrop to close
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });

    // View mode switchers
    modalEl.querySelector('#view-mode-grid-btn')?.addEventListener('click', () => {
      viewMode = 'grid';
      renderModal();
    });
    modalEl.querySelector('#view-mode-lightbox-btn')?.addEventListener('click', () => {
      viewMode = 'lightbox';
      renderModal();
    });
    modalEl.querySelector('#lb-back-to-grid-btn')?.addEventListener('click', () => {
      viewMode = 'grid';
      renderModal();
    });

    // Grid photo clicks -> opens Lightbox at index
    modalEl.querySelectorAll('.photo-grid-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = Number(card.getAttribute('data-photo-index'));
        currentActiveIndex = idx;
        viewMode = 'lightbox';
        renderModal();
      });
    });

    // Lightbox Prev / Next
    modalEl.querySelector('#lb-prev-btn')?.addEventListener('click', () => {
      if (currentActiveIndex > 0) currentActiveIndex--;
      else currentActiveIndex = images.length - 1;
      renderModal();
    });

    modalEl.querySelector('#lb-next-btn')?.addEventListener('click', () => {
      if (currentActiveIndex < images.length - 1) currentActiveIndex++;
      else currentActiveIndex = 0;
      renderModal();
    });

    // Filmstrip jump
    modalEl.querySelectorAll('.filmstrip-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        currentActiveIndex = Number(thumb.getAttribute('data-jump-index'));
        renderModal();
      });
    });

    // Download All ZIP
    const downloadZipBtn = modalEl.querySelector('#modal-download-zip-btn');
    if (downloadZipBtn) {
      downloadZipBtn.addEventListener('click', async () => {
        if (!window.JSZip || !window.saveAs) {
          adminState.showToast('error', 'ZIP generator is loading, please try again');
          return;
        }

        const origHtml = downloadZipBtn.innerHTML;
        downloadZipBtn.disabled = true;
        downloadZipBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-xs"></i> Zipping...';

        try {
          const zip = new window.JSZip();
          const folderName = displayName.replace(/[^a-zA-Z0-9_\-]/g, '_');
          const folder = zip.folder(folderName);

          for (let i = 0; i < images.length; i++) {
            const url = images[i];
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
          const zipName = filename.endsWith('.zip') ? filename : `${displayName}.zip`;
          window.saveAs(zipBlob, zipName);

          await adminApi.updateWebArchiveDownloaded(upload.id, true);
          upload.isDownloaded = true;
          adminState.showToast('success', `Downloaded ${zipName}`);
          renderModal();
        } catch (err) {
          adminState.showToast('error', 'Failed to generate ZIP: ' + err.message);
        } finally {
          downloadZipBtn.disabled = false;
          downloadZipBtn.innerHTML = origHtml;
        }
      });
    }

    // Toggle Status button in footer
    modalEl.querySelector('#modal-toggle-status-btn')?.addEventListener('click', async () => {
      const newStatus = !upload.isDownloaded;
      await adminApi.updateWebArchiveDownloaded(upload.id, newStatus);
      upload.isDownloaded = newStatus;
      adminState.showToast('info', newStatus ? 'Marked as downloaded' : 'Marked as pending');
      renderModal();
    });
  };

  // Keyboard navigation
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      if (viewMode === 'lightbox') {
        viewMode = 'grid';
        renderModal();
      } else {
        closeModal();
      }
    } else if (viewMode === 'lightbox') {
      if (e.key === 'ArrowLeft') {
        if (currentActiveIndex > 0) currentActiveIndex--;
        else currentActiveIndex = images.length - 1;
        renderModal();
      } else if (e.key === 'ArrowRight') {
        if (currentActiveIndex < images.length - 1) currentActiveIndex++;
        else currentActiveIndex = 0;
        renderModal();
      }
    }
  };

  const closeModal = () => {
    window.removeEventListener('keydown', keyHandler);
    modalEl.remove();
  };

  window.addEventListener('keydown', keyHandler);

  // Initial render & attach to DOM
  renderModal();
  modalContainer.appendChild(modalEl);
}
