import { SITE_CONFIG } from '../config/site-config.js';
import { openAuthModal } from '../services/auth-service.js';
import { getCurrentGpsLocation } from '../services/location-service.js';
import { fetchCategories, fetchCollections } from '../services/templates-service.js';

export function openModal(modal, overlay) {
  if (modal) {
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100', 'pointer-events-auto');
  }
  if (overlay) {
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100', 'pointer-events-auto', 'is-visible');
  }
}

export function closeModal(modal, overlay) {
  if (modal) {
    modal.classList.remove('opacity-100', 'pointer-events-auto');
    modal.classList.add('opacity-0', 'pointer-events-none');
  }
  if (overlay) {
    overlay.classList.remove('opacity-100', 'pointer-events-auto', 'is-visible');
    overlay.classList.add('opacity-0', 'pointer-events-none');
  }
}

export async function populateNavCategories(db) {
  if (!db) return;
  try {
    const cats = await fetchCategories(db);
    const container = document.querySelector('.megamenu-grid-categories');
    if (container && cats && cats.length > 0) {
      container.innerHTML = cats.map((cat) => {
        const titleUpper = (cat.name || '').toUpperCase();
        const display = titleUpper.replace(/\s+/g, '<br>');
        const img = cat.image_url || cat.imageUrl || cat.cover_image_url || '';
        return `
          <a href="/collections/paid-products?category=${encodeURIComponent(cat.slug || cat.id || cat.name)}" class="megamenu-card flex flex-col gap-2 no-underline group">
            <div class="megamenu-card-bg relative overflow-hidden bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-3 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl">
              ${img ? `<img src="${img}" alt="${cat.name}" class="absolute inset-0 w-full h-full object-cover rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" />` : ''}
              <span class="relative z-10 text-white font-heading text-base font-bold leading-tight text-glow">${display}</span>
            </div>
            <span class="megamenu-card-title text-text-dark text-xs font-semibold text-center group-hover:text-primary transition-colors">${cat.name}</span>
          </a>
        `;
      }).join('');
    }

    const mobileCatContent = document.querySelector('.mobile-drawer-categories-content');
    if (mobileCatContent && cats && cats.length > 0) {
      mobileCatContent.innerHTML = cats.map((cat) => {
        const img = cat.image_url || cat.imageUrl || '';
        return `
          <a href="/collections/paid-products?category=${encodeURIComponent(cat.slug || cat.id || cat.name)}" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 flex items-center gap-3 hover:text-primary transition-colors">
            ${img ? `<img src="${img}" alt="${cat.name}" class="w-6 h-6 rounded-md object-cover" />` : ''}
            <span>${cat.name}</span>
          </a>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('Failed to populate nav categories:', err);
  }
}

export async function populateNavCollections(db) {
  if (!db) return;
  try {
    const cols = await fetchCollections(db);
    const mainGrid = document.querySelector('.megamenu-grid-collections');
    const sidebarList = document.querySelector('.megamenu-collections-sidebar-list');

    if (cols && cols.length > 0) {
      const mainItems = cols.slice(0, 4);
      const sideItems = cols.slice(4);

      if (mainGrid) {
        mainGrid.innerHTML = mainItems.map((col) => {
          const name = col.name || col.title || '';
          const titleUpper = name.toUpperCase();
          const display = titleUpper.replace(/\s+/g, '<br>');
          const img = col.cover_image_url || col.coverImageUrl || col.image_url || '';
          return `
            <a href="/collections/paid-products?collection=${encodeURIComponent(col.slug || col.id || name)}" class="megamenu-card flex flex-col gap-3 no-underline group">
              <div class="megamenu-card-bg relative overflow-hidden bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-4 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl">
                ${img ? `<img src="${img}" alt="${name}" class="absolute inset-0 w-full h-full object-cover rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" />` : ''}
                <span class="relative z-10 text-white font-heading text-2xl font-bold leading-tight text-glow">${display}</span>
              </div>
              <span class="megamenu-card-title text-text-dark text-sm font-semibold text-center group-hover:text-primary transition-colors">${name}</span>
            </a>
          `;
        }).join('');
      }

      if (sidebarList && sideItems.length > 0) {
        sidebarList.innerHTML = sideItems.map((col) => {
          const name = col.name || col.title || '';
          return `<li><a href="/collections/paid-products?collection=${encodeURIComponent(col.slug || col.id || name)}" class="text-text-dark no-underline text-sm hover:text-primary transition-colors">${name}</a></li>`;
        }).join('');
      }

      const mobileColContent = document.querySelector('.mobile-drawer-collections-content');
      if (mobileColContent && cols.length > 0) {
        mobileColContent.innerHTML = cols.map((col) => {
          const name = col.name || col.title || '';
          const img = col.cover_image_url || col.coverImageUrl || '';
          return `
            <a href="/collections/paid-products?collection=${encodeURIComponent(col.slug || col.id || name)}" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 flex items-center gap-3 hover:text-primary transition-colors">
              ${img ? `<img src="${img}" alt="${name}" class="w-6 h-6 rounded-md object-cover" />` : ''}
              <span>${name}</span>
            </a>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Failed to populate nav collections:', err);
  }
}

export function openSurface(drawer, overlay) {
  if (drawer) {
    drawer.classList.remove('-left-full', '-right-full');
    if (drawer.classList.contains('filter-drawer')) {
      drawer.classList.add('right-0');
    } else {
      drawer.classList.add('left-0');
    }
  }
  if (overlay) {
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100', 'pointer-events-auto', 'is-visible');
  }
}

export function closeSurface(drawer, overlay) {
  if (drawer) {
    drawer.classList.remove('left-0', 'right-0');
    if (drawer.classList.contains('filter-drawer')) {
      drawer.classList.add('-right-full');
    } else {
      drawer.classList.add('-left-full');
    }
  }
  if (overlay) {
    overlay.classList.remove('opacity-100', 'pointer-events-auto', 'is-visible');
    overlay.classList.add('opacity-0', 'pointer-events-none');
  }
}

function renderNavLinks(pageId, isMobile = false) {
  return SITE_CONFIG.navLinks.map((link) => {
    const activeClass = link.page === pageId ? 'is-active' : '';
    const isDropdown = !isMobile && (link.label === 'Categories' || link.label === 'Collections');
    const isFeatured = link.label === 'Featured Products';

    let icon = '';
    if (isFeatured) {
      icon = ' <i class="fa-solid fa-wand-magic-sparkles text-xs ml-1.5 text-[#3b1c1c]"></i>';
    } else if (isDropdown) {
      icon = ' <i class="fa-solid fa-chevron-down text-[0.7em] ml-1 text-[#3b1c1c] transition-transform duration-200"></i>';
    }

    let dropdownHtml = '';
    if (isDropdown) {
      if (link.label === 'Categories') {
        dropdownHtml = `
          <div class="megamenu-dropdown absolute top-full left-0 w-full bg-white border-b border-pink-100 shadow-2xl py-8 opacity-0 invisible transition-all duration-200 z-50 pointer-events-none">
            <div class="megamenu-inner max-w-container mx-auto px-4 flex gap-8 relative">
              <button type="button" class="megamenu-close-btn absolute -top-4 right-4 text-3xl text-gray-700 hover:text-primary cursor-pointer p-1" aria-label="Close menu">&times;</button>
              <div class="megamenu-grid megamenu-grid-categories flex-1 grid grid-cols-5 gap-4 pr-4">
                <a href="/collections/paid-products?title=Magazine+%26+Newspaper" class="megamenu-card flex flex-col gap-2 no-underline group">
                  <div class="megamenu-card-bg bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-3 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl">
                    <span class="text-white font-heading text-base font-bold leading-tight text-glow">MAGAZINE<br>&<br>NEWSPAPER</span>
                  </div>
                  <span class="megamenu-card-title text-text-dark text-xs font-semibold text-center group-hover:text-primary transition-colors">Magazine & Newspaper</span>
                </a>
              </div>
              <div class="megamenu-sidebar w-[220px] border-l border-pink-100 pl-8 pr-4">
                <h4 class="text-sm mb-4 text-text-soft font-medium">Browse Categories</h4>
                <ul class="list-none p-0 m-0 grid gap-3">
                  <li><a href="/collections/paid-products" class="text-text-dark no-underline text-sm hover:text-primary transition-colors">All Products</a></li>
                </ul>
              </div>
            </div>
          </div>
        `;

      } else if (link.label === 'Collections') {
        dropdownHtml = `
          <div class="megamenu-dropdown absolute top-full left-0 w-full bg-white border-b border-pink-100 shadow-2xl py-8 opacity-0 invisible transition-all duration-200 z-50 pointer-events-none">
            <div class="megamenu-inner max-w-container mx-auto px-4 flex gap-8 relative">
              <button type="button" class="megamenu-close-btn absolute -top-4 right-4 text-3xl text-gray-700 hover:text-primary cursor-pointer p-1" aria-label="Close menu">&times;</button>
              <div class="megamenu-grid megamenu-grid-collections flex-1 grid grid-cols-4 gap-6 pr-4">
                <a href="/collections/paid-products?title=FOR+HER" class="megamenu-card flex flex-col gap-3 no-underline group">
                  <div class="megamenu-card-bg bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-4 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl"><span class="text-white font-heading text-2xl font-bold leading-tight text-glow">FOR HER</span></div>
                  <span class="megamenu-card-title text-text-dark text-sm font-semibold text-center group-hover:text-primary transition-colors">FOR HER</span>
                </a>
                <a href="/collections/paid-products?title=I+Love+My+Self" class="megamenu-card flex flex-col gap-3 no-underline group">
                  <div class="megamenu-card-bg bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-4 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl"><span class="text-white font-heading text-2xl font-bold leading-tight text-glow">I LOVE<br>MY SELF</span></div>
                  <span class="megamenu-card-title text-text-dark text-sm font-semibold text-center group-hover:text-primary transition-colors">I Love My Self</span>
                </a>
                <a href="/collections/paid-products?title=Best+Selling" class="megamenu-card flex flex-col gap-3 no-underline group">
                  <div class="megamenu-card-bg bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-4 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl"><span class="text-white font-heading text-2xl font-bold leading-tight text-glow">BEST<br>SELLING</span></div>
                  <span class="megamenu-card-title text-text-dark text-sm font-semibold text-center group-hover:text-primary transition-colors">Best Selling</span>
                </a>
                <a href="/collections/paid-products?title=Birthday+Special" class="megamenu-card flex flex-col gap-3 no-underline group">
                  <div class="megamenu-card-bg bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-4 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl"><span class="text-white font-heading text-2xl font-bold leading-tight text-glow">BIRTHDAY<br>SPECIAL</span></div>
                  <span class="megamenu-card-title text-text-dark text-sm font-semibold text-center group-hover:text-primary transition-colors">Birthday Special</span>
                </a>
              </div>
              <div class="megamenu-sidebar w-[250px] border-l border-pink-100 pl-8 pr-12">
                <h4 class="text-sm mb-4 text-text-soft font-medium">Other Collections</h4>
                <ul class="list-none p-0 m-0 grid gap-3 megamenu-collections-sidebar-list">
                  <li><a href="/collections/paid-products?title=FOR+HIM" class="text-text-dark no-underline text-sm hover:text-primary transition-colors">FOR HIM</a></li>
                </ul>
              </div>
            </div>
          </div>
        `;
      }
    }

    const hrefAttr = isDropdown ? '#' : link.href;

    return `
      <div class="nav-item-wrapper ${isDropdown ? 'has-dropdown' : ''} static">
        <a href="${hrefAttr}" class="nav-link ${activeClass}">
          ${link.label}${icon}
        </a>
        ${dropdownHtml}
      </div>
    `;
  }).join('');
}

function renderFooterGroup(group) {
  const links = group.links.map((link) => `<li><a href="${link.href}" class="text-white/80 hover:text-bg-elevated text-sm transition-colors">${link.label}</a></li>`).join('');
  return `
    <div class="footer-group">
      <h4 class="text-white font-heading font-bold text-base mb-3.5">${group.title}</h4>
      <ul class="list-none p-0 m-0 grid gap-3">${links}</ul>
    </div>
  `;
}

function renderSocialLinks() {
  return SITE_CONFIG.socialLinks.map((link) => (
    `<a href="${link.href}" target="_blank" rel="noreferrer" aria-label="${link.label}" class="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors">
      <i class="fa-brands ${link.icon}"></i>
      <span>${link.label}</span>
    </a>`
  )).join('');
}

export function renderSiteShell(pageId) {
  const shell = document.getElementById('site-shell');
  const overlays = document.getElementById('site-overlays');
  if (!shell || !overlays) {
    return;
  }

  shell.className = 'sticky top-0 z-[1000] w-full transition-transform duration-350 ease-in-out';

  shell.innerHTML = `
    <div id="announcement-bar-container" class="announcement-bar py-2.5 text-center text-xs font-medium tracking-wider text-white bg-accent overflow-hidden relative whitespace-nowrap">
      <div class="announcement-bar__track animate-marquee inline-flex whitespace-nowrap">
        <div class="announcement-bar__content inline-flex items-center" style="padding-right:100vw;">
          <span id="announcement-bar-text-1">${SITE_CONFIG.announcement}</span>
        </div>
        <div class="announcement-bar__content inline-flex items-center" style="padding-right:100vw;" aria-hidden="true">
          <span id="announcement-bar-text-2">${SITE_CONFIG.announcement}</span>
        </div>
      </div>
    </div>
    <header class="site-header relative z-40 backdrop-blur-md bg-white/95 border-b border-pink-100">
      <div class="max-w-container mx-auto px-4 flex items-center justify-between gap-4 min-h-[76px] md:grid md:grid-cols-3">
        <!-- Hamburger Menu toggle (mobile left) -->
        <button class="menu-toggle md:hidden cursor-pointer text-[#3b1c1c] text-xl p-1" type="button" aria-label="Toggle Menu">
          <i class="fa-solid fa-bars"></i>
        </button>

        <!-- Brand Logo -->
        <a class="site-logo flex items-center gap-2.5 no-underline" href="/">
          <div class="w-11 h-11 rounded-full bg-[#3b1c1c] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
            <img src="/assets/IMG-20260715-WA0003.jpg" alt="${SITE_CONFIG.brandName} Logo" class="w-full h-full object-cover">
          </div>
          <span class="site-logo__text font-heading text-xl md:text-2xl text-[#3b1c1c] font-bold">${SITE_CONFIG.brandName}</span>
        </a>
        
        <!-- Search bar (Desktop) -->
        <div class="header-search hidden md:flex items-center relative max-w-[520px] mx-auto w-full">
          <input type="text" id="header-search-input" placeholder="Search anything..." aria-label="Search" class="w-full py-2.5 px-4 pr-10 border border-gray-300 rounded-lg bg-transparent text-text-dark outline-none text-sm focus:border-primary transition-colors">
          <i class="fa-solid fa-magnifying-glass absolute right-3.5 text-text-soft pointer-events-none"></i>
        </div>
        
        <div class="site-actions flex items-center justify-end gap-3.5">
          <button id="location-btn" class="pill-button location-btn hidden md:inline-flex items-center gap-1.5 bg-primary hover:bg-primary-strong text-white px-4 py-2 text-xs font-medium rounded-lg shadow-sm transition-colors" type="button">
            <i class="fa-solid fa-map-pin"></i>
            <span>Check Location</span>
          </button>

          <!-- Mobile Search Toggle Icon -->
          <button id="mobile-search-toggle-btn" class="mobile-search-toggle md:hidden text-[#3b1c1c] text-lg p-1" type="button" aria-label="Search">
            <i class="fa-solid fa-magnifying-glass"></i>
          </button>
          
          <a href="/pages/cart" class="cart-icon relative text-[#3b1c1c] text-xl mx-1.5 cursor-pointer hover:text-primary transition-colors flex items-center justify-center no-underline" aria-label="Shopping Cart">
            <i class="fa-solid fa-cart-shopping"></i>
            <span class="cart-count cart-badge-count absolute -top-2 -right-2.5 w-4.5 h-4.5 grid place-items-center rounded-full bg-primary text-white text-[10px] font-bold shadow-sm">0</span>
          </a>
          
          <div class="user-profile-menu-wrapper relative">
            <button id="auth-nav-btn" class="flex items-center gap-2 text-[#3b1c1c] hover:text-primary text-sm font-semibold p-1 transition-colors cursor-pointer" type="button">
              <div id="header-user-avatar" class="w-8 h-8 rounded-full bg-pink-100 text-primary flex items-center justify-center font-bold text-xs overflow-hidden border border-pink-200 shadow-sm hidden">
                <img id="header-user-avatar-img" src="" class="w-full h-full object-cover hidden" alt="Profile">
                <span id="header-user-avatar-initials">U</span>
              </div>
              <span id="header-user-btn-text">Sign In</span>
            </button>
            <div id="user-profile-dropdown" class="user-dropdown-menu absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 shadow-xl rounded-xl py-2 hidden z-50">
              <div id="user-dropdown-info" class="px-4 py-2 border-b border-gray-100">
                <p id="user-dropdown-name" class="text-sm font-bold text-gray-800 truncate">User Name</p>
                <p id="user-dropdown-email" class="text-xs text-gray-500 truncate">user@example.com</p>
              </div>
              <a href="/pages/profile" class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-primary transition-colors no-underline">
                <i class="fa-regular fa-user text-primary"></i>
                <span>My Profile</span>
              </a>
              <a href="/pages/profile#orders" class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-primary transition-colors no-underline">
                <i class="fa-solid fa-box-archive text-primary"></i>
                <span>My Orders</span>
              </a>
              <div class="border-t border-gray-100 my-1"></div>
              <button id="header-logout-btn" class="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left" type="button">
                <i class="fa-solid fa-right-from-bracket"></i>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Mobile Search Bar input box -->
      <div id="mobile-search-bar" class="mobile-search-bar hidden md:hidden bg-white border-b border-pink-100 py-2 shadow-sm">
        <div class="max-w-container mx-auto px-4">
          <input type="text" id="mobile-search-input" placeholder="Search anything..." aria-label="Search" class="w-full py-2 px-4 rounded-lg border border-gray-300 outline-none text-sm">
        </div>
      </div>
      
      <!-- Sub navigation row -->
      <nav class="site-sub-nav hidden md:block border-t border-pink-100 bg-white shadow-sm" aria-label="Primary">
        <div class="max-w-container mx-auto px-4 flex items-center justify-around max-w-[900px]">
          ${renderNavLinks(pageId)}
        </div>
      </nav>
    </header>

    <aside class="mobile-drawer fixed top-0 -left-full z-[1001] w-[min(85vw,320px)] h-screen bg-white transition-[left] duration-300 flex flex-col shadow-2xl overflow-hidden" id="mobile-drawer">
      <div class="mobile-drawer__header flex items-center justify-between p-5 border-b border-gray-100">
        <div class="mobile-drawer__brand flex items-center gap-3">
          <div class="w-11 h-11 rounded-full bg-[#3b1c1c] flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="/assets/IMG-20260715-WA0003.jpg" alt="${SITE_CONFIG.brandName} Logo" class="w-full h-full object-cover">
          </div>
          <span class="mobile-drawer__brand-title font-heading text-lg font-bold text-[#2b1717]">${SITE_CONFIG.brandName}</span>
        </div>
        <button id="mobile-drawer-close-btn" class="mobile-drawer__close-btn text-xl text-[#2b1717] p-1 cursor-pointer" type="button" aria-label="Close menu">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="mobile-drawer__nav flex-1 p-5 flex flex-col gap-5 overflow-y-auto">
        <a href="/pages/featured" class="mobile-drawer__link font-heading text-base font-semibold text-[#2b1717] no-underline flex items-center justify-between hover:text-primary transition-colors">
          <span>Featured Products</span>
          <i class="fa-solid fa-wand-magic-sparkles text-sm text-[#3b1c1c]"></i>
        </a>

        <div class="mobile-drawer__accordion">
          <button type="button" class="mobile-drawer__accordion-toggle font-heading text-base font-semibold text-[#2b1717] flex items-center justify-between w-full hover:text-primary transition-colors">
            <span>Categories</span>
            <i class="fa-solid fa-chevron-down text-sm"></i>
          </button>
          <div class="mobile-drawer__accordion-content mobile-drawer-categories-content hidden flex-col mt-2 border-t border-gray-100">
            <a href="/collections/paid-products?title=Magazine+%26+Newspaper" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 hover:text-primary transition-colors">Magazine & Newspaper</a>
          </div>
        </div>

        <div class="mobile-drawer__accordion">
          <button type="button" class="mobile-drawer__accordion-toggle font-heading text-base font-semibold text-[#2b1717] flex items-center justify-between w-full hover:text-primary transition-colors">
            <span>Collections</span>
            <i class="fa-solid fa-chevron-down text-sm"></i>
          </button>
          <div class="mobile-drawer__accordion-content mobile-drawer-collections-content hidden flex-col mt-2 border-t border-gray-100">
            <a href="/collections/paid-products?title=FOR+HER" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 hover:text-primary transition-colors">FOR HER</a>
            <a href="/collections/paid-products?title=I+Love+My+Self" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 hover:text-primary transition-colors">I Love My Self</a>
            <a href="/collections/paid-products?title=Best+Selling" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 hover:text-primary transition-colors">Best Selling</a>
            <a href="/collections/paid-products?title=Birthday+Special" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 hover:text-primary transition-colors">Birthday Special</a>
            <a href="/collections/paid-products?title=FOR+HIM" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 hover:text-primary transition-colors">FOR HIM</a>
          </div>
        </div>

        <a href="/collections/paid-products?title=All+Products" class="mobile-drawer__link font-heading text-base font-semibold text-[#2b1717] no-underline flex items-center justify-between hover:text-primary transition-colors">All Products</a>
      </div>

      <div class="mobile-drawer__footer p-5 border-t border-gray-200 bg-white mt-auto">
        <!-- Guest State: Sign In Button -->
        <button id="auth-mobile-btn" class="mobile-drawer__auth-btn flex items-center gap-3 text-base font-semibold text-[#2b1717] hover:text-primary transition-colors cursor-pointer w-full" type="button">
          <div class="w-9 h-9 rounded-full bg-pink-50 border border-pink-100 text-primary flex items-center justify-center text-base">
            <i class="fa-regular fa-user"></i>
          </div>
          <span id="mobile-auth-btn-text">Sign In</span>
        </button>

        <!-- Logged-in User Profile Container -->
        <div id="mobile-user-profile-box" class="space-y-3 hidden">
          <div class="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div id="mobile-user-avatar" class="w-10 h-10 rounded-full bg-pink-100 text-primary flex items-center justify-center font-bold text-sm overflow-hidden border border-pink-200 shadow-sm flex-shrink-0">
              <img id="mobile-user-avatar-img" src="" class="w-full h-full object-cover hidden" alt="Profile">
              <span id="mobile-user-avatar-initials">U</span>
            </div>
            <div class="flex-1 min-w-0">
              <p id="mobile-user-name" class="text-sm font-bold text-gray-800 truncate">Account</p>
              <p id="mobile-user-email" class="text-xs text-gray-500 truncate"></p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <a href="/pages/profile" class="py-2.5 px-3 bg-pink-50 text-primary font-bold rounded-lg text-center hover:bg-pink-100 transition-colors no-underline">My Profile</a>
            <button id="mobile-logout-btn" type="button" class="py-2.5 px-3 bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-700 font-bold rounded-lg text-center transition-colors cursor-pointer">Logout</button>
          </div>
        </div>
      </div>
    </aside>
    <div class="screen-overlay drawer-overlay fixed inset-0 bg-black/40 opacity-0 pointer-events-none z-[1000] transition-opacity duration-200" id="screen-overlay"></div>
  `;

  // Dynamically create/append footer
  let footer = document.querySelector('.site-footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.className = 'site-footer mt-16 bg-accent text-white';
    document.body.appendChild(footer);
  }
  footer.innerHTML = `
    <div class="max-w-container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-12">
      <div class="footer-brand pr-8">
        <div class="flex items-center gap-2 mb-6">
          <div class="w-12 h-12 rounded-full bg-[#3b1c1c] flex items-center justify-center overflow-hidden">
            <img src="/assets/IMG-20260715-WA0003.jpg" alt="${SITE_CONFIG.brandName} Logo" class="w-full h-full object-cover">
          </div>
          <h3 class="font-heading text-2xl m-0 text-white">${SITE_CONFIG.brandName}</h3>
        </div>
        
        <div class="flex gap-3 mb-4 items-start text-sm text-white/90">
          <i class="fa-solid fa-location-dot mt-1"></i>
          <p class="m-0">Rampura Bazar, Dhaka</p>
        </div>
        
        <div class="flex gap-3 mb-6 items-center text-sm text-white/90">
          <i class="fa-solid fa-phone"></i>
          <div>
            <div class="text-xs opacity-90">Talk to us</div>
            <div class="font-bold text-white">${SITE_CONFIG.supportPhoneLabel}</div>
          </div>
        </div>
        
        <div class="flex items-center gap-3 text-sm font-bold">
          Connect with us 
          ${renderSocialLinks()}
        </div>
      </div>
      ${SITE_CONFIG.footerGroups.map(renderFooterGroup).join('')}
    </div>
    
    <div class="border-t border-white/20 mx-8"></div>
    
    <div class="max-w-container mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4 text-white text-xs">
      <div class="flex items-center gap-3 flex-wrap">
        <strong>Payment</strong>
        <span class="flex items-center gap-1.5 bg-white/10 rounded-md px-3 py-1.5">
          <i class="fa-solid fa-money-bill-1"></i> Cash on Delivery
        </span>
        <span class="text-white/60 text-[11px]">• COD charge ৳110 additional</span>
      </div>
      <div class="text-white/60">
        © ${new Date().getFullYear()} Petty Bloom. All rights reserved.
      </div>
    </div>

    
    <a href="https://wa.me/8801622000471?text=Hi%2C%20I%27m%20interested%20in%20your%20products" target="_blank" rel="noreferrer" class="whatsapp-float fixed bottom-5 right-5 bg-[#25d366] text-white rounded-full w-14 h-14 flex items-center justify-center text-3xl shadow-lg z-[100] hover:scale-110 transition-transform">
      <i class="fa-brands fa-whatsapp"></i>
    </a>
  `;

  overlays.innerHTML = `
    <!-- Auth Modal -->
    <div class="auth-modal fixed inset-0 z-[1002] flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-200" id="auth-modal">
      <div class="auth-modal__card bg-white rounded-2xl p-6 md:p-8 max-w-sm w-full shadow-2xl relative text-center">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-heading text-2xl text-[#3b1c1c] font-bold">Sign In / Sign Up</h3>
          <button id="auth-modal-close-btn" class="icon-close text-2xl text-gray-400 hover:text-primary cursor-pointer border-none bg-transparent" type="button" aria-label="Close Auth">&times;</button>
        </div>

        <p class="text-xs text-gray-500 mb-6">Sign in to your account to place orders, track purchases, and manage custom photos.</p>

        <div class="space-y-4">
          <button id="btn-google-login" type="button" class="w-full py-3.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-bold border border-gray-300 rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer">
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <button id="btn-facebook-login" type="button" class="w-full py-3.5 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer">
            <i class="fa-brands fa-facebook text-xl"></i>
            <span>Continue with Facebook</span>
          </button>
        </div>
      </div>
    </div>
    <div class="drawer-overlay fixed inset-0 bg-black/40 opacity-0 pointer-events-none z-[1000] transition-opacity duration-200" id="auth-modal-overlay"></div>

    <!-- Photo Upload Modal -->
    <div class="photo-upload-modal fixed inset-0 z-[1002] flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-200" id="photo-upload-modal">
      <div class="upload-modal__card bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-heading text-xl text-primary font-bold">Upload Custom Order Photos</h3>
          <button id="upload-modal-close-btn" class="icon-close text-2xl text-gray-400 hover:text-primary cursor-pointer" type="button">&times;</button>
        </div>
        <p id="upload-modal-desc" class="text-xs text-text-soft mb-4">Please select photos for your order.</p>

        <div class="border-2 border-dashed border-pink-200 rounded-xl p-6 text-center bg-pink-50/40 mb-4 cursor-pointer hover:border-primary transition-colors" id="select-photos-btn">
          <i class="fa-solid fa-cloud-arrow-up text-3xl text-primary mb-2"></i>
          <p class="text-sm font-semibold text-text-dark">Click to choose photos from device</p>
          <p id="upload-selected-count" class="text-xs text-primary font-bold mt-1">0 photos selected</p>
        </div>
        <input type="file" id="photo-file-input" multiple accept="image/*" class="hidden">

        <div id="upload-files-preview" class="max-h-48 overflow-y-auto mb-4 border border-gray-100 rounded-lg p-2"></div>

        <p id="upload-progress-text" class="text-xs text-primary font-semibold mb-3 text-center"></p>

        <button id="start-upload-btn" class="w-full py-3 bg-primary hover:bg-primary-strong disabled:bg-gray-300 text-white font-bold rounded-xl text-sm transition-colors" type="button" disabled>Upload & Submit Photos</button>
      </div>
    </div>
    <div class="drawer-overlay fixed inset-0 bg-black/40 opacity-0 pointer-events-none z-[1000] transition-opacity duration-200" id="upload-modal-overlay"></div>

    <!-- Filter Drawer Panel -->
    <aside class="filter-drawer fixed top-0 -right-full z-[1001] w-[min(90vw,360px)] h-screen bg-white transition-[right] duration-300 flex flex-col shadow-2xl" id="filter-drawer">
      <div class="filter-drawer__header flex items-center justify-between p-5 border-b border-gray-100">
        <h3 class="font-heading text-xl text-[#3b1c1c] font-bold">Filter</h3>
        <div class="flex items-center gap-4">
          <button id="filter-reset-btn" class="text-xs font-semibold text-primary hover:underline cursor-pointer" type="button">Reset All</button>
          <button id="filter-drawer-close-btn" class="text-2xl text-gray-500 hover:text-primary cursor-pointer p-1" type="button" aria-label="Close filters">&times;</button>
        </div>
      </div>

      <div class="filter-drawer__body flex-1 p-5 overflow-y-auto space-y-6">
        <!-- Accordion 1: Inventory -->
        <div class="filter-accordion border-b border-gray-100 pb-4">
          <div class="filter-accordion__header flex justify-between items-center cursor-pointer font-bold text-sm text-[#2b1717]">
            <span>Inventory</span>
            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
          </div>
          <div class="filter-accordion__content mt-3 space-y-2.5">
            <label class="filter-checkbox-item flex items-center justify-between cursor-pointer text-sm text-text-dark">
              <div class="flex items-center gap-3">
                <input type="checkbox" id="filter-in-stock" class="rounded accent-primary">
                <span>In Stock</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Accordion 2: Discount -->
        <div class="filter-accordion border-b border-gray-100 pb-4">
          <div class="filter-accordion__header flex justify-between items-center cursor-pointer font-bold text-sm text-[#2b1717]">
            <span>Discount</span>
            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
          </div>
          <div class="filter-accordion__content mt-3 space-y-2.5">
            <label class="filter-checkbox-item flex items-center justify-between cursor-pointer text-sm text-text-dark">
              <div class="flex items-center gap-3">
                <input type="checkbox" class="discount-filter-cb rounded accent-primary" value="0-20">
                <span>0 - 20%</span>
              </div>
            </label>
            <label class="filter-checkbox-item flex items-center justify-between cursor-pointer text-sm text-text-dark">
              <div class="flex items-center gap-3">
                <input type="checkbox" class="discount-filter-cb rounded accent-primary" value="21-40">
                <span>21 - 40%</span>
              </div>
            </label>
            <label class="filter-checkbox-item flex items-center justify-between cursor-pointer text-sm text-text-dark">
              <div class="flex items-center gap-3">
                <input type="checkbox" class="discount-filter-cb rounded accent-primary" value="41-60">
                <span>41 - 60%</span>
              </div>
            </label>
            <label class="filter-checkbox-item flex items-center justify-between cursor-pointer text-sm text-text-dark">
              <div class="flex items-center gap-3">
                <input type="checkbox" class="discount-filter-cb rounded accent-primary" value="61-80">
                <span>61 - 80%</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Accordion 3: Price Range -->
        <div class="filter-accordion border-b border-gray-100 pb-4">
          <div class="filter-accordion__header flex justify-between items-center cursor-pointer font-bold text-sm text-[#2b1717]">
            <span>Price Range</span>
            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
          </div>
          <div class="filter-accordion__content mt-3">
            <div class="filter-price-slider-wrapper">
              <div class="flex justify-between mb-1 text-xs text-gray-500">
                <span>Minimum</span>
                <span>Maximum</span>
              </div>
              <div class="flex justify-between font-semibold text-sm text-[#2b1717] mb-3">
                <span id="price-min-display">৳0</span>
                <span id="price-max-display">৳3000</span>
              </div>
              
              <div class="dual-range-slider">
                <div class="slider-track"></div>
                <div class="slider-track-fill" id="slider-track-fill"></div>
                <input type="range" id="price-slider-min" min="0" max="3000" value="0" step="1">
                <input type="range" id="price-slider-max" min="0" max="3000" value="3000" step="1">
              </div>
            </div>
          </div>
        </div>
      </div>

    </aside>
    <div class="drawer-overlay fixed inset-0 bg-black/40 opacity-0 pointer-events-none z-[1000] transition-opacity duration-200" id="filter-drawer-overlay"></div>

    <!-- Location Coverage Modal -->
    <div class="location-modal fixed inset-0 z-[1002] flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-200 overflow-y-auto" id="location-modal">
      <div class="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl relative my-auto">
        <div class="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-map-pin text-primary text-lg"></i>
            <h3 class="font-heading text-lg text-gray-800 font-bold">Set Delivery Location</h3>
          </div>
          <button id="location-modal-close-btn" class="text-2xl text-gray-400 hover:text-primary cursor-pointer p-1" type="button" aria-label="Close modal">&times;</button>
        </div>
        <p class="text-xs text-gray-500 mb-4">Choose auto GPS detection or type your exact home address for magazine delivery.</p>

        <!-- Option 1: Auto Detect Current Location (GPS) -->
        <div class="mb-3.5">
          <button type="button" id="modal-use-gps-btn" class="w-full py-2.5 px-4 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-primary font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
            <i class="fa-solid fa-location-crosshairs text-sm text-primary"></i>
            <span id="modal-gps-btn-text">🎯 Auto Detect My Current Location (GPS)</span>
          </button>
        </div>

        <div class="relative flex py-1 items-center mb-3.5">
          <div class="flex-grow border-t border-gray-200"></div>
          <span class="flex-shrink mx-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">or type address manually</span>
          <div class="flex-grow border-t border-gray-200"></div>
        </div>

        <form id="location-modal-form" class="space-y-3.5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Division *</label>
              <select id="modal-division" required class="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs bg-white outline-none focus:border-primary">
                <option value="Dhaka" selected>Dhaka</option>
                <option value="Chattogram">Chattogram</option>
                <option value="Rajshahi">Rajshahi</option>
                <option value="Khulna">Khulna</option>
                <option value="Barishal">Barishal</option>
                <option value="Sylhet">Sylhet</option>
                <option value="Rangpur">Rangpur</option>
                <option value="Mymensingh">Mymensingh</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">District / City *</label>
              <input type="text" id="modal-district" required placeholder="e.g. Dhaka, Gazipur" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs outline-none focus:border-primary">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Thana / Upazila / Area *</label>
              <input type="text" id="modal-upazila" required placeholder="e.g. Mirpur, Sreepur, Uttara" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs outline-none focus:border-primary">
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Postal Code (Optional)</label>
              <input type="text" id="modal-postal" placeholder="e.g. 1230" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs outline-none focus:border-primary">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Detailed House & Street Address *</label>
            <textarea id="modal-address" required rows="2" placeholder="e.g. House 12, Road 5, Block B, Flat 3A" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs outline-none focus:border-primary resize-none"></textarea>
          </div>

          <div class="p-3 rounded-xl bg-pink-50/60 border border-pink-100 space-y-1 text-xs">
            <div class="flex justify-between items-center text-gray-700 font-semibold">
              <span>Home Shipping Fee:</span>
              <strong class="text-primary font-bold">৳60 Flat Rate</strong>
            </div>
            <div class="flex justify-between items-center text-gray-700">
              <span>Estimated Timeline:</span>
              <span id="modal-timeline-text" class="text-emerald-700 font-bold">3 - 5 Days Delivery</span>
            </div>
          </div>

          <button id="location-modal-confirm-btn" type="submit" class="w-full py-3 bg-primary hover:bg-primary-strong text-white font-bold rounded-xl text-sm transition-colors cursor-pointer text-center">Save Delivery Location</button>
        </form>
      </div>
    </div>
    <div class="drawer-overlay fixed inset-0 bg-black/40 opacity-0 pointer-events-none z-[1000] transition-opacity duration-200" id="location-modal-overlay"></div>
  `;

  initStickyHeaderScroll();
  initMegamenuEvents();
  initAllShellButtonEvents();
}

function initAllShellButtonEvents() {
  const hamburgerBtn = document.querySelector('.menu-toggle') || document.getElementById('hamburger-btn');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileDrawerOverlay = document.getElementById('screen-overlay') || document.getElementById('mobile-drawer-overlay');
  const mobileDrawerCloseBtn = document.getElementById('mobile-drawer-close-btn');

  hamburgerBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openSurface(mobileDrawer, mobileDrawerOverlay);
  });

  mobileDrawerCloseBtn?.addEventListener('click', () => {
    closeSurface(mobileDrawer, mobileDrawerOverlay);
  });

  mobileDrawerOverlay?.addEventListener('click', () => {
    closeSurface(mobileDrawer, mobileDrawerOverlay);
  });

  document.addEventListener('click', (e) => {
    if (mobileDrawer && !mobileDrawer.classList.contains('-left-full')) {
      const isClickInside = mobileDrawer.contains(e.target);
      const isClickOnHamburger = hamburgerBtn && hamburgerBtn.contains(e.target);
      if (!isClickInside && !isClickOnHamburger) {
        closeSurface(mobileDrawer, mobileDrawerOverlay);
      }
    }
  });

  document.querySelectorAll('.mobile-drawer__accordion-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const content = btn.nextElementSibling;
      const icon = btn.querySelector('i');
      if (content) {
        content.classList.toggle('hidden');
        content.classList.toggle('flex');
      }
      if (icon) {
        icon.classList.toggle('rotate-180');
      }
    });
  });

  const authMobileBtn = document.getElementById('auth-mobile-btn');
  authMobileBtn?.addEventListener('click', () => {
    closeSurface(mobileDrawer, mobileDrawerOverlay);
    openAuthModal();
  });

  const mobileSearchToggleBtn = document.getElementById('mobile-search-toggle-btn');
  const mobileSearchBar = document.getElementById('mobile-search-bar');
  mobileSearchToggleBtn?.addEventListener('click', () => {
    if (mobileSearchBar) {
      mobileSearchBar.classList.toggle('hidden');
    }
  });

  const searchInput = document.getElementById('header-search-input');
  const mobileSearchInput = document.getElementById('mobile-search-input');

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) {
        window.location.href = `/collections/paid-products?title=${encodeURIComponent(q)}`;
      }
    }
  };

  const locationBtn = document.getElementById('location-btn');
  const locationBtnText = locationBtn?.querySelector('span');
  const locationModal = document.getElementById('location-modal');
  const locationModalOverlay = document.getElementById('location-modal-overlay');
  const locationModalCloseBtn = document.getElementById('location-modal-close-btn');
  const locationModalForm = document.getElementById('location-modal-form');

  // Load saved location on site init
  try {
    const savedRaw = localStorage.getItem('user_delivery_location');
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      if (locationBtnText && (saved.upazila || saved.district)) {
        locationBtnText.textContent = `${saved.upazila || saved.district}, ${saved.division}`;
      }
    }
  } catch (_) {}

  locationBtn?.addEventListener('click', () => {
    try {
      const savedRaw = localStorage.getItem('user_delivery_location');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved.division && document.getElementById('modal-division')) document.getElementById('modal-division').value = saved.division;
        if (saved.district && document.getElementById('modal-district')) document.getElementById('modal-district').value = saved.district;
        if (saved.upazila && document.getElementById('modal-upazila')) document.getElementById('modal-upazila').value = saved.upazila;
        if (saved.address && document.getElementById('modal-address')) document.getElementById('modal-address').value = saved.address;
        if (saved.postalCode && document.getElementById('modal-postal')) document.getElementById('modal-postal').value = saved.postalCode;
      }
    } catch (_) {}
    openModal(locationModal, locationModalOverlay);
  });

  const modalUseGpsBtn = document.getElementById('modal-use-gps-btn');
  const modalGpsBtnText = document.getElementById('modal-gps-btn-text');

  modalUseGpsBtn?.addEventListener('click', async () => {
    try {
      if (modalGpsBtnText) modalGpsBtnText.textContent = '⏳ Detecting your GPS location...';
      modalUseGpsBtn.disabled = true;

      const loc = await getCurrentGpsLocation();

      if (loc.division && document.getElementById('modal-division')) document.getElementById('modal-division').value = loc.division;
      if (loc.district && document.getElementById('modal-district')) document.getElementById('modal-district').value = loc.district;
      if (loc.upazila && document.getElementById('modal-upazila')) document.getElementById('modal-upazila').value = loc.upazila;
      if (loc.address && document.getElementById('modal-address')) document.getElementById('modal-address').value = loc.address;
      if (loc.postalCode && document.getElementById('modal-postal')) document.getElementById('modal-postal').value = loc.postalCode;

      if (modalGpsBtnText) modalGpsBtnText.textContent = '✅ Location Detected!';
    } catch (err) {
      if (modalGpsBtnText) modalGpsBtnText.textContent = '🎯 Auto Detect My Current Location (GPS)';
      alert(err.message || 'GPS location failed. Please type address manually.');
    } finally {
      modalUseGpsBtn.disabled = false;
      setTimeout(() => {
        if (modalGpsBtnText) modalGpsBtnText.textContent = '🎯 Auto Detect My Current Location (GPS)';
      }, 3000);
    }
  });

  locationModalCloseBtn?.addEventListener('click', () => {
    closeModal(locationModal, locationModalOverlay);
  });

  locationModalOverlay?.addEventListener('click', () => {
    closeModal(locationModal, locationModalOverlay);
  });

  locationModalForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const division = document.getElementById('modal-division')?.value || 'Dhaka';
    const district = document.getElementById('modal-district')?.value.trim() || '';
    const upazila = document.getElementById('modal-upazila')?.value.trim() || '';
    const address = document.getElementById('modal-address')?.value.trim() || '';
    const postalCode = document.getElementById('modal-postal')?.value.trim() || '';

    const locData = { division, district, upazila, address, postalCode };
    localStorage.setItem('user_delivery_location', JSON.stringify(locData));

    if (locationBtnText) {
      locationBtnText.textContent = `${upazila || district}, ${division}`;
    }

    closeModal(locationModal, locationModalOverlay);
  });

  searchInput?.addEventListener('keydown', handleSearch);
  mobileSearchInput?.addEventListener('keydown', handleSearch);
}

