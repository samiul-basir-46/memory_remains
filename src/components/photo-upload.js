import { escapeHtml } from '../utils/ui.js';
import { getFirebaseServices } from '../services/firebase-service.js';

const API_BASE = "https://bkash-sms-gateway.onrender.com";

export function mapUploadError(detail) {
  if (!detail) return "We ran into a slight bump preparing your upload. Please try again.";
  const msg = typeof detail === 'string' ? detail.toLowerCase() : JSON.stringify(detail).toLowerCase();

  if (msg.includes('order not found') || msg.includes('invalid order') || msg.includes('not_found')) {
    return "We couldn't locate this order record. Please verify your order number or contact support.";
  }
  if (msg.includes('file count') || msg.includes('too many') || msg.includes('invalid count') || msg.includes('mismatch')) {
    return "The number of photos selected does not match the requirement. Please check your photo selection.";
  }
  if (msg.includes('storage') || msg.includes('space') || msg.includes('quota') || msg.includes('capacity')) {
    return "Storage is temporarily busy. Please retry uploading in a few moments.";
  }
  if (msg.includes('type') || msg.includes('format') || msg.includes('invalid file') || msg.includes('extension')) {
    return "One or more files have an unsupported format. Please select valid images (JPEG, PNG, WEBP).";
  }
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('failed to fetch') || msg.includes('connection')) {
    return "Connection was interrupted. Please check your internet connection and click retry.";
  }
  if (msg.includes('size') || msg.includes('large') || msg.includes('exceed')) {
    return "One of the photo chunks exceeded maximum size limits. Please try selecting the files again.";
  }
  return typeof detail === 'string' && detail.length < 150 ? detail : "We encountered an issue uploading your photos. Please try again.";
}

