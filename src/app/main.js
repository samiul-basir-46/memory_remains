import { renderSiteShell, populateNavCategories, populateNavCollections } from '../components/site-shell.js';
import { getFirebaseServices } from '../services/firebase-service.js';
import { updateCartCount, renderCartDrawer, addTemplateToCart, removeFromCart } from '../services/cart-service.js';
import { initAuthModalEvents, watchAuthState, openAuthModal, closeAuthModal } from '../services/auth-service.js';
import { initUploadModalEvents, openUploadModal, closeUploadModal } from '../services/upload-service.js';
import { renderHomePage } from '../controllers/home-controller.js';
import { renderShopPage } from '../controllers/shop-controller.js';
import { renderProductDetailsPage } from '../controllers/product-details-controller.js';
import { renderCartPage } from '../controllers/cart-controller.js';
import { renderTrackOrderPage } from '../controllers/track-order-controller.js';
import { loadUserLibrary, submitTxnId } from '../controllers/library-controller.js';
import { initProfileController } from '../controllers/profile-controller.js';
import { initContactEvents } from '../controllers/contact-controller.js';
import { setupLazyCloudinaryImages } from '../utils/cloudinary.js';
import { qs } from '../utils/ui.js';

const pageId = document.body.dataset.page || 'home';

renderSiteShell(pageId);

const { db } = getFirebaseServices();

updateCartCount();
renderCartDrawer();
initAuthModalEvents();
initUploadModalEvents();
initContactEvents(db);

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
});

async function initApp() {
  populateNavCategories(db).catch((e) => console.warn('Nav categories async error:', e));
  populateNavCollections(db).catch((e) => console.warn('Nav collections async error:', e));

  if (pageId === 'home') await renderHomePage(db);
  if (pageId === 'featured' || pageId === 'shop') await renderShopPage(db);
  if (pageId === 'product-details') await renderProductDetailsPage(db);
  if (pageId === 'cart') await renderCartPage(db);
  if (pageId === 'track-order') await renderTrackOrderPage();
  if (pageId === 'profile') initProfileController();

  if (pageId === 'library') {
    qs('#library-auth-required')?.classList.add('auth-required');
    qs('#library-content-container')?.setAttribute('hidden', 'hidden');
  }

  setupLazyCloudinaryImages(document);
}

initApp().catch((error) => {
  window.__appInitError = error;
  console.error('App initialization failed:', error);
  console.error(error?.stack || error);
});
