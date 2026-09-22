import { ADMIN_TABS, adminState } from './admin-state.js';
import { adminApi } from './admin-api.js';
import { logoutAdmin } from './admin-auth.js';
import { openAnnouncementDialog } from './dialogs/announcement-dialog.js';

// Import Tabs
import { renderOrdersTab } from './tabs/orders-tab.js';
import { renderCatalogTab } from './tabs/catalog-tab.js';
import { renderCategoriesTab } from './tabs/categories-tab.js';
import { renderCollectionsTab } from './tabs/collections-tab.js';
import { renderWebUploadsTab } from './tabs/web-uploads-tab.js';
import { renderSteadfastTab } from './tabs/steadfast-tab.js';

export function renderDashboardShell(rootContainer) {
  const state = adminState.getState();
  const currentTab = ADMIN_TABS[state.activeTabIndex] || ADMIN_TABS[0];
  const userEmail = state.currentUser?.email || 'Super Admin';

  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  }).format(now);

  rootContainer.innerHTML = `
    <div class="flex h-screen bg-[#F8FAFC] overflow-hidden">
      
      <!-- Mobile Drawer Backdrop -->
      <div id="admin-mobile-backdrop" class="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden hidden transition-opacity duration-300"></div>

      <!-- Left Sidebar Desktop & Mobile -->
      <aside id="admin-sidebar" class="fixed lg:static inset-y-0 left-0 w-68 bg-[#0F172A] z-50 transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col justify-between shadow-2xl lg:shadow-none flex-shrink-0 select-none">
        
        <!-- Sidebar Top: Brand & Navigation -->
        <div class="flex flex-col h-full overflow-hidden">
          
          <!-- Brand Logo Header -->
          <div class="p-5 flex items-center justify-between border-b border-[#1E293B]">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F766E] to-[#0284C7] p-0.5 shadow-md shadow-teal-900/50 flex items-center justify-center">
                <div class="w-full h-full bg-[#0F172A] rounded-[10px] flex items-center justify-center">
                  <i class="fa-solid fa-shapes text-teal-400 text-lg"></i>
                </div>
              </div>
              <div>
                <h2 class="text-sm font-bold text-white tracking-tight">Petty Bloom</h2>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span class="text-[9px] font-extrabold tracking-widest text-slate-400">ADMIN WEB PORTAL</span>
                </div>
              </div>
            </div>

            <!-- Mobile Close Drawer Button -->
            <button id="close-drawer-btn" class="lg:hidden text-slate-400 hover:text-white p-1">
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          <!-- Navigation Links Scrollable -->
          <div class="flex-1 overflow-y-auto sidebar-scroll p-3 space-y-5">
            
            <!-- Section 1: Orders & Payments -->
            <div>
              <div class="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Orders & Payments
              </div>
              <div class="space-y-1">
                ${ADMIN_TABS.slice(0, 6).map((tab, idx) => buildNavItemHtml(tab, idx, state)).join('')}
              </div>
            </div>

            <!-- Section 2: Courier Management -->
            <div>
              <div class="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Courier Management
              </div>
              <div class="space-y-1">
                ${buildNavItemHtml(ADMIN_TABS[10], 10, state)}
              </div>
            </div>

            <!-- Section 3: Customer Web Submissions -->
            <div>
              <div class="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Customer Web Submissions
              </div>
              <div class="space-y-1">
                ${buildNavItemHtml(ADMIN_TABS[9], 9, state)}
              </div>
            </div>

            <!-- Section 4: Catalog & Assets -->
            <div>
              <div class="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Catalog & Assets
              </div>
              <div class="space-y-1">
                ${buildNavItemHtml(ADMIN_TABS[6], 6, state)}
                ${buildNavItemHtml(ADMIN_TABS[7], 7, state)}
                ${buildNavItemHtml(ADMIN_TABS[8], 8, state)}
              </div>
            </div>

            <!-- Section 5: Store Settings -->
            <div>
              <div class="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Store Settings
              </div>
              <button id="sidebar-announcement-btn" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all text-left group">
                <div class="flex items-center gap-2.5">
                  <i class="fa-solid fa-bullhorn text-[#0D9488] text-sm group-hover:scale-110 transition-transform"></i>
                  <div>
                    <div class="text-white font-medium">Announcement Bar</div>
                    <div class="text-[10px] text-slate-400">Edit top banner</div>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-[10px] text-slate-500 group-hover:translate-x-0.5 transition-transform"></i>
              </button>
            </div>

          </div>

          <!-- Sidebar Footer: Admin Profile & Logout -->
          <div class="p-3 border-t border-[#1E293B]">
            <div class="bg-[#1E293B] border border-[#334155] rounded-2xl p-3 flex items-center justify-between">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-[#0F766E] flex items-center justify-center text-white flex-shrink-0 shadow-xs">
                  <i class="fa-solid fa-shield-halved text-sm"></i>
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-white truncate" title="${userEmail}">${userEmail}</div>
                  <div class="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Firebase Admin
                  </div>
                </div>
              </div>

              <button id="admin-logout-btn" class="w-8 h-8 rounded-lg text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 flex items-center justify-center transition-colors flex-shrink-0" title="Sign Out Admin">
                <i class="fa-solid fa-arrow-right-from-bracket text-xs"></i>
              </button>
            </div>
          </div>

        </div>
      </aside>

      <!-- Main App Content Area -->
      <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        <!-- Top Web Header (70px) -->
        <header class="h-[70px] bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between flex-shrink-0">
          
          <div class="flex items-center gap-3 min-w-0">
            <!-- Mobile Menu Toggle Button -->
            <button id="mobile-menu-toggle-btn" class="lg:hidden w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center">
              <i class="fa-solid fa-bars text-sm"></i>
            </button>

            <!-- Breadcrumbs & Tab Title -->
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <span>Dashboard</span>
                <span>/</span>
                <span class="font-semibold" style="color: ${currentTab.color};">${currentTab.shortTitle}</span>
              </div>
              <h1 class="text-base sm:text-lg font-bold text-slate-900 truncate">${currentTab.title}</h1>
            </div>
          </div>

          <!-- Right Header Controls -->
          <div class="flex items-center gap-2 sm:gap-3">
            
            <!-- Live Date Badge (Desktop) -->
            <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/60 text-xs font-semibold text-slate-600">
              <i class="fa-regular fa-calendar text-slate-400 text-xs"></i>
              <span>${dateStr}</span>
            </div>

            <!-- Quick Announcement Editor Button -->
            <button id="header-announcement-btn" class="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 flex items-center justify-center transition-colors" data-tooltip="Edit Announcement Bar">
              <i class="fa-solid fa-bullhorn text-xs"></i>
            </button>

            <!-- Quick Categories Button -->
            <button id="header-categories-btn" class="hidden md:flex w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors" data-tooltip="Manage Categories">
              <i class="fa-solid fa-tags text-xs"></i>
            </button>

            <!-- Quick Collections Button -->
            <button id="header-collections-btn" class="hidden md:flex w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors" data-tooltip="Manage Collections">
              <i class="fa-solid fa-layer-group text-xs"></i>
            </button>

            <!-- Timeout Check Button -->
            <button id="header-timeout-check-btn" class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors" data-tooltip="Run Order Timeout Check">
              <i class="fa-solid fa-stopwatch text-xs" id="timeout-check-icon"></i>
            </button>

            <!-- Cleanup Stale Uploads Button -->
            <button id="header-cleanup-uploads-btn" class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors" data-tooltip="Cleanup Stale Uploads">
              <i class="fa-solid fa-broom text-xs" id="cleanup-uploads-icon"></i>
            </button>

          </div>

        </header>

        <!-- Main Body Tab Content -->
        <main class="flex-1 p-3 sm:p-5 overflow-hidden">
          <div class="w-full h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col" id="tab-viewport">
            <!-- Rendered by active tab module -->
          </div>
        </main>

      </div>

    </div>
  `;

  // Wire Shell Controls
  wireShellEvents(rootContainer);

  // Render the active tab content
  renderActiveTabContent(rootContainer.querySelector('#tab-viewport'));
}

