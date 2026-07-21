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
    if (progressText) progressText.textContent = 'Uploading photos...';

    try {
      const uploadedUrls = [];

      for (let i = 0; i < uploadState.selectedFiles.length; i++) {
        const file = uploadState.selectedFiles[i];
        if (progressText) progressText.textContent = `Uploading photo ${i + 1} of ${uploadState.selectedFiles.length}...`;

        const compressed = await compressImageFile(file);
        const signature = await computeFileSignature(compressed);

        let imageUrl = '';

        if (db) {
          const snapshot = await db.collection('cloudinary_assets').where('signature', '==', signature).limit(1).get();
          if (!snapshot.empty) {
            imageUrl = snapshot.docs[0].data().secureUrl;
          }
        }

        if (!imageUrl) {
          const formData = new FormData();
          formData.append('file', compressed);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

          const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
          if (!res.ok) throw new Error('Cloudinary upload failed');
          const data = await res.json();
          imageUrl = data.secure_url;

          if (db && data.public_id) {
            await db.collection('cloudinary_assets').doc(data.public_id).set({
              publicId: data.public_id,
              secureUrl: data.secure_url,
              signature: signature,
              uploadedBy: user?.uid || 'guest',
              uploadedAt: new Date()
            }, { merge: true });
          }
        }

        uploadedUrls.push(imageUrl);
      }

      if (db && uploadState.currentPurchaseId) {
        await db.collection('purchases').doc(uploadState.currentPurchaseId).update({
          imageUrls: uploadedUrls,
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
