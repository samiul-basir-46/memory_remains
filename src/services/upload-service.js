import { getFirebaseServices } from './firebase-service.js';
import { compressImageFile, computeFileSignature } from '../utils/cloudinary.js';
import { createToast, qs } from '../utils/ui.js';

const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/cmpl84gp/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'memory-remains';

let uploadState = {
  selectedFiles: [],
  currentPurchaseId: '',
  currentTargetCount: 0
};

// In-memory signature → URL cache to avoid Firestore reads for the same image
const _signatureCache = new Map();

export function openUploadModal(purchaseId, targetCount = 40) {
  const modal = qs('#photo-upload-modal');
  const overlay = qs('#upload-modal-overlay');
  if (!modal || !overlay) return;

  uploadState.currentPurchaseId = purchaseId;
  uploadState.currentTargetCount = targetCount;
  uploadState.selectedFiles = [];

  const desc = qs('#upload-modal-desc');
  if (desc) desc.textContent = `Please select up to ${targetCount} photos for your order.`;

  renderSelectedFilesPreview();

  modal.classList.add('is-open');
  overlay.classList.add('is-open');
}

export function closeUploadModal() {
  const modal = qs('#photo-upload-modal');
  const overlay = qs('#upload-modal-overlay');
  if (!modal || !overlay) return;

  modal.classList.remove('is-open');
  overlay.classList.remove('is-open');
}

function renderSelectedFilesPreview() {
  const previewContainer = qs('#upload-files-preview');
  const countDisplay = qs('#upload-selected-count');
  const submitBtn = qs('#start-upload-btn');

  if (countDisplay) {
    countDisplay.textContent = `${uploadState.selectedFiles.length} / ${uploadState.currentTargetCount} selected`;
  }

  if (submitBtn) {
    submitBtn.disabled = uploadState.selectedFiles.length === 0;
  }

  if (!previewContainer) return;

  if (uploadState.selectedFiles.length === 0) {
    previewContainer.innerHTML = '<p style="color: #999; text-align: center; margin: 1.5rem 0;">No photos selected yet.</p>';
    return;
  }

  previewContainer.innerHTML = uploadState.selectedFiles.map((file, idx) => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: #f9f9f9; border-radius: 6px; margin-bottom: 0.5rem;">
      <span style="font-size: 0.85rem; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${file.name}</span>
      <button type="button" data-remove-idx="${idx}" style="background: none; border: none; color: #d82b58; cursor: pointer; font-size: 1rem;">&times;</button>
    </div>
  `).join('');

  previewContainer.querySelectorAll('button[data-remove-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.removeIdx, 10);
      uploadState.selectedFiles.splice(idx, 1);
      renderSelectedFilesPreview();
    });
  });
}

export function initUploadModalEvents() {
  const overlay = qs('#upload-modal-overlay');
  const closeBtn = qs('#upload-modal-close-btn');
  const fileInput = qs('#photo-file-input');
  const selectBtn = qs('#select-photos-btn');
  const submitBtn = qs('#start-upload-btn');

  overlay?.addEventListener('click', closeUploadModal);
  closeBtn?.addEventListener('click', closeUploadModal);

  selectBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    uploadState.selectedFiles = [...uploadState.selectedFiles, ...files].slice(0, uploadState.currentTargetCount);
    renderSelectedFilesPreview();
  });

  submitBtn?.addEventListener('click', async () => {
    if (!uploadState.selectedFiles.length || !uploadState.currentPurchaseId) return;

    const { db, auth } = getFirebaseServices();
    const progressText = qs('#upload-progress-text');
    const user = auth?.currentUser;

    submitBtn.disabled = true;
    if (progressText) progressText.textContent = 'Preparing photos...';

    try {
      const allFiles = uploadState.selectedFiles;
      const uploadedUrls = new Array(allFiles.length);
      const CHUNK_SIZE = 3; // Upload 3 at a time to avoid memory spikes

      for (let chunkStart = 0; chunkStart < allFiles.length; chunkStart += CHUNK_SIZE) {
        const chunk = allFiles.slice(chunkStart, chunkStart + CHUNK_SIZE);
        if (progressText) {
          progressText.textContent = `Uploading ${Math.min(chunkStart + CHUNK_SIZE, allFiles.length)} of ${allFiles.length} photos...`;
        }

        await Promise.all(chunk.map(async (file, localIdx) => {
          const globalIdx = chunkStart + localIdx;
          const compressed = await compressImageFile(file);
          const signature = await computeFileSignature(compressed.file ?? compressed);

          // 1. Check in-memory cache first (zero Firestore reads for duplicates)
          if (_signatureCache.has(signature)) {
            uploadedUrls[globalIdx] = _signatureCache.get(signature);
            return;
          }

          // 2. Check Firestore only if not in memory cache
          let imageUrl = '';
          if (db) {
            try {
              const snap = await db.collection('cloudinary_assets')
                .where('signature', '==', signature).limit(1).get();
              if (!snap.empty) {
                imageUrl = snap.docs[0].data().secureUrl;
                _signatureCache.set(signature, imageUrl);
              }
            } catch (_) {}
          }

          // 3. Upload to Cloudinary if not found anywhere
          if (!imageUrl) {
            const formData = new FormData();
            formData.append('file', compressed.file ?? compressed);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Cloudinary upload failed');
            const data = await res.json();
            imageUrl = data.secure_url;

            // Save to Firestore + memory cache for future sessions
            _signatureCache.set(signature, imageUrl);
            if (db && data.public_id) {
              db.collection('cloudinary_assets').doc(data.public_id).set({
                publicId: data.public_id,
                secureUrl: data.secure_url,
                signature,
                uploadedBy: user?.uid || 'guest',
                uploadedAt: new Date()
              }, { merge: true }).catch(() => {});
            }
          }

          uploadedUrls[globalIdx] = imageUrl;
        }));
      }

      if (db && uploadState.currentPurchaseId) {
        await db.collection('purchases').doc(uploadState.currentPurchaseId).update({
          imageUrls: uploadedUrls.filter(Boolean),
          status: 'Photos Received',
          updatedAt: new Date()
        });
      }

      createToast('Photos uploaded successfully!');
      closeUploadModal();
      window.location.reload();
    } catch (err) {
      console.error('Photo upload failed:', err);
      createToast('Upload failed. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      if (progressText) progressText.textContent = '';
    }
  });
}
