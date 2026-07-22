import { escapeHtml } from '../utils/ui.js';
import { getFirebaseServices } from '../services/firebase-service.js';

const API_BASE = "https://bkash-sms-gateway.onrender.com";
const CHUNK_SIZE = 5 * 1024 * 1024;

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

  const orderId = options.orderId || '';
  const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '');
  const requiredPhotoCount = Number(options.requiredPhotoCount || 10);
  const onSuccess = options.onSuccess;

  let selectedFiles = [];
  let isUploading = false;
  let isComplete = false;
  let statusText = '';
  let errorMessage = '';
  let overallProgress = 0;
  let replaceTargetIndex = null;

  function cleanupObjectUrls() {
    selectedFiles.forEach(f => {
      if (f._objectUrl) {
        URL.revokeObjectURL(f._objectUrl);
        delete f._objectUrl;
      }
    });
  }

  function getFileObjectUrl(file) {
    if (!file._objectUrl) {
      file._objectUrl = URL.createObjectURL(file);
    }
    return file._objectUrl;
  }

  function render() {
    if (isComplete) {
      container.innerHTML = `
        <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl text-center space-y-4">
          <div class="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-500 rounded-full flex items-center justify-center text-2xl mx-auto shadow-sm">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <h3 class="font-heading text-xl font-bold text-emerald-900 mb-1">✅ Photos uploaded successfully!</h3>
            <p class="text-sm text-emerald-700">Your magazine is being prepared.</p>
          </div>
        </div>
      `;
      return;
    }

    const countMatches = selectedFiles.length === requiredPhotoCount;

    container.innerHTML = `
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-pink-100 shadow-xl space-y-6">
        <div>
          <h3 class="font-heading text-2xl text-[#2A2A2A] font-bold mb-1">Upload Your Photos</h3>
          <p class="text-sm text-text-soft">This template requires exactly <strong class="text-primary font-bold">${requiredPhotoCount}</strong> photos</p>
        </div>

        <div id="drop-zone-${safeOrderId}" class="border-2 border-dashed border-pink-300/80 hover:border-primary bg-pink-50/40 hover:bg-pink-50/70 p-6 md:p-8 rounded-2xl text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3">
          <div class="w-12 h-12 rounded-full bg-pink-100 text-primary flex items-center justify-center text-xl mb-1">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
          <p class="text-sm font-semibold text-[#2A2A2A]">Drag & drop photos here, or <span class="text-primary underline font-bold">browse</span></p>
          <p class="text-xs text-text-soft">Supports high-res images (JPEG, PNG, WEBP)</p>
          <input type="file" id="file-input-${safeOrderId}" accept="image/*" multiple class="hidden">
          <input type="file" id="replace-file-input-${safeOrderId}" accept="image/*" class="hidden">
        </div>

        <div class="flex items-center justify-between text-xs font-bold ${countMatches ? 'text-emerald-600' : 'text-[#2A2A2A]'} border-b border-pink-100 pb-2">
          <span>${selectedFiles.length} of ${requiredPhotoCount} photos selected</span>
          <span>${countMatches ? '✓ Ready to upload' : `Need ${requiredPhotoCount - selectedFiles.length} more`}</span>
        </div>

        ${selectedFiles.length > 0 ? `
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            ${selectedFiles.map((file, idx) => `
              <div class="relative group bg-gray-50 rounded-xl overflow-hidden border border-gray-200 aspect-square shadow-sm flex flex-col">
                <img src="${getFileObjectUrl(file)}" class="w-full h-full object-cover" alt="Photo ${idx + 1}">
                <div class="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1.5 text-center">
                  <span class="text-white text-[11px] font-bold">Photo ${idx + 1}</span>
                </div>
                ${!isUploading ? `
                  <div class="absolute top-2 right-2 flex gap-1">
                    <button type="button" data-action="replace" data-index="${idx}" class="w-7 h-7 rounded-full bg-white/90 text-gray-700 hover:text-primary hover:bg-white flex items-center justify-center text-xs shadow-md transition-colors cursor-pointer" title="Replace Photo">
                      <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                    <button type="button" data-action="remove" data-index="${idx}" class="w-7 h-7 rounded-full bg-white/90 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center text-xs shadow-md transition-colors cursor-pointer" title="Remove Photo">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${isUploading ? `
          <div class="space-y-2 bg-pink-50/50 p-4 rounded-xl border border-pink-100">
            <div class="flex justify-between text-xs font-bold text-[#2A2A2A]">
              <span>${escapeHtml(statusText)}</span>
              <span class="text-primary font-bold">${overallProgress}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div class="bg-[#DC3C71] h-3 rounded-full transition-all duration-300" style="width: ${overallProgress}%"></div>
            </div>
          </div>
        ` : ''}

        ${errorMessage ? `
          <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed font-medium">
            ${escapeHtml(errorMessage)}
          </div>
        ` : ''}

        <button type="button" id="upload-btn-${safeOrderId}" ${countMatches && !isUploading ? '' : 'disabled'} class="w-full py-3.5 bg-[#DC3C71] hover:bg-[#c23260] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center">
          ${isUploading ? 'Uploading Photos...' : 'Upload Photos'}
        </button>
      </div>
    `;

    attachEvents();
  }

  function handleFileAdd(newFilesList) {
    const validFiles = Array.from(newFilesList).filter(f => f.type.startsWith('image/'));
    const remainingSlots = requiredPhotoCount - selectedFiles.length;
    if (remainingSlots <= 0) return;

    const filesToAdd = validFiles.slice(0, remainingSlots);
    selectedFiles = [...selectedFiles, ...filesToAdd];
    errorMessage = '';
    render();
  }

  function attachEvents() {
    const dropZone = container.querySelector(`#drop-zone-${safeOrderId}`);
    const fileInput = container.querySelector(`#file-input-${safeOrderId}`);
    const replaceInput = container.querySelector(`#replace-file-input-${safeOrderId}`);
    const uploadBtn = container.querySelector(`#upload-btn-${safeOrderId}`);

    if (dropZone && fileInput && !isUploading) {
      dropZone.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFileAdd(e.target.files);
          fileInput.value = '';
        }
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary', 'bg-pink-100/50');
      });

      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-pink-100/50');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-pink-100/50');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileAdd(e.dataTransfer.files);
        }
      });
    }

    if (replaceInput && !isUploading) {
      replaceInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0 && replaceTargetIndex !== null) {
          const newFile = e.target.files[0];
          if (newFile.type.startsWith('image/')) {
            if (selectedFiles[replaceTargetIndex] && selectedFiles[replaceTargetIndex]._objectUrl) {
              URL.revokeObjectURL(selectedFiles[replaceTargetIndex]._objectUrl);
            }
            selectedFiles[replaceTargetIndex] = newFile;
            errorMessage = '';
            render();
          }
          replaceInput.value = '';
          replaceTargetIndex = null;
        }
      });
    }

    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const idx = Number(btn.getAttribute('data-index'));

        if (action === 'remove') {
          if (selectedFiles[idx] && selectedFiles[idx]._objectUrl) {
            URL.revokeObjectURL(selectedFiles[idx]._objectUrl);
          }
          selectedFiles.splice(idx, 1);
          errorMessage = '';
          render();
        } else if (action === 'replace') {
          replaceTargetIndex = idx;
          replaceInput?.click();
        }
      });
    });

    if (uploadBtn && !isUploading) {
      uploadBtn.addEventListener('click', () => {
        if (selectedFiles.length === requiredPhotoCount) {
          startUploadProcess();
        }
      });
    }
  }

  async function startUploadProcess() {
    isUploading = true;
    errorMessage = '';
    statusText = 'Initializing upload...';
    overallProgress = 0;
    render();

    try {
      const initRes = await fetch(`${API_BASE}/upload-photos/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          file_count: selectedFiles.length,
          file_names: selectedFiles.map(f => f.name)
        })
      });

      if (!initRes.ok) {
        let detail = '';
        try {
          const errData = await initRes.json();
          detail = errData.detail || errData.message || errData.error;
        } catch (e) {}
        throw new Error(detail || `HTTP ${initRes.status}`);
      }

      await initRes.json();
    } catch (initErr) {
      isUploading = false;
      errorMessage = mapUploadError(initErr.message);
      render();
      return;
    }

    const fileChunkCounts = selectedFiles.map(f => Math.max(1, Math.ceil(f.size / CHUNK_SIZE)));
    const totalChunksSum = fileChunkCounts.reduce((acc, val) => acc + val, 0);
    let completedChunksGlobal = 0;

    for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex++) {
      const file = selectedFiles[fileIndex];
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append('order_id', orderId);
        formData.append('upload_index', fileIndex);
        formData.append('chunk_index', chunkIndex);
        formData.append('total_chunks', totalChunks);
        formData.append('file', chunkBlob, file.name);

        statusText = `Uploading photo ${fileIndex + 1} of ${selectedFiles.length}... (${chunkIndex + 1}/${totalChunks} parts)`;
        overallProgress = Math.min(99, Math.round((completedChunksGlobal / totalChunksSum) * 100));
        render();

        let chunkSuccess = false;
        let maxRetries = 3;
        let lastErrDetail = '';

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (attempt > 0) {
            statusText = `Upload paused — Retrying... (Attempt ${attempt}/${maxRetries})`;
            render();
            await new Promise(r => setTimeout(r, 1500));
          }

          try {
            const chunkRes = await fetch(`${API_BASE}/upload-photos/chunk`, {
              method: 'POST',
              body: formData
            });

            if (!chunkRes.ok) {
              let detail = '';
              try {
                const errData = await chunkRes.json();
                detail = errData.detail || errData.message || errData.error;
              } catch (e) {}
              lastErrDetail = detail || `HTTP ${chunkRes.status}`;
              continue;
            }

            const chunkData = await chunkRes.json();
            chunkSuccess = true;
            completedChunksGlobal++;
            overallProgress = Math.min(100, Math.round((completedChunksGlobal / totalChunksSum) * 100));

            if (fileIndex === selectedFiles.length - 1 && chunkIndex === totalChunks - 1 && chunkData.all_complete) {
              
            }
            break;
          } catch (fetchErr) {
            lastErrDetail = fetchErr.message;
          }
        }

        if (!chunkSuccess) {
          isUploading = false;
          errorMessage = mapUploadError(lastErrDetail);
          render();
          return;
        }
      }
    }

    isUploading = false;
    isComplete = true;
    overallProgress = 100;
    statusText = 'Upload completed!';
    render();

    try {
      const { db } = getFirebaseServices();
      if (db && orderId) {
        await db.collection('purchases').doc(orderId).set({
          photos_uploaded: true,
          photosUploaded: true,
          updated_at: new Date().toISOString()
        }, { merge: true });
      }
    } catch (fsErr) {}

    cleanupObjectUrls();

    if (typeof onSuccess === 'function') {
      onSuccess();
    }
  }

  render();
}
