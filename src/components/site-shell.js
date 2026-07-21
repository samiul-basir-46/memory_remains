import { SITE_CONFIG } from '../config/site-config.js';

export function openSurface(drawer, overlay) {
  if (drawer) drawer.classList.add('is-open');
  if (overlay) overlay.classList.add('is-visible');
}

export function closeSurface(drawer, overlay) {
  if (drawer) drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-visible');
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
            <div class="megamenu-inner max-w-container mx-auto px-4 relative">
              <button type="button" class="megamenu-close-btn absolute -top-4 right-4 text-3xl text-gray-700 hover:text-primary cursor-pointer p-1" aria-label="Close menu">&times;</button>
              <div class="megamenu-grid grid grid-cols-4 gap-6 pr-12">
                <a href="/collections/paid-products?title=Magazine+%26+Newspaper" class="megamenu-card flex flex-col gap-3 no-underline group">
                  <div class="megamenu-card-bg bg-[#360505] rounded-xl aspect-[3/4] flex items-center justify-center p-4 text-center border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-2xl">
                    <span class="text-white font-heading text-2xl font-bold leading-tight text-glow">MAGAZINE<br>&<br>NEWSPAPER</span>
                  </div>
                  <span class="megamenu-card-title text-text-dark text-sm font-semibold text-center group-hover:text-primary transition-colors">Magazine & Newspaper</span>
                </a>
              </div>
            </div>
          </div>
        `;
      } else if (link.label === 'Collections') {
        dropdownHtml = `
          <div class="megamenu-dropdown absolute top-full left-0 w-full bg-white border-b border-pink-100 shadow-2xl py-8 opacity-0 invisible transition-all duration-200 z-50 pointer-events-none">
            <div class="megamenu-inner max-w-container mx-auto px-4 flex gap-8 relative">
              <button type="button" class="megamenu-close-btn absolute -top-4 right-4 text-3xl text-gray-700 hover:text-primary cursor-pointer p-1" aria-label="Close menu">&times;</button>
              <div class="megamenu-grid flex-1 grid grid-cols-4 gap-6 pr-4">
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
                <ul class="list-none p-0 m-0 grid gap-3">
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
    <div class="announcement-bar py-2.5 text-center text-xs font-medium tracking-wider text-white bg-accent overflow-hidden relative whitespace-nowrap">
      <div class="announcement-bar__track animate-marquee inline-flex whitespace-nowrap">
        <div class="announcement-bar__content inline-flex items-center gap-10 pr-10">
          <span>${SITE_CONFIG.announcement}</span>
          <span class="opacity-60 text-xs">•</span>
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
          
          <button class="cart-icon relative text-[#3b1c1c] text-xl mx-1.5 cursor-pointer hover:text-primary transition-colors" type="button" aria-label="Shopping Cart">
            <i class="fa-solid fa-cart-shopping"></i>
            <span class="cart-count cart-badge-count absolute -top-2 -right-2.5 w-4.5 h-4.5 grid place-items-center rounded-full bg-primary text-white text-[10px] font-bold shadow-sm">0</span>
          </button>
          
          <button id="auth-nav-btn" class="auth-text-link text-[#3b1c1c] hover:text-primary text-sm font-semibold p-1 transition-colors" type="button">Sign In</button>
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
          <div class="mobile-drawer__accordion-content hidden flex-col mt-2 border-t border-gray-100">
            <a href="/collections/paid-products?title=Magazine+%26+Newspaper" class="mobile-drawer__sublink font-heading text-sm font-semibold text-[#2b1717] no-underline py-3 px-4 border-b border-gray-50 hover:text-primary transition-colors">Magazine & Newspaper</a>
          </div>
        </div>

        <div class="mobile-drawer__accordion">
          <button type="button" class="mobile-drawer__accordion-toggle font-heading text-base font-semibold text-[#2b1717] flex items-center justify-between w-full hover:text-primary transition-colors">
            <span>Collections</span>
            <i class="fa-solid fa-chevron-down text-sm"></i>
          </button>
          <div class="mobile-drawer__accordion-content hidden flex-col mt-2 border-t border-gray-100">
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
        <button id="auth-mobile-btn" class="mobile-drawer__auth-btn flex items-center gap-3 text-base font-medium text-[#2b1717] cursor-pointer" type="button">
          <i class="fa-regular fa-user text-lg"></i>
          <span>Sign In</span>
        </button>
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
          <p class="m-0">heartsabeans, Tulsipur, Prayagraj, Uttar Pradesh, 211003</p>
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
        <strong>We accept</strong>
        <span class="font-bold text-base">VISA</span>
        <span class="inline-block w-6 h-4 bg-[#ff5f00] rounded-sm relative overflow-hidden"><span class="absolute w-4 h-4 bg-[#eb001b] rounded-full -left-1"></span><span class="absolute w-4 h-4 bg-[#f79e1b] rounded-full -right-1"></span></span>
        <span class="font-bold text-gray-300">G Pay</span>
        <span class="font-bold">BHIM UPI</span>
        <span class="flex items-center gap-1"><i class="fa-solid fa-building-columns"></i> Net Banking</span>
        <span class="flex items-center gap-1"><i class="fa-solid fa-wallet"></i> Wallet</span>
        <span class="flex items-center gap-1"><i class="fa-solid fa-money-bill-1"></i> Cash on Delivery</span>
      </div>
      <div>
        Built with <span class="font-heading text-base inline-flex items-baseline gap-1">smart<span class="text-[#f79e1b]">biz</span></span> <span class="text-[10px] align-middle">by amazon</span>
      </div>
    </div>
    
    <a href="https://wa.me/8801622000471?text=Hi%2C%20I%27m%20interested%20in%20your%20products" target="_blank" rel="noreferrer" class="whatsapp-float fixed bottom-5 right-5 bg-[#25d366] text-white rounded-full w-14 h-14 flex items-center justify-center text-3xl shadow-lg z-[100] hover:scale-110 transition-transform">
      <i class="fa-brands fa-whatsapp"></i>
    </a>
  `;

  overlays.innerHTML = `
    <!-- Cart Drawer -->
    <aside class="cart-drawer fixed top-0 -right-full z-[1001] w-[min(90vw,420px)] h-screen bg-white transition-[right] duration-300 flex flex-col shadow-2xl" id="cart-drawer">
      <div class="cart-drawer__header flex items-center justify-between p-5 border-b border-gray-100">
        <h3 class="font-heading text-xl text-primary font-bold">Your Shopping Bag</h3>
        <button id="cart-drawer-close-btn" class="icon-close text-2xl text-gray-500 hover:text-primary cursor-pointer p-1" type="button" aria-label="Close Cart">&times;</button>
      </div>
      <div class="cart-drawer__body flex-1 p-5 overflow-y-auto">
        <div id="cart-drawer-items"></div>
        <div id="cart-drawer-empty" class="empty-state text-center py-12 text-gray-400">
          <i class="fa-solid fa-bag-shopping text-4xl mb-3 text-primary/40"></i>
          <p class="text-sm">Your shopping bag is empty.</p>
        </div>
      </div>
      <div class="cart-drawer__footer p-5 border-t border-gray-100 bg-gray-50" id="cart-drawer-footer" hidden>
        <div class="cart-total-row flex justify-between items-center mb-4 text-base font-bold text-text-dark">
          <span>Subtotal</span>
          <strong id="cart-total-amount" class="text-primary text-lg">$0.00</strong>
        </div>
        <button id="checkout-btn" class="pill-button w-full bg-primary hover:bg-primary-strong text-white py-3 rounded-xl font-bold transition-colors" type="button">Proceed to Checkout</button>
      </div>
    </aside>
    <div class="drawer-overlay fixed inset-0 bg-black/40 opacity-0 pointer-events-none z-[1000] transition-opacity duration-200" id="cart-drawer-overlay"></div>

    <!-- Auth Modal -->
    <div class="auth-modal fixed inset-0 z-[1002] flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-200" id="auth-modal">
      <div class="auth-modal__card bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
        <div class="auth-modal__header flex justify-between items-center mb-4">
          <h3 class="font-heading text-xl text-primary font-bold">Sign In</h3>
          <button id="auth-modal-close-btn" class="icon-close text-2xl text-gray-400 hover:text-primary cursor-pointer" type="button" aria-label="Close Auth">&times;</button>
        </div>
        
        <div class="flex border-b border-gray-200 mb-5">
          <button id="auth-tab-login" type="button" class="auth-tab flex-1 py-2 text-sm font-bold text-center border-b-2 border-primary text-primary">Login</button>
          <button id="auth-tab-signup" type="button" class="auth-tab flex-1 py-2 text-sm font-bold text-center border-b-2 border-transparent text-gray-400">Sign Up</button>
        </div>

        <form id="auth-form-login" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
            <input type="email" id="login-email" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input type="password" id="login-password" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary">
          </div>
          <button type="submit" class="w-full py-3 bg-primary hover:bg-primary-strong text-white font-bold rounded-xl text-sm transition-colors">Sign In</button>
        </form>

        <form id="auth-form-signup" class="space-y-4" hidden>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
            <input type="text" id="signup-name" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
            <input type="email" id="signup-email" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input type="password" id="signup-password" required class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary">
          </div>
          <button type="submit" class="w-full py-3 bg-primary hover:bg-primary-strong text-white font-bold rounded-xl text-sm transition-colors">Create Account</button>
        </form>
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
                <span id="price-min-display">₹0</span>
                <span id="price-max-display">₹2000</span>
              </div>
              
              <div class="dual-range-slider">
                <div class="slider-track"></div>
                <div class="slider-track-fill" id="slider-track-fill"></div>
                <input type="range" id="price-slider-min" min="0" max="2000" value="0" step="1">
                <input type="range" id="price-slider-max" min="0" max="2000" value="2000" step="1">
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="filter-drawer__footer p-5 border-t border-gray-100 bg-white">
        <button id="apply-filter-btn" class="pill-button w-full bg-primary text-white rounded-full py-3.5 font-bold shadow-md hover:bg-primary-strong transition-colors" type="button">Show Products</button>
      </div>
    </aside>
    <div class="drawer-overlay fixed inset-0 bg-black/40 opacity-0 pointer-events-none z-[1000] transition-opacity duration-200" id="filter-drawer-overlay"></div>
  `;

  initStickyHeaderScroll();
  initMegamenuEvents();
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