/**
 * Build Single Sidebar Nav Item HTML
 */
function buildNavItemHtml(tab, index, state) {
  const isSelected = state.activeTabIndex === index;
  const count = tab.countKey ? (state.counts[tab.countKey] || 0) : 0;

  return `
    <button 
      data-tab-index="${index}" 
      class="admin-nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
        isSelected 
          ? 'bg-[#0F766E]/25 text-[#2DD4BF] border border-[#0F766E]' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
      }"
    >
      <div class="flex items-center gap-3 min-w-0">
        <i class="${tab.icon} text-sm flex-shrink-0 ${isSelected ? 'text-[#2DD4BF]' : 'text-slate-400'}"></i>
        <span class="truncate ${isSelected ? 'text-white font-bold' : ''}">${tab.title}</span>
      </div>

      ${tab.countKey !== null && count > 0 ? `
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isSelected ? 'bg-[#0F766E] text-white' : 'bg-slate-800 text-slate-300'
        }">
          ${count}
        </span>
      ` : ''}
    </button>
  `;
}

/**
 * Wire Header & Sidebar interactions
 */
function wireShellEvents(container) {
  const sidebar = container.querySelector('#admin-sidebar');
  const backdrop = container.querySelector('#admin-mobile-backdrop');
  const toggleBtn = container.querySelector('#mobile-menu-toggle-btn');
  const closeBtn = container.querySelector('#close-drawer-btn');

  const openDrawer = () => {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  };

  const closeDrawer = () => {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  };

  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  // Tab navigation clicks
  container.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-tab-index'));
      closeDrawer();
      adminState.setActiveTab(idx);
    });
  });

  // Announcement Dialog
  const annBtn = container.querySelector('#sidebar-announcement-btn');
  const headAnnBtn = container.querySelector('#header-announcement-btn');
  if (annBtn) annBtn.addEventListener('click', () => { closeDrawer(); openAnnouncementDialog(); });
  if (headAnnBtn) headAnnBtn.addEventListener('click', openAnnouncementDialog);

  // Quick categories & collections
  const catBtn = container.querySelector('#header-categories-btn');
  const colBtn = container.querySelector('#header-collections-btn');
  if (catBtn) catBtn.addEventListener('click', () => adminState.setActiveTab(7));
  if (colBtn) colBtn.addEventListener('click', () => adminState.setActiveTab(8));

  // Timeout Check
  const timeoutBtn = container.querySelector('#header-timeout-check-btn');
  const timeoutIcon = container.querySelector('#timeout-check-icon');
  if (timeoutBtn) {
    timeoutBtn.addEventListener('click', async () => {
      timeoutIcon.classList.add('animate-spin');
      try {
        const res = await adminApi.runTimeoutCheck();
        adminState.showToast('info', `Checked ${res.checked_count} orders, ${res.timeout_count} timed out.`);
      } catch (e) {
        adminState.showToast('error', 'Timeout check error: ' + e.message);
      } finally {
        timeoutIcon.classList.remove('animate-spin');
      }
    });
  }

  // Cleanup Stale Uploads
  const cleanupBtn = container.querySelector('#header-cleanup-uploads-btn');
  const cleanupIcon = container.querySelector('#cleanup-uploads-icon');
  if (cleanupBtn) {
    cleanupBtn.addEventListener('click', async () => {
      if (!confirm('Clean up stale photo uploads older than 2 hours? This will remove abandoned web uploads.')) return;
      cleanupIcon.classList.add('animate-spin');
      try {
        const res = await adminApi.cleanupStaleUploads();
        adminState.showToast('success', `Cleaned up ${res.cleaned_count} stale upload sessions.`);
      } catch (e) {
        adminState.showToast('error', 'Cleanup error: ' + e.message);
      } finally {
        cleanupIcon.classList.remove('animate-spin');
      }
    });
  }

  // Logout
  const logoutBtn = container.querySelector('#admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to sign out of the Admin Portal?')) return;
      await logoutAdmin();
      adminState.showToast('info', 'Admin signed out');
    });
  }
}

/**
 * Render the chosen tab inside #tab-viewport
 */
function renderActiveTabContent(viewport) {
  if (!viewport) return;
  const index = adminState.getState().activeTabIndex;

  // 0: Pending, 1: Paid, 2: Flagged, 3: Unmatched, 4: Completed, 5: Cancelled
  if (index >= 0 && index <= 5) {
    const statusMap = ['pending', 'paid', 'flagged', 'unmatched', 'completed', 'cancelled'];
    renderOrdersTab(viewport, statusMap[index]);
  } else if (index === 6) {
    renderCatalogTab(viewport);
  } else if (index === 7) {
    renderCategoriesTab(viewport);
  } else if (index === 8) {
    renderCollectionsTab(viewport);
  } else if (index === 9) {
    renderWebUploadsTab(viewport);
  } else if (index === 10) {
    renderSteadfastTab(viewport);
  }
}
