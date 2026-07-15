import { getFirebaseServices } from './firebase-service.js';
import { buildCloudinaryDeliveryUrl, compressImageFile, computeFileSignature, setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { createToast, escapeHtml, formatCurrency, qs, qsa, safeJsonParse } from '../utils/ui.js';

const CART_STORAGE_KEY = 'memory_remains_cart_v2';
const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/cmpl84gp/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'memory-remains';
const FALLBACK_IMAGE = '/assets/instagram_stories_cozy.png';

const staticProducts = {
  'Cozy Autumn Instagram Stories': { title: 'Cozy Autumn Instagram Stories', price: 12, compareAtPrice: 24, imageUrl: '/assets/instagram_stories_cozy.png', badge: 'Featured' },
  'Summer Vibes Instagram Carousel': { title: 'Summer Vibes Instagram Carousel', price: 15, compareAtPrice: 30, imageUrl: '/assets/instagram_carousel_summer.png', badge: 'Popular' },
  'Cozy Scrapbook Template Bundle': { title: 'Cozy Scrapbook Template Bundle', price: 24, compareAtPrice: 48, imageUrl: '/assets/scrapbook_collage_bundle.png', badge: 'Best Seller' }
};

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function inferCollection(template = {}) {
  const raw = normalizeText(`${template.collection || template.category || template.segment || ''}`);
  const title = normalizeText(template.title);

  if (raw.includes('birthday') || title.includes('birthday')) return 'Birthday Special';
  if (raw.includes('her') || raw.includes('love') || title.includes('love') || title.includes('couple')) return 'For Her';
  if (raw.includes('him') || title.includes('him')) return 'For Him';
  if (raw.includes('premium') || title.includes('premium') || title.includes('planner')) return 'Premium';
  if (raw.includes('best') || title.includes('memory') || title.includes('scrapbook')) return 'Best Selling';
  return 'Featured';
}

function comparePrice(template = {}) {
  const explicit = Number(template.compareAtPrice || template.originalPrice || template.mrp || template.regularPrice);
  const price = Number(template.price || 0);
  if (Number.isFinite(explicit) && explicit > price) {
    return explicit;
  }
  return price ? Number((price * 2).toFixed(2)) : 0;
}

function discountPercent(template = {}) {
  const price = Number(template.price || 0);
  const compare = comparePrice(template);
  if (!price || !compare || compare <= price) {
    return 0;
  }
  return Math.round(((compare - price) / compare) * 100);
}

function getCart() {
  const parsed = safeJsonParse(localStorage.getItem(CART_STORAGE_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
}

function setCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function imageMarkup(url, alt, className = '', widthHint = 720) {
  const escapedAlt = escapeHtml(alt || 'Product image');
  const optimizedUrl = buildCloudinaryDeliveryUrl(url, { width: widthHint });
  if (url?.includes('res.cloudinary.com')) {
    return `<img class="${className}" src="${FALLBACK_IMAGE}" data-cld-src="${optimizedUrl}" alt="${escapedAlt}" loading="lazy" decoding="async">`;
  }
  return `<img class="${className}" src="${url || FALLBACK_IMAGE}" alt="${escapedAlt}" loading="lazy" decoding="async">`;
}

async function fetchTemplates(db, { limit, orderByCreated = true } = {}) {
  if (!db) return [];
  let ref = db.collection('templates');
  if (orderByCreated) {
    ref = ref.orderBy('createdAt', 'desc');
  }
  if (limit) {
    ref = ref.limit(limit);
  }
  const snapshot = await ref.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function fetchTemplateById(db, templateId) {
  if (!db || !templateId) return null;
  const doc = await db.collection('templates').doc(templateId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

function renderProductCard(template = {}) {
  const badge = template.badge || 'Bestseller';
  const price = Number(template.price || 0);
  const collection = inferCollection(template);
  const compare = comparePrice(template);
  const discount = discountPercent(template);
  const encoded = encodeURIComponent(JSON.stringify(template));
  const detailsUrl = template.id ? `/pages/product-details?id=${template.id}` : '#';

  return `
    <article class="product-card" data-product-card>
      <a href="${detailsUrl}" class="product-card__media">
        <span class="product-badge">${escapeHtml(badge)}</span>
        ${imageMarkup(template.imageUrl || FALLBACK_IMAGE, template.title, 'product-card__image')}
      </a>
      <div class="product-card__body">
        <h3 class="product-card__title" style="font-size: 0.95rem; font-weight: 500; color: #2a2a2a; margin: 0 0 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--font-body);">${escapeHtml(template.title || 'Untitled product')}</h3>
        <div class="product-price-row" style="display: flex; gap: 0.4rem; align-items: baseline; margin: 0;">
          <strong style="color: var(--color-primary); font-size: 1rem; font-weight: 600;">₹${price}</strong>
          ${compare ? `<span style="color: #888; text-decoration: line-through; font-size: 0.8rem;">₹${compare}</span>` : ''}
          ${discount ? `<span style="color: #4caf50; font-size: 0.8rem; font-weight: 500; margin-left: 0.2rem;">${discount}% Off</span>` : ''}
        </div>
      </div>
    </article>
  `;
}

async function findExistingAssetBySignature(db, signature) {
  if (!db || !signature) return null;
  const snapshot = await db.collection('cloudinary_assets').where('signature', '==', signature).limit(1).get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function saveCloudinaryAssetRecord(db, payload) {
  if (!db) return;
  await db.collection('cloudinary_assets').doc(payload.publicId).set(payload, { merge: true });
}

async function queuePotentialCleanup(db, userId, email) {
  if (!db || !userId) return;
  const assetsSnapshot = await db.collection('cloudinary_assets')
    .where('ownerUserId', '==', userId)
    .where('status', '==', 'active')
    .get();

  const purchasesSnapshot = email
    ? await db.collection('purchases').where('email', '==', email).get()
    : null;

  const activeUrls = new Set();
  purchasesSnapshot?.forEach((doc) => {
    const purchase = doc.data();
    (purchase.imageUrls || []).forEach((url) => activeUrls.add(url));
  });

  const updates = [];
  assetsSnapshot.forEach((doc) => {
    const asset = doc.data();
    if (!activeUrls.has(asset.secureUrl)) {
      updates.push(db.collection('cloudinary_cleanup_queue').doc(doc.id).set({
        publicId: asset.publicId,
        secureUrl: asset.secureUrl,
        ownerUserId: asset.ownerUserId || userId,
        ownerEmail: asset.ownerEmail || email || '',
        candidateReason: 'not_referenced_in_purchases',
        queuedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }));
    }
  });

  await Promise.all(updates);
}

export function createAppController(pageId) {
  const { db, auth } = getFirebaseServices();

  const state = {
    cart: getCart(),
    templates: [],
    selectedFiles: [],
    currentUploadPurchaseId: '',
    currentUploadTargetCount: 0
  };

  function persistCart() {
    setCart(state.cart);
    updateCartCount();
    renderCartDrawer();
  }

  function updateCartCount() {
    const badge = qs('.cart-count');
    if (badge) badge.textContent = String(state.cart.length);
  }

  function openSurface(panel, overlay) {
    panel?.classList.add('is-open');
    overlay?.classList.add('is-visible');
    document.body.classList.add('modal-open');
  }

  function closeSurface(panel, overlay) {
    panel?.classList.remove('is-open');
    overlay?.classList.remove('is-visible');
    if (!qs('.is-open')) {
      document.body.classList.remove('modal-open');
    }
  }

  function openMobileMenu() {
    openSurface(qs('#mobile-drawer'), qs('#screen-overlay'));
  }

  function closeMobileMenu() {
    closeSurface(qs('#mobile-drawer'), qs('#screen-overlay'));
  }

  function openCartDrawer() {
    openSurface(qs('#cart-drawer'), qs('#cart-drawer-overlay'));
  }

  function closeCartDrawer() {
    closeSurface(qs('#cart-drawer'), qs('#cart-drawer-overlay'));
  }

  function openAuthModal() {
    openSurface(qs('#auth-modal'), qs('#auth-modal-overlay'));
  }

  function closeAuthModal() {
    closeSurface(qs('#auth-modal'), qs('#auth-modal-overlay'));
  }

  function openUploadModal(purchaseId, requiredCount) {
    state.currentUploadPurchaseId = purchaseId;
    state.currentUploadTargetCount = requiredCount;
    state.selectedFiles = [];

    const target = qs('#upload-target-count');
    const count = qs('#upload-selected-count');
    if (target) target.textContent = String(requiredCount);
    if (count) count.textContent = '0';
    qs('#upload-previews-grid')?.setAttribute('hidden', 'hidden');
    qs('#upload-preview-header')?.setAttribute('hidden', 'hidden');
    qs('#upload-progress-container')?.setAttribute('hidden', 'hidden');
    qs('#upload-previews-grid').innerHTML = '';
    qs('#upload-submit-btn').disabled = true;
    openSurface(qs('#upload-modal'), qs('#upload-modal-overlay'));
  }

  function closeUploadModal() {
    closeSurface(qs('#upload-modal'), qs('#upload-modal-overlay'));
  }

  function addTemplateToCart(template) {
    if (state.cart.some((item) => item.title === template.title)) {
      createToast(`"${template.title}" is already in your bag.`, 'error');
      return;
    }
    state.cart.push(template);
    persistCart();
    createToast(`"${template.title}" has been added to your bag.`);
  }

  function removeFromCart(title) {
    state.cart = state.cart.filter((item) => item.title !== title);
    persistCart();
    createToast('Item removed from your bag.');
  }

  function renderCartDrawer() {
    const itemsContainer = qs('#cart-items-container');
    const emptyState = qs('#cart-empty-message');
    const footer = qs('#cart-drawer-footer');
    const subtotal = qs('#cart-subtotal-val');
    if (!itemsContainer || !emptyState || !footer || !subtotal) return;

    if (!state.cart.length) {
      itemsContainer.innerHTML = '';
      emptyState.hidden = false;
      footer.hidden = true;
      subtotal.textContent = formatCurrency(0);
      return;
    }

    emptyState.hidden = true;
    footer.hidden = false;
    let total = 0;
    itemsContainer.innerHTML = state.cart.map((item) => {
      total += Number(item.price || 0);
      return `
        <div class="cart-item">
          ${imageMarkup(item.imageUrl || FALLBACK_IMAGE, item.title, '')}
          <div class="cart-item__meta">
            <strong>${escapeHtml(item.title)}</strong>
            <p>${formatCurrency(item.price || 0)}</p>
          </div>
          <button class="icon-close" type="button" data-remove-cart="${escapeHtml(item.title)}">&times;</button>
        </div>
      `;
    }).join('');
    subtotal.textContent = formatCurrency(total);
    setupLazyCloudinaryImages(itemsContainer);
  }

  function buildCollectionCards(templates = []) {
    const fallbacks = [
      { title: 'For Her', description: 'Soft and emotional layouts', match: 'love' },
      { title: 'Birthday Special', description: 'Celebration-ready story formats', match: 'birthday' },
      { title: 'Best Selling', description: 'Popular memory products', match: 'memory' }
    ];

    return fallbacks.map((item) => {
      const matched = templates.find((template) => normalizeText(`${template.title} ${template.category} ${template.collection}`).includes(item.match)) || templates[0] || {};
      return {
        ...item,
        imageUrl: matched.imageUrl || FALLBACK_IMAGE
      };
    });
  }

  function renderCollectionGrid(container, cards) {
    if (!container) return;
    container.innerHTML = cards.map((card) => `
      <a href="/collections/paid-products" class="collection-card">
        ${imageMarkup(card.imageUrl, card.title)}
        <div class="collection-card__body">
          <span class="eyebrow" style="color:#fff8f3">${escapeHtml(card.title)}</span>
          <h3>${escapeHtml(card.description)}</h3>
        </div>
      </a>
    `).join('');
    setupLazyCloudinaryImages(container);
  }

  function renderCategoryChips(container, templates = []) {
    if (!container) return;
    const categories = Array.from(new Set(templates.map(inferCollection).concat(['Best Selling', 'Birthday Special', 'For Him', 'For Her', 'Premium']))).slice(0, 5);
    container.innerHTML = categories.map((item) => `<a class="category-chip" href="/collections/paid-products">${escapeHtml(item)}</a>`).join('');
  }

  async function renderHomePage() {
    const grid = qs('#templates-grid');
    if (!grid) return;

    try {
      state.templates = await fetchTemplates(db, { orderByCreated: false });
      
      const renderCurrent = () => {
        const value = qs('#sort-by')?.value || 'Recommended';
        grid.innerHTML = sortTemplates(value).map(renderProductCard).join('');
        setupLazyCloudinaryImages(grid);
      };

      qs('#sort-by')?.addEventListener('change', renderCurrent);
      renderCurrent();
    } catch (error) {
      console.error('Failed to load home templates:', error);
      grid.innerHTML = '<p>Unable to load products right now.</p>';
    }
  }

  function sortTemplates(criteria) {
    const templates = [...state.templates];
    if (criteria === 'Price: Low to High') templates.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    else if (criteria === 'Price: High to Low') templates.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    else if (criteria === 'Alphabetically: A-Z') templates.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else templates.sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bDate - aDate;
    });
    return templates;
  }

  async function renderShopPage() {
    const grid = qs('#templates-grid');
    if (!grid) return;

    try {
      state.templates = await fetchTemplates(db, { orderByCreated: false });
      const label = qs('#product-count-label');
      if (label) label.textContent = `${state.templates.length} products`;

      const renderCurrent = () => {
        const value = qs('#sort-by')?.value || 'Featured';
        grid.innerHTML = sortTemplates(value).map(renderProductCard).join('');
        setupLazyCloudinaryImages(grid);
      };

      qs('#sort-by')?.addEventListener('change', renderCurrent);
      renderCurrent();
    } catch (error) {
      console.error('Failed to load shop templates:', error);
      grid.innerHTML = '<p>Unable to load products right now.</p>';
    }
  }

  async function renderProductDetailsPage() {
    const detailsContainer = qs('#details-content-container');
    if (!detailsContainer) return;
    const loading = qs('#details-loading-state');

    const params = new URLSearchParams(window.location.search);
    const templateId = params.get('id');

    try {
      const template = await fetchTemplateById(db, templateId);
      if (!template) throw new Error('Template not found');

      const gallery = [template.imageUrl, ...(template.galleryUrls || [])].filter(Boolean);
      const mainImage = gallery[0] || FALLBACK_IMAGE;
      qs('#details-category').textContent = inferCollection(template);
      qs('#details-title').textContent = template.title || 'Product details';
      qs('#details-price').textContent = formatCurrency(template.price || 0);
      qs('#details-description').textContent = template.description || 'Premium digital template crafted for gifting and memory-driven storytelling.';
      qs('#details-badge').textContent = template.badge || 'Featured';

      const mainImg = qs('#details-main-image');
      if (mainImg) {
        if (mainImage.includes('res.cloudinary.com')) {
          mainImg.src = FALLBACK_IMAGE;
          mainImg.dataset.cldSrc = buildCloudinaryDeliveryUrl(mainImage, { width: 1200 });
        } else {
          mainImg.src = mainImage;
        }
        mainImg.alt = template.title || 'Main product image';
      }

      const thumbs = qs('#details-thumbnails-gallery');
      if (thumbs) {
        thumbs.classList.add('gallery-thumbs');
        thumbs.innerHTML = gallery.map((url, index) => `
          <button type="button" data-gallery-src="${escapeHtml(url)}" aria-label="View image ${index + 1}">
            ${imageMarkup(url, `${template.title} ${index + 1}`, '', 220)}
          </button>
        `).join('');
      }

      qs('#details-add-to-bag-btn')?.addEventListener('click', () => addTemplateToCart(template));
      thumbs?.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-gallery-src]');
        if (!button) return;
        const nextSrc = button.dataset.gallerySrc;
        if (mainImg) {
          if (nextSrc.includes('res.cloudinary.com')) {
            mainImg.src = FALLBACK_IMAGE;
            mainImg.dataset.cldSrc = buildCloudinaryDeliveryUrl(nextSrc, { width: 1200 });
            setupLazyCloudinaryImages(detailsContainer);
          } else {
            mainImg.src = nextSrc;
          }
        }
      });

      loading.hidden = true;
      detailsContainer.hidden = false;
      detailsContainer.classList.add('details-grid');
      setupLazyCloudinaryImages(detailsContainer);
    } catch (error) {
      console.error('Failed to load product details:', error);
      if (loading) loading.innerHTML = '<p>Unable to load this product right now.</p>';
    }
  }

  async function submitNewsletter(form) {
    const input = form.querySelector('input[type="email"]');
    const email = input?.value.trim();
    if (!email) return;

    try {
      if (db) {
        await db.collection('newsletter_subscribers').add({
          email,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      input.value = '';
      createToast('Thanks for subscribing.');
    } catch (error) {
      console.error('Newsletter subscription failed:', error);
      createToast('Subscription failed. Please try again.', 'error');
    }
  }

  async function submitContactForm(form) {
    const payload = {
      name: qs('#contact-name', form)?.value.trim(),
      email: qs('#contact-email', form)?.value.trim(),
      subject: qs('#contact-subject', form)?.value.trim(),
      message: qs('#contact-message', form)?.value.trim()
    };

    try {
      if (db) {
        await db.collection('contact_messages').add({
          ...payload,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      form.reset();
      createToast('Message sent successfully.');
    } catch (error) {
      console.error('Contact form failed:', error);
      createToast('Message could not be sent.', 'error');
    }
  }

  async function updateProfileForm(user) {
    const form = qs('#profile-form');
    if (!form || !user) return;

    const payload = {
      displayName: qs('#profile-name')?.value.trim() || '',
      phoneNumber: qs('#profile-phone')?.value.trim() || ''
    };

    const submit = form.querySelector('button[type="submit"]');
    const original = submit?.textContent || 'Save Changes';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Saving...';
    }

    try {
      await user.updateProfile({ displayName: payload.displayName });
      if (db) {
        await db.collection('users').doc(user.uid).set({
          phoneNumber: payload.phoneNumber,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      createToast('Profile updated.');
      qs('#profile-welcome-title').textContent = `Welcome, ${payload.displayName || 'Creator'}!`;
    } catch (error) {
      console.error('Profile update failed:', error);
      createToast('Could not save profile.', 'error');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = original;
      }
    }
  }

  async function createPurchaseRecords(user, purchaseType, txnId) {
    if (!db || !state.cart.length) return;

    const name = qs('#checkout-name')?.value.trim() || '';
    const email = user?.email || qs('#checkout-email')?.value.trim();
    if (!email) {
      createToast('Please enter an email address to checkout.', 'error');
      return;
    }

    let paymentDetails = {
      paymentStatus: txnId ? 'pending_verification' : 'pending_payment',
      status: 'pending'
    };

    if (txnId) {
      const unmatchedDoc = await db.collection('unmatched_transactions').doc(txnId).get();
      if (unmatchedDoc.exists) {
        const data = unmatchedDoc.data();
        const amount = Number(data.amount || 0);
        if (amount >= 10) {
          paymentDetails = {
            paymentStatus: 'paid',
            status: 'completed',
            verifiedAmount: amount,
            paidAt: firebase.firestore.FieldValue.serverTimestamp(),
            paymentMethod: 'bkash_sms',
            verificationSource: 'sms_auto_detect',
            unmatchedData: data
          };
        } else {
          paymentDetails = {
            paymentStatus: 'underpaid',
            status: 'pending',
            verifiedAmount: amount,
            paidAt: firebase.firestore.FieldValue.serverTimestamp(),
            verificationSource: 'sms_auto_detect',
            paymentError: `Received Tk ${amount} but expected Tk 10.0.`,
            unmatchedData: data
          };
        }
      }
    }

    const docs = await Promise.all(state.cart.map((item) => db.collection('purchases').add({
      email,
      productName: item.title,
      pricePaid: Number(item.price || 0),
      purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
      buyerName: name,
      type: purchaseType,
      templateId: item.id || '',
      requiredImageCount: Number(item.requiredImageCount || 40),
      imageUrls: [],
      txnId,
      userId: user?.uid || 'anonymous',
      status: paymentDetails.status,
      paymentStatus: paymentDetails.paymentStatus,
      verifiedAmount: paymentDetails.verifiedAmount,
      paidAt: paymentDetails.paidAt,
      paymentMethod: paymentDetails.paymentMethod,
      verificationSource: paymentDetails.verificationSource,
      paymentError: paymentDetails.paymentError
    })));

    if (paymentDetails.unmatchedData) {
      await db.collection('unmatched_transactions').doc(txnId).delete();
      await db.collection('processed_transactions').doc(txnId).set({
        purchaseId: docs[0].id,
        amount: paymentDetails.verifiedAmount || 0,
        processedAt: firebase.firestore.FieldValue.serverTimestamp(),
        smsTimestamp: paymentDetails.unmatchedData.smsTimestamp || ''
      });
    }

    state.cart = [];
    persistCart();
    qs('#checkout-form')?.reset();
    closeCartDrawer();
    createToast('Order placed successfully.');
  }

  async function submitTxnId(purchaseId, txnId) {
    if (!db || !purchaseId || !txnId) return;
    try {
      const doc = await db.collection('unmatched_transactions').doc(txnId).get();
      if (doc.exists) {
        const data = doc.data();
        const amount = Number(data.amount || 0);
        if (amount >= 10) {
          await db.collection('purchases').doc(purchaseId).update({
            txnId,
            paymentStatus: 'paid',
            status: 'completed',
            verifiedAmount: amount,
            paidAt: firebase.firestore.FieldValue.serverTimestamp(),
            paymentMethod: 'bkash_sms',
            verificationSource: 'sms_auto_detect'
          });
          await db.collection('unmatched_transactions').doc(txnId).delete();
        } else {
          await db.collection('purchases').doc(purchaseId).update({
            txnId,
            paymentStatus: 'underpaid',
            verifiedAmount: amount,
            paymentError: `Received Tk ${amount} but expected Tk 10.0.`,
            paidAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        await db.collection('purchases').doc(purchaseId).update({
          txnId,
          paymentStatus: 'pending_verification'
        });
      }
      createToast('Transaction ID submitted.');
      const email = qs('#anonymous-library-email')?.value.trim() || auth?.currentUser?.email || '';
      if (email) {
        await loadUserLibrary(email);
      }
    } catch (error) {
      console.error('Transaction ID submission failed:', error);
      createToast('Could not submit transaction ID.', 'error');
    }
  }

  async function loadUserLibrary(email) {
    const status = qs('#library-status-message');
    const grid = qs('#library-results-grid');
    if (!db || !status || !grid) return;

    status.textContent = 'Loading your library...';
    grid.innerHTML = '';

    try {
      const [purchaseSnapshot, templateSnapshot] = await Promise.all([
        db.collection('purchases').where('email', '==', email).get(),
        db.collection('templates').get()
      ]);

      if (purchaseSnapshot.empty) {
        status.textContent = 'No purchases found for this email.';
        return;
      }

      const templateMap = new Map();
      templateSnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        templateMap.set(doc.id, data);
        templateMap.set(data.title, data);
      });

      const cards = [];
      purchaseSnapshot.forEach((doc) => {
        const purchase = doc.data();
        const template = templateMap.get(purchase.templateId) || templateMap.get(purchase.productName) || {};
        const imageUrl = template.imageUrl || FALLBACK_IMAGE;
        const canvaUrl = template.canvaUrl || '#';
        const requiredCount = Number(purchase.requiredImageCount || 40);
        const images = purchase.imageUrls || [];

        let badgeClass = 'discount-pill';
        let badgeText = 'Pending';
        let actionHtml = '<p class="form-help">Awaiting next update.</p>';

        if (purchase.status === 'completed' && purchase.type === 'template') {
          badgeText = 'Approved';
          actionHtml = `<a class="pill-button" href="${canvaUrl}" target="_blank" rel="noreferrer">Get Template</a>`;
        } else if (purchase.status === 'completed' && purchase.type === 'customOrder') {
          if (images.length < requiredCount) {
            badgeText = 'Upload Required';
            actionHtml = `<button class="pill-button" type="button" data-open-upload="${doc.id}" data-upload-count="${requiredCount}">Upload ${requiredCount} Photos</button>`;
          } else {
            badgeText = 'Photos Submitted';
            actionHtml = '<p class="form-help">Your custom order is in progress.</p>';
          }
        } else if (purchase.paymentStatus === 'underpaid') {
          badgeClass = 'discount-pill';
          badgeText = 'Underpaid';
          actionHtml = '<p class="form-help">Payment amount looks incomplete. Please check support.</p>';
        } else if (!purchase.txnId || purchase.paymentStatus === 'pending_payment') {
          badgeText = 'Unpaid';
          actionHtml = `
            <div class="stack-form">
              <input type="text" placeholder="Enter Transaction ID" data-txn-input="${doc.id}">
              <button class="pill-button" type="button" data-submit-txn="${doc.id}">Submit ID</button>
            </div>
          `;
        } else if (purchase.paymentStatus === 'paid') {
          badgeText = 'Paid';
          actionHtml = '<p class="form-help">Waiting for admin approval.</p>';
        } else {
          badgeText = 'Verifying';
        }

        cards.push(`
          <article class="product-card">
            <div class="product-card__media">
              <span class="product-badge">${badgeText}</span>
              ${imageMarkup(imageUrl, purchase.productName)}
            </div>
            <div class="product-card__body">
              <h3>${escapeHtml(purchase.productName)}</h3>
              <span class="${badgeClass}">${escapeHtml(purchase.type === 'customOrder' ? 'Custom Photo Order' : 'Ready-made Template')}</span>
              ${actionHtml}
            </div>
          </article>
        `);
      });

      status.textContent = `Found ${cards.length} item(s) in your library.`;
      grid.innerHTML = cards.join('');
      setupLazyCloudinaryImages(grid);
    } catch (error) {
      console.error('Failed to load library:', error);
      status.textContent = 'Could not load library right now.';
    }
  }

  async function populateProfile(user) {
    const authRequired = qs('#profile-auth-required');
    const content = qs('#profile-content-container');
    if (!authRequired || !content) return;

    if (!user) {
      authRequired.hidden = false;
      content.hidden = true;
      return;
    }

    authRequired.hidden = true;
    content.hidden = false;
    qs('#profile-name').value = user.displayName || '';
    qs('#profile-email').value = user.email || '';
    qs('#profile-welcome-title').textContent = `Welcome, ${user.displayName || 'Creator'}!`;
    const avatar = qs('#profile-avatar');
    if (avatar) {
      avatar.src = user.photoURL || '/assets/creator_profile.png';
    }

    if (db) {
      const doc = await db.collection('users').doc(user.uid).get();
      if (doc.exists && qs('#profile-phone')) {
        qs('#profile-phone').value = doc.data().phoneNumber || '';
      }
    }
  }

  async function uploadSelectedPhotos() {
    const user = auth?.currentUser;
    if (!user || !db) {
      createToast('Please login before uploading photos.', 'error');
      return;
    }

    const progressContainer = qs('#upload-progress-container');
    const progressFill = qs('#upload-progress-bar-fill');
    const progressStatus = qs('#upload-progress-status');
    const submitBtn = qs('#upload-submit-btn');
    progressContainer?.removeAttribute('hidden');
    if (submitBtn) submitBtn.disabled = true;

    const uploadedUrls = [];
    let totalOriginalBytes = 0;
    let totalOptimizedBytes = 0;

    for (let index = 0; index < state.selectedFiles.length; index += 1) {
      const originalFile = state.selectedFiles[index];
      totalOriginalBytes += originalFile.size;

      try {
        const signature = await computeFileSignature(originalFile);
        const existing = await findExistingAssetBySignature(db, signature);
        if (existing?.secureUrl) {
          uploadedUrls.push(existing.secureUrl);
          totalOptimizedBytes += Number(existing.optimizedBytes || originalFile.size);
        } else {
          const { file: compressedFile, optimizedBytes, ratioSaved } = await compressImageFile(originalFile);
          totalOptimizedBytes += optimizedBytes;

          const formData = new FormData();
          formData.append('file', compressedFile);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
          formData.append('folder', `memory-remains/${user.uid}/${state.currentUploadPurchaseId}`);
          formData.append('context', `purchase_id=${state.currentUploadPurchaseId}|owner_user_id=${user.uid}`);

          const response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method: 'POST',
            body: formData
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error?.message || 'Upload failed');

          uploadedUrls.push(data.secure_url);
          await saveCloudinaryAssetRecord(db, {
            publicId: data.public_id,
            secureUrl: data.secure_url,
            signature,
            ownerPurchaseId: state.currentUploadPurchaseId,
            ownerUserId: user.uid,
            ownerEmail: user.email || '',
            originalBytes: originalFile.size,
            optimizedBytes,
            ratioSaved,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastAccessedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
          });
        }

        const percent = Math.round(((index + 1) / state.selectedFiles.length) * 100);
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressStatus) progressStatus.textContent = `Uploading photo ${index + 1} of ${state.selectedFiles.length}...`;
      } catch (error) {
        console.error('Image upload failed:', error);
        createToast(`Photo ${index + 1} upload failed.`, 'error');
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
    }

    try {
      await db.collection('purchases').doc(state.currentUploadPurchaseId).update({
        imageUrls: uploadedUrls,
        photoSubmittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        uploadOriginalBytes: totalOriginalBytes,
        uploadOptimizedBytes: totalOptimizedBytes,
        uploadSavingsRatio: totalOriginalBytes ? 1 - totalOptimizedBytes / totalOriginalBytes : 0
      });
      await queuePotentialCleanup(db, user.uid, user.email || '');
      if (progressStatus) progressStatus.textContent = 'Successfully submitted.';
      createToast('Photos submitted successfully.');
      closeUploadModal();
      await loadUserLibrary(user.email || '');
    } catch (error) {
      console.error('Finalizing photo upload failed:', error);
      createToast('Could not save uploaded photos.', 'error');
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function previewSelectedFiles(files) {
    const previewGrid = qs('#upload-previews-grid');
    const previewHeader = qs('#upload-preview-header');
    const selectedCount = qs('#upload-selected-count');
    const submitBtn = qs('#upload-submit-btn');
    if (!previewGrid || !previewHeader || !selectedCount || !submitBtn) return;

    state.selectedFiles = Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, state.currentUploadTargetCount);
    selectedCount.textContent = String(state.selectedFiles.length);

    previewGrid.innerHTML = state.selectedFiles.map((file) => {
      const src = URL.createObjectURL(file);
      return `<img src="${src}" alt="${escapeHtml(file.name)}">`;
    }).join('');

    previewGrid.hidden = false;
    previewHeader.hidden = false;
    submitBtn.disabled = state.selectedFiles.length !== state.currentUploadTargetCount;
  }

  async function handleAuthProviderLogin(providerName) {
    if (!auth) {
      createToast('Authentication is not available on this page.', 'error');
      return;
    }

    try {
      const provider = providerName === 'facebook'
        ? new firebase.auth.FacebookAuthProvider()
        : new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      createToast(`Welcome ${result.user.displayName || 'Creator'}!`);
      closeAuthModal();
    } catch (error) {
      console.error('Auth failed:', error);
      createToast(error.message || 'Sign in failed.', 'error');
    }
  }

  function bindDomEvents() {
    qs('.menu-toggle')?.addEventListener('click', openMobileMenu);
    qs('#screen-overlay')?.addEventListener('click', closeMobileMenu);
    qs('.cart-icon')?.addEventListener('click', openCartDrawer);
    qs('#cart-drawer-close-btn')?.addEventListener('click', closeCartDrawer);
    qs('#cart-drawer-overlay')?.addEventListener('click', closeCartDrawer);
    qs('#auth-modal-close-btn')?.addEventListener('click', closeAuthModal);
    qs('#auth-modal-overlay')?.addEventListener('click', closeAuthModal);
    qs('#upload-modal-close-btn')?.addEventListener('click', closeUploadModal);
    qs('#upload-modal-overlay')?.addEventListener('click', closeUploadModal);

    qs('#auth-nav-btn')?.addEventListener('click', () => {
      if (auth?.currentUser) auth.signOut();
      else openAuthModal();
    });
    qs('#auth-mobile-btn')?.addEventListener('click', (event) => {
      event.preventDefault();
      if (auth?.currentUser) auth.signOut();
      else openAuthModal();
    });

    qsa('[data-auth-provider]').forEach((button) => {
      button.addEventListener('click', () => handleAuthProviderLogin(button.dataset.authProvider));
    });

    document.addEventListener('click', (event) => {
      const addButton = event.target.closest('.add-to-cart-btn');
      if (addButton?.dataset.product) {
        const template = JSON.parse(decodeURIComponent(addButton.dataset.product));
        addTemplateToCart(template);
      }

      const removeButton = event.target.closest('[data-remove-cart]');
      if (removeButton?.dataset.removeCart) {
        removeFromCart(removeButton.dataset.removeCart);
      }

      const uploadButton = event.target.closest('[data-open-upload]');
      if (uploadButton) {
        openUploadModal(uploadButton.dataset.openUpload, Number(uploadButton.dataset.uploadCount || 40));
      }

      const submitTxnButton = event.target.closest('[data-submit-txn]');
      if (submitTxnButton) {
        const purchaseId = submitTxnButton.dataset.submitTxn;
        const input = qs(`[data-txn-input="${purchaseId}"]`);
        submitTxnId(purchaseId, input?.value.trim().toUpperCase());
      }
    });

    qs('#checkout-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const purchaseType = qs('#checkout-purchase-type')?.value || 'template';
      const txnId = qs('#checkout-txnid')?.value.trim().toUpperCase() || '';
      await createPurchaseRecords(auth?.currentUser, purchaseType, txnId);
    });

    qsa('.newsletter-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await submitNewsletter(form);
      });
    });

    qs('#contact-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitContactForm(event.currentTarget);
    });

    qs('#profile-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await updateProfileForm(auth?.currentUser);
    });

    qs('#anonymous-library-btn')?.addEventListener('click', async () => {
      const email = qs('#anonymous-library-email')?.value.trim();
      if (!email) {
        createToast('Please enter your checkout email.', 'error');
        return;
      }
      qs('#library-content-container')?.removeAttribute('hidden');
      await loadUserLibrary(email);
    });

    qs('#upload-dropzone')?.addEventListener('click', () => qs('#upload-file-input')?.click());
    qs('#upload-file-input')?.addEventListener('change', (event) => previewSelectedFiles(event.target.files));
    qs('#upload-dropzone')?.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.currentTarget.style.borderColor = 'rgba(94, 43, 31, 0.45)';
    });
    qs('#upload-dropzone')?.addEventListener('dragleave', (event) => {
      event.currentTarget.style.borderColor = 'rgba(94, 43, 31, 0.18)';
    });
    qs('#upload-dropzone')?.addEventListener('drop', (event) => {
      event.preventDefault();
      event.currentTarget.style.borderColor = 'rgba(94, 43, 31, 0.18)';
      previewSelectedFiles(event.dataTransfer.files);
    });

    qs('#upload-submit-btn')?.addEventListener('click', uploadSelectedPhotos);
  }

  function watchAuthState() {
    if (!auth) return;
    auth.onAuthStateChanged(async (user) => {
      const authButtons = [qs('#auth-nav-btn'), qs('#auth-mobile-btn')].filter(Boolean);
      authButtons.forEach((button) => {
        button.textContent = user ? 'Logout' : 'Sign In';
      });

      if (qs('#checkout-email')) {
        qs('#checkout-email').value = user?.email || '';
        qs('#checkout-email').disabled = Boolean(user?.email);
      }
      if (qs('#checkout-name')) {
        qs('#checkout-name').value = user?.displayName || '';
      }

      if (pageId === 'library') {
        const authRequired = qs('#library-auth-required');
        const content = qs('#library-content-container');
        if (authRequired && content) {
          authRequired.hidden = Boolean(user);
          content.hidden = !user;
        }
        if (user?.email) await loadUserLibrary(user.email);
      }

      if (pageId === 'profile') {
        await populateProfile(user);
      }
    });
  }

  async function initPage() {
    if (pageId === 'home') await renderHomePage();
    if (pageId === 'shop') await renderShopPage();
    if (pageId === 'product-details') await renderProductDetailsPage();
    if (pageId === 'library') {
      qs('#library-auth-required')?.classList.add('auth-required');
      qs('#library-content-container')?.setAttribute('hidden', 'hidden');
    }
    if (pageId === 'profile') {
      qs('#profile-auth-required')?.classList.add('auth-required');
      qs('#profile-content-container')?.setAttribute('hidden', 'hidden');
    }
    if (pageId === 'about' || pageId === 'contact') {
      setupLazyCloudinaryImages(document);
    }
  }

  return {
    async init() {
      updateCartCount();
      renderCartDrawer();
      bindDomEvents();
      watchAuthState();
      await initPage();
      setupLazyCloudinaryImages(document);
      Object.assign(window, {
        openAuthModal,
        closeAuthModal,
        openPhotoUploader: openUploadModal,
        closePhotoUploader: closeUploadModal,
        addToCart: (productName) => addTemplateToCart(staticProducts[productName] || { title: productName, price: 15 }),
        addTemplateToCart,
        removeFromCart,
        submitTxnId
      });
    }
  };
}
