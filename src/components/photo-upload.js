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
  let isComplete = Boolean(options.photosUploaded);
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
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 p-5 rounded-xl border border-emerald-200 text-center space-y-2 shadow-sm">
          <div class="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-lg mx-auto">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <h4 class="font-heading text-base font-bold text-emerald-950 mb-0.5">✅ Photos Received</h4>
            <p class="text-xs text-emerald-700">Your magazine is being prepared by our design team.</p>
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

        <div class="space-y-1.5 text-left">
          <label for="recipient-input-${safeOrderId}" class="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <i class="fa-solid fa-user-pen text-pink-500"></i> Recipient / Person Name <span class="text-gray-400 font-normal">(Optional — e.g. For Samiul, Birthday Special)</span>
          </label>
          <input type="text" id="recipient-input-${safeOrderId}" placeholder="e.g. For Samiul, For Mim..." 
                 class="w-full text-xs px-3.5 py-2.5 rounded-xl border border-pink-200 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all font-body bg-pink-50/20"
                 value="${options.recipientName || ''}">
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
              <div class="bg-[#C97B5F] h-3 rounded-full transition-all duration-300" style="width: ${overallProgress}%"></div>
            </div>
          </div>
        ` : ''}

        ${errorMessage ? `
          <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed font-medium">
            ${escapeHtml(errorMessage)}
          </div>
        ` : ''}

        <button type="button" id="upload-btn-${safeOrderId}" ${countMatches && !isUploading ? '' : 'disabled'} class="w-full py-3.5 bg-[#C97B5F] hover:bg-[#8B4A38] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer text-center">
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

    let mainOrderId = orderId;
    if (typeof orderId === 'string' && orderId.startsWith('ORD-')) {
      const parts = orderId.split('-');
      if (parts.length >= 2) {
        mainOrderId = `${parts[0]}-${parts[1]}`;
      }
    }

    const uploadedUrls = [];
    const totalFiles = selectedFiles.length;

    for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
      const file = selectedFiles[fileIndex];
      statusText = `Uploading photo ${fileIndex + 1} of ${totalFiles}...`;
      overallProgress = Math.round((fileIndex / totalFiles) * 100);
      render();

      let fileSuccess = false;
      let lastErrMessage = '';

      // Direct Cloudinary upload using unsigned preset memory-remains
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'memory-remains');
        formData.append('folder', `orders/${mainOrderId}`);

        const cldRes = await fetch('https://api.cloudinary.com/v1_1/cmpl84gp/image/upload', {
          method: 'POST',
          body: formData
        });

        if (cldRes.ok) {
          const cldData = await cldRes.json();
          if (cldData.secure_url) {
            uploadedUrls.push(cldData.secure_url);
            fileSuccess = true;
          }
        } else {
          const cldErr = await cldRes.json().catch(() => ({}));
          lastErrMessage = cldErr.error?.message || `Cloudinary status ${cldRes.status}`;
        }
      } catch (err) {
        lastErrMessage = err.message;
      }

      // Fallback to chunk upload if direct Cloudinary fails
      if (!fileSuccess) {
        try {
          const formData = new FormData();
          formData.append('order_id', mainOrderId);
          formData.append('upload_index', fileIndex);
          formData.append('chunk_index', 0);
          formData.append('total_chunks', 1);
          formData.append('file', file, file.name);

          const chunkRes = await fetch(`${API_BASE}/upload-photos/chunk`, {
            method: 'POST',
            body: formData
          });

          if (chunkRes.ok) {
            const chunkData = await chunkRes.json();
            if (chunkData.url) uploadedUrls.push(chunkData.url);
            fileSuccess = true;
          } else {
            const errData = await chunkRes.json().catch(() => ({}));
            lastErrMessage = errData.detail || errData.message || `API status ${chunkRes.status}`;
          }
        } catch (apiErr) {
          lastErrMessage = apiErr.message;
        }
      }

      if (!fileSuccess) {
        isUploading = false;
        errorMessage = mapUploadError(lastErrMessage);
        render();
        return;
      }
    }

    isUploading = false;
    isComplete = true;
    overallProgress = 100;
    statusText = 'Upload completed!';
    render();

    try {
      const { db } = getFirebaseServices();
      if (db && mainOrderId) {
        const docRef = db.collection('purchases').doc(mainOrderId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          const docData = docSnap.data();
          let itemsList = Array.isArray(docData.items) ? [...docData.items] : [];

          if (itemsList.length > 0) {
            const targetIdx = options.itemIndex !== undefined && options.itemIndex !== null
                ? options.itemIndex
                : itemsList.findIndex(it => it.item_id === options.itemId || it.template_id === options.templateId);

            const recInput = document.getElementById(`recipient-input-${safeOrderId}`);
            const recName = recInput ? recInput.value.trim() : '';

            if (targetIdx >= 0 && targetIdx < itemsList.length) {
              itemsList[targetIdx].photos_uploaded = true;
              itemsList[targetIdx].photosUploaded = true;
              itemsList[targetIdx].photo_urls = uploadedUrls;
              itemsList[targetIdx].imageUrls = uploadedUrls;
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
            imageUrls: uploadedUrls.length > 0 ? uploadedUrls : (docData.imageUrls || []),
            updated_at: new Date().toISOString()
          }, { merge: true });
        } else {
          await docRef.set({
            photos_uploaded: true,
            photosUploaded: true,
            imageUrls: uploadedUrls,
            updated_at: new Date().toISOString()
          }, { merge: true });
        }
      }
    } catch (fsErr) {
      console.warn('Error updating Firestore upload status:', fsErr);
    }

    cleanupObjectUrls();

    if (typeof onSuccess === 'function') {
      onSuccess();
    }
  }

  render();
}