export function renderPhotoUploadUI(container, options = {}) {
  if (!container) return;

  const orderId = options.orderId || `TEMP-${Date.now()}`;
  const safeOrderId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Calculate dynamic min/max limits
  let minPhotos = Number(options.minPhotos || options.min_photos || options.requiredPhotoCount || 0);
  let maxPhotos = Number(options.maxPhotos || options.max_photos || options.requiredPhotoCount || 0);
  const pageCount = Number(options.pageCount || options.pages || 0);

  // Fallbacks only when unset by admin
  if (!minPhotos || !maxPhotos) {
    if (pageCount === 4) { minPhotos = minPhotos || 8; maxPhotos = maxPhotos || 15; }
    else if (pageCount === 8) { minPhotos = minPhotos || 15; maxPhotos = maxPhotos || 22; }
    else if (pageCount === 12) { minPhotos = minPhotos || 25; maxPhotos = maxPhotos || 32; }
    else if (pageCount === 16) { minPhotos = minPhotos || 35; maxPhotos = maxPhotos || 45; }
    else if (pageCount === 20) { minPhotos = minPhotos || 50; maxPhotos = maxPhotos || 60; }
    else if (pageCount === 24) { minPhotos = minPhotos || 60; maxPhotos = maxPhotos || 70; }
    else if (pageCount > 0) {
      minPhotos = minPhotos || Math.max(1, pageCount * 2);
      maxPhotos = maxPhotos || Math.max(minPhotos, pageCount * 3);
    }
  }

  if (!minPhotos) minPhotos = 8;
  if (!maxPhotos) maxPhotos = 15;

  // Ensure logical min and max
  if (minPhotos < 2) minPhotos = 2; // At least Front + Back Cover
  if (maxPhotos < minPhotos) maxPhotos = minPhotos;

  const isRange = minPhotos !== maxPhotos;
  const onSuccess = options.onSuccess;
  const isPreCheckout = Boolean(options.isPreCheckout);
  const submitButtonText = options.submitButtonText || (isPreCheckout ? 'Upload Photos & Continue to Delivery' : 'Upload All Photos');

  // Dedicated slots
  let coverFile = options.initialCoverFile || null;
  let backFile = options.initialBackFile || null;
  let innerFiles = options.initialInnerFiles ? [...options.initialInnerFiles] : [];

  let isUploading = false;
  let isComplete = Boolean(options.photosUploaded);
  let statusText = '';
  let errorMessage = '';
  let overallProgress = 0;
  let replaceTargetIndex = null;

  function cleanupObjectUrls() {
    if (coverFile?._objectUrl) {
      URL.revokeObjectURL(coverFile._objectUrl);
      delete coverFile._objectUrl;
    }
    if (backFile?._objectUrl) {
      URL.revokeObjectURL(backFile._objectUrl);
      delete backFile._objectUrl;
    }
    innerFiles.forEach(f => {
      if (f._objectUrl) {
        URL.revokeObjectURL(f._objectUrl);
        delete f._objectUrl;
      }
    });
  }

  function getFileObjectUrl(file) {
    if (!file) return '';
    if (typeof file === 'string') return file;
    if (!file._objectUrl) {
      file._objectUrl = URL.createObjectURL(file);
    }
    return file._objectUrl;
  }

  function getTotalCount() {
    return (coverFile ? 1 : 0) + (backFile ? 1 : 0) + innerFiles.length;
  }

  function render() {
    if (isComplete) {
      container.innerHTML = `
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-200 text-center space-y-2 shadow-sm">
          <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl mx-auto">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <h4 class="font-heading text-lg font-bold text-emerald-950 mb-0.5">✅ Photos Uploaded Successfully!</h4>
            <p class="text-xs text-emerald-700 font-medium">Cover page, back page, and inner photos have been safely attached to your order.</p>
          </div>
        </div>
      `;
      return;
    }

    const totalCount = getTotalCount();
    const hasCover = Boolean(coverFile);
    const hasBack = Boolean(backFile);
    const countMatches = hasCover && hasBack && totalCount >= minPhotos && totalCount <= maxPhotos;
    const isTooFew = totalCount < minPhotos;
    const isTooMany = totalCount > maxPhotos;

    let validationMessage = '';
    let btnText = submitButtonText;

    if (!hasCover && !hasBack) {
      validationMessage = '⚠️ Please select Front Cover & Back Cover photos';
      btnText = 'Select Cover & Back Photos';
    } else if (!hasCover) {
      validationMessage = '⚠️ Please select Front Cover photo';
      btnText = 'Select Front Cover Photo';
    } else if (!hasBack) {
      validationMessage = '⚠️ Please select Back Cover photo';
      btnText = 'Select Back Cover Photo';
    } else if (isTooFew) {
      const needed = minPhotos - totalCount;
      validationMessage = `⚠️ Need at least ${needed} more photo${needed > 1 ? 's' : ''} (Minimum required: ${minPhotos})`;
      btnText = `Add ${needed} More Photo${needed > 1 ? 's' : ''} (Min: ${minPhotos})`;
    } else if (isTooMany) {
      const extra = totalCount - maxPhotos;
      validationMessage = `⚠️ Too many photos (${totalCount}/${maxPhotos}) — please remove ${extra}`;
      btnText = `Remove ${extra} Extra Photo${extra > 1 ? 's' : ''} (Max: ${maxPhotos})`;
    } else {
      validationMessage = `✓ Perfect! (${totalCount} photos selected)`;
      btnText = isPreCheckout ? `Upload & Continue to Delivery (${totalCount} Photos)` : `Upload All Photos (${totalCount})`;
    }

    container.innerHTML = `
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6">
        <div>
          <div class="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h3 class="font-heading text-xl md:text-2xl text-[#2A2A2A] font-bold">Upload Your Photos</h3>
            <span class="px-3.5 py-1 bg-pink-100 text-pink-900 text-xs font-extrabold rounded-full border border-pink-200">
              Required: ${isRange ? `${minPhotos}–${maxPhotos}` : `${maxPhotos}`} Photos
            </span>
          </div>
          <p class="text-xs md:text-sm text-text-soft">
            Select your <strong>Front Cover</strong>, <strong>Back Page</strong>, and <strong>Inner Page Photos</strong>. Minimum <strong>${minPhotos}</strong> photos and maximum <strong>${maxPhotos}</strong> photos are required.
          </p>
        </div>

        <div class="space-y-1.5 text-left">
          <label for="recipient-input-${safeOrderId}" class="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <i class="fa-solid fa-user-pen text-pink-500"></i> Recipient / Title <span class="text-gray-400 font-normal">(Optional — e.g. For Mim, Birthday Special)</span>
          </label>
          <input type="text" id="recipient-input-${safeOrderId}" placeholder="e.g. For Mim, Anniversary Special..." 
                 class="w-full text-xs px-3.5 py-2.5 rounded-xl border border-pink-200 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all font-body bg-pink-50/20"
                 value="${options.recipientName || ''}">
        </div>

        <!-- Dedicated Cover & Back Page Slots -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Front Cover Slot -->
          <div class="relative border-2 ${coverFile ? 'border-emerald-400 bg-emerald-50/30' : 'border-dashed border-pink-300 bg-pink-50/40'} rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[190px] transition-all">
            <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${coverFile ? 'bg-emerald-600 text-white shadow-xs' : 'bg-pink-200 text-pink-900'}">
              🌟 Front Cover (Page 1) *
            </span>
            ${coverFile ? `
              <div class="relative w-full h-32 rounded-xl overflow-hidden mt-5 mb-2 shadow-xs group">
                <img src="${getFileObjectUrl(coverFile)}" class="w-full h-full object-cover" alt="Front Cover">
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button type="button" id="btn-replace-cover-${safeOrderId}" class="px-2.5 py-1 bg-white text-gray-800 text-xs font-bold rounded-lg shadow-sm hover:bg-gray-100 cursor-pointer">
                    <i class="fa-solid fa-arrows-rotate"></i> Change
                  </button>
                  <button type="button" id="btn-remove-cover-${safeOrderId}" class="px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-rose-700 cursor-pointer">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
              <p class="text-[11px] font-bold text-emerald-800 truncate max-w-[200px]">${escapeHtml(coverFile.name || 'Cover Page')}</p>
            ` : `
              <div id="zone-cover-${safeOrderId}" class="w-full h-full flex flex-col items-center justify-center cursor-pointer py-4">
                <div class="w-10 h-10 rounded-full bg-pink-100 text-primary flex items-center justify-center text-lg mb-2">
                  <i class="fa-solid fa-image"></i>
                </div>
                <p class="text-xs font-bold text-[#2A2A2A]">Select Front Cover *</p>
                <p class="text-[10px] text-text-soft mt-0.5">Click to browse photo</p>
              </div>
            `}
            <input type="file" id="input-cover-${safeOrderId}" accept="image/*" class="hidden">
          </div>

          <!-- Back Page Slot -->
          <div class="relative border-2 ${backFile ? 'border-emerald-400 bg-emerald-50/30' : 'border-dashed border-pink-300 bg-pink-50/40'} rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[190px] transition-all">
            <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${backFile ? 'bg-emerald-600 text-white shadow-xs' : 'bg-pink-200 text-pink-900'}">
              📖 Back Cover (Last Page) *
            </span>
            ${backFile ? `
              <div class="relative w-full h-32 rounded-xl overflow-hidden mt-5 mb-2 shadow-xs group">
                <img src="${getFileObjectUrl(backFile)}" class="w-full h-full object-cover" alt="Back Cover">
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button type="button" id="btn-replace-back-${safeOrderId}" class="px-2.5 py-1 bg-white text-gray-800 text-xs font-bold rounded-lg shadow-sm hover:bg-gray-100 cursor-pointer">
                    <i class="fa-solid fa-arrows-rotate"></i> Change
                  </button>
                  <button type="button" id="btn-remove-back-${safeOrderId}" class="px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-rose-700 cursor-pointer">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
              <p class="text-[11px] font-bold text-emerald-800 truncate max-w-[200px]">${escapeHtml(backFile.name || 'Back Page')}</p>
            ` : `
              <div id="zone-back-${safeOrderId}" class="w-full h-full flex flex-col items-center justify-center cursor-pointer py-4">
                <div class="w-10 h-10 rounded-full bg-pink-100 text-primary flex items-center justify-center text-lg mb-2">
                  <i class="fa-solid fa-book-open"></i>
                </div>
                <p class="text-xs font-bold text-[#2A2A2A]">Select Back Cover *</p>
                <p class="text-[10px] text-text-soft mt-0.5">Click to browse photo</p>
              </div>
            `}
            <input type="file" id="input-back-${safeOrderId}" accept="image/*" class="hidden">
          </div>
        </div>

        <!-- Inner Photos Section -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-bold text-gray-800 uppercase tracking-wider">Inner Magazine Photos</h4>
              <p class="text-[11px] text-gray-500">Remaining photos for the inside pages (${innerFiles.length} selected)</p>
            </div>
            <span class="text-xs font-bold ${innerFiles.length + (coverFile ? 1 : 0) + (backFile ? 1 : 0) >= minPhotos ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200' : 'text-gray-600'}">
              ${innerFiles.length} inner photo${innerFiles.length === 1 ? '' : 's'}
            </span>
          </div>

          <div id="drop-zone-inner-${safeOrderId}" class="border-2 border-dashed border-pink-300/80 hover:border-primary bg-pink-50/40 hover:bg-pink-50/70 p-5 rounded-2xl text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 rounded-full bg-pink-100 text-primary flex items-center justify-center text-lg">
              <i class="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <p class="text-xs font-semibold text-[#2A2A2A]">Drag & drop inner photos here, or <span class="text-primary underline font-bold">browse</span></p>
            <p class="text-[10px] text-text-soft">Select multiple photos at once (Up to ${Math.max(0, maxPhotos - (coverFile ? 1 : 0) - (backFile ? 1 : 0))} inner photos)</p>
            <input type="file" id="file-input-inner-${safeOrderId}" accept="image/*" multiple class="hidden">
            <input type="file" id="replace-file-input-${safeOrderId}" accept="image/*" class="hidden">
          </div>

          ${innerFiles.length > 0 ? `
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[360px] overflow-y-auto p-1">
              ${innerFiles.map((file, idx) => `
                <div class="relative group bg-gray-50 rounded-xl overflow-hidden border border-gray-200 aspect-square shadow-2xs flex flex-col">
                  <img src="${getFileObjectUrl(file)}" class="w-full h-full object-cover" alt="Inner Photo ${idx + 1}">
                  <div class="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs p-1 text-center">
                    <span class="text-white text-[10px] font-bold">Page ${idx + 2}</span>
                  </div>
                  ${!isUploading ? `
                    <div class="absolute top-1.5 right-1.5 flex gap-1">
                      <button type="button" data-action="replace-inner" data-index="${idx}" class="w-6 h-6 rounded-full bg-white/90 text-gray-700 hover:text-primary hover:bg-white flex items-center justify-center text-[10px] shadow-sm transition-colors cursor-pointer" title="Replace">
                        <i class="fa-solid fa-arrows-rotate"></i>
                      </button>
                      <button type="button" data-action="remove-inner" data-index="${idx}" class="w-6 h-6 rounded-full bg-white/90 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center text-[10px] shadow-sm transition-colors cursor-pointer" title="Remove">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Overall Summary & Status -->
        <div class="p-3.5 rounded-xl ${countMatches ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-pink-50 border border-pink-200 text-pink-900'} flex items-center justify-between text-xs font-bold">
          <span>Total: ${totalCount} / Allowed: ${isRange ? `${minPhotos}–${maxPhotos}` : maxPhotos} Photos</span>
          <span>${validationMessage}</span>
        </div>

        ${isUploading ? `
          <div class="space-y-2 bg-pink-50/50 p-4 rounded-xl border border-pink-100">
            <div class="flex justify-between text-xs font-bold text-[#2A2A2A]">
              <span>${escapeHtml(statusText)}</span>
              <span class="text-primary font-bold">${overallProgress}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div class="bg-[#C97B5F] h-3 rounded-full transition-all duration-300" style="width: ${overallProgress}%"></div>
            </div>
          </div>
        ` : ''}

        ${errorMessage ? `
          <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed font-medium">
            ${escapeHtml(errorMessage)}
          </div>
        ` : ''}

        <button type="button" id="upload-btn-${safeOrderId}" ${countMatches && !isUploading ? '' : 'disabled'} class="w-full py-3.5 bg-[#C97B5F] hover:bg-[#8B4A38] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center" style="background-color: ${countMatches && !isUploading ? '#C97B5F' : '#d1d5db'} !important; color: #ffffff !important;">
          ${isUploading ? 'Uploading Photos...' : btnText}
        </button>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const inputCover = container.querySelector(`#input-cover-${safeOrderId}`);
    const inputBack = container.querySelector(`#input-back-${safeOrderId}`);
    const zoneCover = container.querySelector(`#zone-cover-${safeOrderId}`);
    const zoneBack = container.querySelector(`#zone-back-${safeOrderId}`);
    const btnReplaceCover = container.querySelector(`#btn-replace-cover-${safeOrderId}`);
    const btnRemoveCover = container.querySelector(`#btn-remove-cover-${safeOrderId}`);
    const btnReplaceBack = container.querySelector(`#btn-replace-back-${safeOrderId}`);
    const btnRemoveBack = container.querySelector(`#btn-remove-back-${safeOrderId}`);

    const dropZoneInner = container.querySelector(`#drop-zone-inner-${safeOrderId}`);
    const fileInputInner = container.querySelector(`#file-input-inner-${safeOrderId}`);
    const replaceInput = container.querySelector(`#replace-file-input-${safeOrderId}`);
    const uploadBtn = container.querySelector(`#upload-btn-${safeOrderId}`);

    // Cover page triggers
    if (zoneCover && inputCover && !isUploading) {
      zoneCover.addEventListener('click', () => inputCover.click());
    }
    if (btnReplaceCover && inputCover && !isUploading) {
      btnReplaceCover.addEventListener('click', () => inputCover.click());
    }
    if (btnRemoveCover && !isUploading) {
      btnRemoveCover.addEventListener('click', () => {
        if (coverFile?._objectUrl) URL.revokeObjectURL(coverFile._objectUrl);
        coverFile = null;
        errorMessage = '';
        render();
      });
    }
    if (inputCover && !isUploading) {
      inputCover.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const f = e.target.files[0];
          if (f.type.startsWith('image/')) {
            if (coverFile?._objectUrl) URL.revokeObjectURL(coverFile._objectUrl);
            coverFile = f;
            errorMessage = '';
            render();
          }
          inputCover.value = '';
        }
      });
    }

    // Back page triggers
    if (zoneBack && inputBack && !isUploading) {
      zoneBack.addEventListener('click', () => inputBack.click());
    }
    if (btnReplaceBack && inputBack && !isUploading) {
      btnReplaceBack.addEventListener('click', () => inputBack.click());
    }
    if (btnRemoveBack && !isUploading) {
      btnRemoveBack.addEventListener('click', () => {
        if (backFile?._objectUrl) URL.revokeObjectURL(backFile._objectUrl);
        backFile = null;
        errorMessage = '';
        render();
      });
    }
    if (inputBack && !isUploading) {
      inputBack.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const f = e.target.files[0];
          if (f.type.startsWith('image/')) {
            if (backFile?._objectUrl) URL.revokeObjectURL(backFile._objectUrl);
            backFile = f;
            errorMessage = '';
            render();
          }
          inputBack.value = '';
        }
      });
    }

    // Inner photos triggers
    if (dropZoneInner && fileInputInner && !isUploading) {
      dropZoneInner.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        fileInputInner.click();
      });

      fileInputInner.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleInnerFilesAdd(e.target.files);
          fileInputInner.value = '';
        }
      });

      dropZoneInner.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZoneInner.classList.add('border-primary', 'bg-pink-100/50');
      });

      dropZoneInner.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZoneInner.classList.remove('border-primary', 'bg-pink-100/50');
      });

      dropZoneInner.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZoneInner.classList.remove('border-primary', 'bg-pink-100/50');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleInnerFilesAdd(e.dataTransfer.files);
        }
      });
    }

    // Replace inner photo trigger
    if (replaceInput && !isUploading) {
      replaceInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0 && replaceTargetIndex !== null) {
          const newFile = e.target.files[0];
          if (newFile.type.startsWith('image/')) {
            if (innerFiles[replaceTargetIndex] && innerFiles[replaceTargetIndex]._objectUrl) {
              URL.revokeObjectURL(innerFiles[replaceTargetIndex]._objectUrl);
            }
            innerFiles[replaceTargetIndex] = newFile;
            errorMessage = '';
            render();
          }
          replaceInput.value = '';
          replaceTargetIndex = null;
        }
      });
    }

    // Inner photo action buttons
    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const idx = Number(btn.getAttribute('data-index'));

        if (action === 'remove-inner') {
          if (innerFiles[idx] && innerFiles[idx]._objectUrl) {
            URL.revokeObjectURL(innerFiles[idx]._objectUrl);
          }
          innerFiles.splice(idx, 1);
          errorMessage = '';
          render();
        } else if (action === 'replace-inner') {
          replaceTargetIndex = idx;
          replaceInput?.click();
        }
      });
    });

    if (uploadBtn && !isUploading) {
      uploadBtn.addEventListener('click', () => {
        if (typeof options.onBeforeUpload === 'function') {
          const canProceed = options.onBeforeUpload();
          if (canProceed === false) return;
        }
        const total = getTotalCount();
        if (coverFile && backFile && total >= minPhotos && total <= maxPhotos) {
          startUploadProcess();
        }
      });
    }
  }

  function handleInnerFilesAdd(newFilesList) {
    const validFiles = Array.from(newFilesList).filter(f => f.type.startsWith('image/'));
    const maxInnerSlots = maxPhotos - (coverFile ? 1 : 0) - (backFile ? 1 : 0);
    const remainingSlots = maxInnerSlots - innerFiles.length;
    if (remainingSlots <= 0) {
      errorMessage = `Maximum limit reached: You can upload at most ${maxPhotos} total photos.`;
      render();
      return;
    }

    const filesToAdd = validFiles.slice(0, remainingSlots);
    innerFiles = [...innerFiles, ...filesToAdd];
    errorMessage = '';
    render();
  }

  async function uploadSingleFile(file, category, index, mainOrderId) {
    if (typeof file === 'string' && file.startsWith('http')) {
      return file;
    }

    const fileExt = file.name ? file.name.split('.').pop().toLowerCase() : 'jpg';
    let safeFilename = '';
    if (category === 'cover') {
      safeFilename = `cover_page.${fileExt}`;
    } else if (category === 'back') {
      safeFilename = `back_page.${fileExt}`;
    } else {
      const padNum = String(index + 1).padStart(2, '0');
      safeFilename = `inner_pages/page_${padNum}.${fileExt}`;
    }

    // 1. Primary: Cloudinary direct upload (matches Admin Dashboard service)
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'memory-remains');
      formData.append('folder', 'memory_remains');

      const cldRes = await fetch('https://api.cloudinary.com/v1_1/cmpl84gp/image/upload', {
        method: 'POST',
        body: formData
      });

      if (cldRes.ok) {
        const cldData = await cldRes.json();
        if (cldData.secure_url || cldData.url) {
          return cldData.secure_url || cldData.url;
        }
      } else {
        const errJson = await cldRes.json().catch(() => ({}));
        console.warn('Cloudinary upload response not ok:', errJson);
      }
    } catch (cldErr) {
      console.warn('Cloudinary upload error, falling back to Firebase Storage:', cldErr);
    }

    // 2. Secondary: Firebase Storage Upload
    try {
      const { storage } = getFirebaseServices();
      if (storage) {
        const storagePath = `orders/${mainOrderId}/${safeFilename}`;
        const storageRef = storage.ref(storagePath);
        const uploadSnapshot = await storageRef.put(file);
        const downloadUrl = await uploadSnapshot.ref.getDownloadURL();
        if (downloadUrl) return downloadUrl;
      }
    } catch (fbErr) {
      console.warn('Firebase Storage upload error, falling back to data URL:', fbErr);
    }

    // 3. Fallback: High-quality Compressed Data URL so customer is never blocked
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(readerEvent.target.result);
        img.src = readerEvent.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function startUploadProcess() {
    isUploading = true;
    errorMessage = '';
    statusText = 'Preparing photos for upload...';
    overallProgress = 0;
    render();

    let mainOrderId = orderId;
    if (typeof orderId === 'string' && orderId.startsWith('ORD-')) {
      const parts = orderId.split('-');
      if (parts.length >= 2) {
        mainOrderId = `${parts[0]}-${parts[1]}`;
      }
    }

    const totalToUpload = 2 + innerFiles.length; // Cover + Back + Inners
    let completedCount = 0;

    let coverUrl = '';
    let backUrl = '';
    const innerUrls = [];

    try {
      // 1. Upload Cover Page
      statusText = `Uploading Front Cover photo (1 of ${totalToUpload})...`;
      overallProgress = Math.round((completedCount / totalToUpload) * 100);
      render();
      coverUrl = await uploadSingleFile(coverFile, 'cover', 0, mainOrderId);
      completedCount++;

      // 2. Upload Back Page
      statusText = `Uploading Back Cover photo (2 of ${totalToUpload})...`;
      overallProgress = Math.round((completedCount / totalToUpload) * 100);
      render();
      backUrl = await uploadSingleFile(backFile, 'back', 1, mainOrderId);
      completedCount++;

      // 3. Upload Inner Photos
      for (let i = 0; i < innerFiles.length; i++) {
        statusText = `Uploading Inner Page photo ${i + 1} of ${innerFiles.length} (${completedCount + 1} of ${totalToUpload})...`;
        overallProgress = Math.round((completedCount / totalToUpload) * 100);
        render();

        const url = await uploadSingleFile(innerFiles[i], 'inner', i, mainOrderId);
        innerUrls.push(url);
        completedCount++;
      }

      overallProgress = 100;
      statusText = 'Saving details...';
      render();

      const allUploadedUrls = [coverUrl, backUrl, ...innerUrls];
      const recInput = document.getElementById(`recipient-input-${safeOrderId}`);
      const recName = recInput ? recInput.value.trim() : (options.recipientName || '');

      // Update Firestore Record if existing order in DB
      const { db } = getFirebaseServices();
      if (db && mainOrderId && !mainOrderId.startsWith('TEMP-')) {
        try {
          const docRef = db.collection('purchases').doc(mainOrderId);
          const docSnap = await docRef.get();

          if (docSnap.exists) {
            const docData = docSnap.data();
            let itemsList = Array.isArray(docData.items) ? [...docData.items] : [];

            if (itemsList.length > 0) {
              const targetIdx = options.itemIndex !== undefined && options.itemIndex !== null
                  ? options.itemIndex
                  : itemsList.findIndex(it => it.item_id === options.itemId || it.template_id === options.templateId);

              if (targetIdx >= 0 && targetIdx < itemsList.length) {
                itemsList[targetIdx].photos_uploaded = true;
                itemsList[targetIdx].photosUploaded = true;
                itemsList[targetIdx].photo_urls = allUploadedUrls;
                itemsList[targetIdx].imageUrls = allUploadedUrls;
                itemsList[targetIdx].cover_url = coverUrl;
                itemsList[targetIdx].cover_photo_url = coverUrl;
                itemsList[targetIdx].back_url = backUrl;
                itemsList[targetIdx].back_photo_url = backUrl;
                itemsList[targetIdx].inner_urls = innerUrls;
                itemsList[targetIdx].inner_photo_urls = innerUrls;
                if (recName) {
                  itemsList[targetIdx].recipient_name = recName;
                  itemsList[targetIdx].recipientName = recName;
                }
              }
            }

            const allMagazinesUploaded = itemsList.length === 0 || itemsList.every(it => it.product_type !== 'magazine' || it.photos_uploaded || it.photosUploaded);

            await docRef.set({
              items: itemsList.length > 0 ? itemsList : docData.items,
              photos_uploaded: allMagazinesUploaded,
              photosUploaded: allMagazinesUploaded,
              cover_url: coverUrl,
              cover_photo_url: coverUrl,
              back_url: backUrl,
              back_photo_url: backUrl,
              inner_urls: innerUrls,
              inner_photo_urls: innerUrls,
              imageUrls: allUploadedUrls,
              photo_urls: allUploadedUrls,
              recipient_name: recName || docData.recipient_name || '',
              updated_at: new Date().toISOString()
            }, { merge: true });
          }
        } catch (dbUpdateErr) {
          console.warn('Firestore update in photo-upload notice:', dbUpdateErr);
        }
      }

      isUploading = false;
      isComplete = true;
      statusText = 'Upload completed!';
      render();

      cleanupObjectUrls();

      if (typeof onSuccess === 'function') {
        onSuccess({
          coverUrl,
          backUrl,
          innerUrls,
          allUrls: allUploadedUrls,
          recipientName: recName,
          totalPhotos: allUploadedUrls.length
        });
      }
    } catch (err) {
      console.error('Photo upload process failed:', err);
      isUploading = false;
      errorMessage = mapUploadError(err.message);
      render();
    }
  }

  render();
}
