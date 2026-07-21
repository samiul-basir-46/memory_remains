import { renderSiteShell } from '../components/site-shell.js';
import { getFirebaseServices } from '../services/firebase-service.js';
import { updateCartCount, renderCartDrawer, addTemplateToCart, removeFromCart } from '../services/cart-service.js';
import { initAuthModalEvents, watchAuthState, openAuthModal, closeAuthModal } from '../services/auth-service.js';
import { initUploadModalEvents, openUploadModal, closeUploadModal } from '../services/upload-service.js';
import { renderHomePage } from '../controllers/home-controller.js';
import { renderShopPage } from '../controllers/shop-controller.js';
import { renderProductDetailsPage } from '../controllers/product-details-controller.js';
import { loadUserLibrary, submitTxnId } from '../controllers/library-controller.js';
import { initProfileForm, populateProfile } from '../controllers/profile-controller.js';
import { initContactEvents } from '../controllers/contact-controller.js';
import { setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { qs } from '../utils/ui.js';

const pageId = document.body.dataset.page || 'home';

// 1. Render site shell layout
renderSiteShell(pageId);

// 2. Initialize Firebase services
const { db } = getFirebaseServices();

// 3. Initialize common UI services
updateCartCount();
renderCartDrawer();
initAuthModalEvents();
initUploadModalEvents();
initContactEvents(db);

// 4. Register global window handlers for template inline event calls
Object.assign(window, {
  openAuthModal,
  closeAuthModal,
  openPhotoUploader: openUploadModal,
  closePhotoUploader: closeUploadModal,
  addToCart: (productName) => addTemplateToCart({ title: productName, price: 15 }),
  addTemplateToCart,
  removeFromCart,
  submitTxnId: (purchaseId, txnId) => submitTxnId(db, purchaseId, txnId)
});

// 5. Setup Auth State listener
watchAuthState(async (user) => {
  if (pageId === 'library') {
    const authRequired = qs('#library-auth-required');
    const content = qs('#library-content-container');
    if (authRequired && content) {
      authRequired.hidden = Boolean(user);
      content.hidden = !user;
    }
    if (user?.email) await loadUserLibrary(db, user.email);
  }

  if (pageId === 'profile') {
    const authRequired = qs('#profile-auth-required');
    const content = qs('#profile-content-container');
    if (authRequired && content) {
      authRequired.hidden = Boolean(user);
      content.hidden = !user;
    }
    if (user) initProfileForm(user);
  }
});

// 6. Page Routing & Initialization
async function initApp() {
  if (pageId === 'home') await renderHomePage(db);
  if (pageId === 'featured' || pageId === 'shop') await renderShopPage(db);
  if (pageId === 'product-details') await renderProductDetailsPage(db);

  if (pageId === 'library') {
    qs('#library-auth-required')?.classList.add('auth-required');
    qs('#library-content-container')?.setAttribute('hidden', 'hidden');
  }

  if (pageId === 'profile') {
    qs('#profile-auth-required')?.classList.add('auth-required');
    qs('#profile-content-container')?.setAttribute('hidden', 'hidden');
  }

  setupLazyCloudinaryImages(document);
}

initApp().catch((error) => {
  window.__appInitError = error;
  console.error('App initialization failed:', error);
  console.error(error?.stack || error);
});