function initMegamenuEvents() {
  const dropdownWrappers = document.querySelectorAll('.nav-item-wrapper.has-dropdown');
  dropdownWrappers.forEach((wrapper) => {
    const trigger = wrapper.querySelector('.nav-link');
    const closeBtn = wrapper.querySelector('.megamenu-close-btn');

    trigger?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = wrapper.classList.contains('is-open');
      dropdownWrappers.forEach((w) => w.classList.remove('is-open'));
      if (!isOpen) {
        wrapper.classList.add('is-open');
      }
    });

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.remove('is-open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item-wrapper.has-dropdown')) {
      dropdownWrappers.forEach((w) => w.classList.remove('is-open'));
    }
  });
}

function initStickyHeaderScroll() {
  const shell = document.getElementById('site-shell');
  if (!shell || shell.dataset.scrollBound) return;
  shell.dataset.scrollBound = 'true';

  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > 100) {
          shell.classList.add('shadow-md');
          if (currentScrollY > lastScrollY && currentScrollY - lastScrollY > 6) {
            shell.style.transform = 'translateY(-100%)';
          } else if (lastScrollY - currentScrollY > 6) {
            shell.style.transform = 'translateY(0)';
          }
        } else {
          shell.style.transform = 'translateY(0)';
          shell.classList.remove('shadow-md');
        }

        lastScrollY = currentScrollY;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

export function initAnnouncementListener(db) {
  if (!db) return;
  try {
    db.collection('settings').doc('store').onSnapshot((docSnap) => {
      if (docSnap.exists) {
        const data = docSnap.data();
        const text = data.announcement || SITE_CONFIG.announcement;
        const enabled = data.announcementEnabled !== false;

        const barContainer = document.getElementById('announcement-bar-container');
        const span1 = document.getElementById('announcement-bar-text-1');
        const span2 = document.getElementById('announcement-bar-text-2');

        if (barContainer) {
          barContainer.style.display = enabled ? 'block' : 'none';
        }
        if (span1) span1.textContent = text;
        if (span2) span2.textContent = text;
      }
    }, (err) => {
      console.warn('Announcement listener notice:', err);
    });
  } catch (e) {
    console.warn('Announcement setup notice:', e);
  }
}
