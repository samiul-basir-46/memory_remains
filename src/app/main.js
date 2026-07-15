import { renderSiteShell } from '../components/site-shell.js';
import { createAppController } from '../services/app-controller.js';

const pageId = document.body.dataset.page || 'home';

renderSiteShell(pageId);

const controller = createAppController(pageId);
controller.init().catch((error) => {
  window.__appInitError = error;
  console.error('App initialization failed:', error);
  console.error(error?.stack || error);
});
