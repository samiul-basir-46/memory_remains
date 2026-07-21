import { fetchTemplates, DEFAULT_FEATURED_TEMPLATES } from '../services/templates-service.js';
import { openUploadModal } from '../services/upload-service.js';
import { imageMarkup } from '../components/product-card.js';
import { setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { createToast, escapeHtml, formatCurrency, qs } from '../utils/ui.js';

export async function submitTxnId(db, purchaseId, txnId) {
  if (!db || !purchaseId || !txnId) return;

  try {
    await db.collection('purchases').doc(purchaseId).update({
      transactionId: txnId.trim(),
      status: 'Payment Submitted',
      updatedAt: new Date()
    });
    createToast('Transaction ID submitted.');
    window.location.reload();
  } catch (err) {
    console.error('Failed to submit Txn ID:', err);
    createToast('Failed to submit Transaction ID', 'error');
  }
}

export async function loadUserLibrary(db, userEmail) {
  const container = qs('#library-orders-list');
  const emptyState = qs('#library-empty-state');
  if (!container) return;

  if (!db || !userEmail) {
    if (emptyState) emptyState.hidden = false;
    container.innerHTML = '';
    return;
  }

  try {
    const snapshot = await db.collection('purchases').where('userEmail', '==', userEmail).get();
    if (snapshot.empty) {
      if (emptyState) emptyState.hidden = false;
      container.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.hidden = true;

    const templatesList = await fetchTemplates(db);
    const templateMap = new Map((templatesList.length > 0 ? templatesList : DEFAULT_FEATURED_TEMPLATES).map((t) => [t.id, t]));

    const purchases = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    container.innerHTML = purchases.map((purchase) => {
      const template = templateMap.get(purchase.templateId) || templateMap.get(purchase.productName) || {};
      const imageUrl = purchase.imageUrl || template.imageUrl || '/assets/product_placeholder.png';
      const status = purchase.status || 'Pending Approval';
      const requiredCount = purchase.requiredImageCount || template.requiredImageCount || 40;
      const images = purchase.imageUrls || [];

      let actionSection = '';
      if (!purchase.transactionId) {
        actionSection = `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #eee;">
            <p style="font-size: 0.85rem; color: #666; margin-bottom: 0.5rem;">Enter UPI Transaction ID to confirm payment:</p>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" class="txn-input" id="txn-input-${purchase.id}" placeholder="e.g. 3214569870" style="flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #ccc; border-radius: 6px; font-size: 0.85rem;">
              <button type="button" class="btn-submit-txn pill-button" data-purchase-id="${purchase.id}" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Submit</button>
            </div>
          </div>
        `;
      } else if (status === 'Pending Photos' || images.length < requiredCount) {
        actionSection = `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #eee;">
            <p style="font-size: 0.85rem; color: #666; margin-bottom: 0.5rem;">${images.length}/${requiredCount} photos uploaded.</p>
            <button type="button" class="btn-open-uploader pill-button" data-purchase-id="${purchase.id}" data-required-count="${requiredCount}" style="padding: 0.5rem 1.25rem; font-size: 0.85rem; background: var(--color-primary); color: white;">Upload Photos</button>
          </div>
        `;
      } else if (purchase.canvaUrl || template.canvaUrl) {
        const canvaLink = purchase.canvaUrl || template.canvaUrl;
        actionSection = `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #eee;">
            <a href="${canvaLink}" target="_blank" rel="noopener noreferrer" class="pill-button" style="display: inline-block; padding: 0.5rem 1.25rem; font-size: 0.85rem; background: #00c4cc; color: white; text-decoration: none;">Access Canva Template</a>
          </div>
        `;
      }

      let badgeText = status;
      if (status === 'Pending Approval') badgeText = 'Pending Approval';
      if (status === 'Photos Received') badgeText = 'Photos Received';
      if (status === 'Completed') badgeText = 'Completed';

      return `
        <div style="background: white; border-radius: 12px; border: 1px solid #eee; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <div style="display: flex; gap: 1rem; align-items: flex-start;">
            <div style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; background: #f7f7f7; flex-shrink: 0;">
              ${imageMarkup(imageUrl, purchase.productName)}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                <h3 style="margin: 0 0 4px 0; font-size: 1.05rem; color: var(--color-primary);">${escapeHtml(purchase.productName || 'Template')}</h3>
                <span class="product-badge" style="position: static; padding: 0.2rem 0.5rem; font-size: 0.75rem;">${escapeHtml(badgeText)}</span>
              </div>
              <p style="margin: 0 0 6px 0; font-size: 0.9rem; font-weight: 600; color: #333;">${formatCurrency(purchase.amount || 0)}</p>
              <p style="margin: 0; font-size: 0.8rem; color: #888;">Order ID: ${purchase.id}</p>
            </div>
          </div>
          ${actionSection}
        </div>
      `;
    }).join('');

    setupLazyCloudinaryImages(container);

    container.querySelectorAll('.btn-submit-txn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const purchaseId = btn.dataset.purchaseId;
        const input = qs(`#txn-input-${purchaseId}`);
        const txnId = input?.value.trim();
        if (txnId) {
          submitTxnId(db, purchaseId, txnId);
        } else {
          createToast('Please enter a valid Transaction ID', 'error');
        }
      });
    });

    container.querySelectorAll('.btn-open-uploader').forEach((btn) => {
      btn.addEventListener('click', () => {
        const purchaseId = btn.dataset.purchaseId;
        const count = parseInt(btn.dataset.requiredCount, 10) || 40;
        openUploadModal(purchaseId, count);
      });
    });
  } catch (err) {
    console.error('Failed to load library orders:', err);
    if (emptyState) emptyState.hidden = false;
  }
}
