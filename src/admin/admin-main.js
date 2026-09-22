import { adminState } from './admin-state.js';
import { initAdminAuth } from './admin-auth.js';
import { adminApi } from './admin-api.js';
import { renderUnlockScreen } from './screens/unlock-screen.js';
import { renderDashboardShell } from './admin-shell.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('admin-root');
  if (!root) return;

  let countsUnsub = null;

  // Subscribe to auth state
  initAdminAuth(user => {
    if (!user) {
      if (countsUnsub) {
        countsUnsub();
        countsUnsub = null;
      }
      renderUnlockScreen(root);
    } else {
      // Start global real-time counters
      if (!countsUnsub) {
        countsUnsub = adminApi.initRealtimeCounts();
      }
      renderDashboardShell(root);
    }
  });

  // Re-render when state changes (e.g. active tab or counts)
  let lastTab = -1;
  let lastUser = null;

  adminState.subscribe(state => {
    // Only re-render full shell if active user exists and tab changed
    if (state.currentUser && (state.activeTabIndex !== lastTab || state.currentUser !== lastUser)) {
      lastTab = state.activeTabIndex;
      lastUser = state.currentUser;
      renderDashboardShell(root);
    } else if (state.currentUser && state.counts) {
      // Efficiently update sidebar badge numbers without tearing down the whole DOM
      document.querySelectorAll('.admin-nav-item').forEach(item => {
        const idx = Number(item.getAttribute('data-tab-index'));
        const tab = (idx >= 0 && idx < adminState.state ? adminState.state.tabs : null);
      });
    }
  });
});
