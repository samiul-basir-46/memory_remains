import { SITE_CONFIG } from '../config/site-config.js';

function renderNavLinks(pageId, isMobile = false) {
  return SITE_CONFIG.navLinks.map((link) => {
    const activeClass = link.page === pageId ? 'is-active' : '';
    const isDropdown = !isMobile && (link.label === 'Categories' || link.label === 'Collections');
    const isFeatured = link.label === 'Featured Products';

    let icon = '';
    if (isFeatured) {
      icon = ' <i class="fa-solid fa-wand-magic-sparkles" style="font-size:0.75em; margin-left:6px; color: #3b1c1c;"></i>';
    } else if (isDropdown) {
      icon = ' <i class="fa-solid fa-chevron-down" style="font-size:0.7em; margin-left:5px; color: #3b1c1c; transition: transform 0.25s ease;"></i>';
    }

    let dropdownHtml = '';
    if (isDropdown) {
      if (link.label === 'Categories') {
        dropdownHtml = `
          <div class="megamenu-dropdown">
            <div class="megamenu-inner container">
              <div class="megamenu-grid" style="grid-template-columns: repeat(4, 1fr);">
                <a href="/collections/paid-products" class="megamenu-card">
                  <div class="megamenu-card-bg">
                    <span>MAGAZINE<br>&<br>NEWSPAPER</span>
                  </div>
                  <span class="megamenu-card-title">Magazine & Newspaper</span>
                </a>
              </div>
            </div>
          </div>
        `;
      } else if (link.label === 'Collections') {
        dropdownHtml = `
          <div class="megamenu-dropdown">
            <div class="megamenu-inner container" style="display: flex; gap: 2rem;">
              <div class="megamenu-grid" style="flex: 1; grid-template-columns: repeat(4, 1fr);">
                <a href="/collections/paid-products" class="megamenu-card">
                  <div class="megamenu-card-bg"><span>FOR HER</span></div>
                  <span class="megamenu-card-title">FOR HER</span>
                </a>
                <a href="/collections/paid-products" class="megamenu-card">
                  <div class="megamenu-card-bg"><span>I LOVE<br>MY SELF</span></div>
                  <span class="megamenu-card-title">I Love My Self</span>
                </a>
                <a href="/collections/paid-products" class="megamenu-card">
                  <div class="megamenu-card-bg"><span>BEST<br>SELLING</span></div>
                  <span class="megamenu-card-title">Best Selling</span>
                </a>
                <a href="/collections/paid-products" class="megamenu-card">
                  <div class="megamenu-card-bg"><span>BIRTHDAY<br>SPECIAL</span></div>
                  <span class="megamenu-card-title">Birthday Special</span>
                </a>
              </div>
              <div class="megamenu-sidebar" style="width: 250px; border-left: 1px solid var(--color-border); padding-left: 2rem;">
                <h4 style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--color-text-soft); font-weight: 500;">Other Collections</h4>
                <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem;">
                  <li><a href="/collections/paid-products" style="color: var(--color-text); text-decoration: none; font-size: 0.9rem;">FOR HIM</a></li>
                </ul>
              </div>
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="nav-item-wrapper ${isDropdown ? 'has-dropdown' : ''}" style="position: static;">
        <a href="${link.href}" class="nav-link ${activeClass}" style="color: #3b1c1c; text-decoration: none; display: inline-flex; align-items: center; height: 100%; font-family: 'Yeseva One', serif; font-size: 0.95rem; font-weight: 600;">
          ${link.label}${icon}
        </a>
        ${dropdownHtml}
      </div>
    `;
  }).join('');
}

function renderFooterGroup(group) {
  const links = group.links.map((link) => `<li><a href="${link.href}">${link.label}</a></li>`).join('');
  return `
    <div class="footer-group">
      <h4>${group.title}</h4>
      <ul>${links}</ul>
    </div>
  `;
}

function renderSocialLinks() {
  return SITE_CONFIG.socialLinks.map((link) => (
    `<a href="${link.href}" target="_blank" rel="noreferrer" aria-label="${link.label}">
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

  shell.innerHTML = `
    <div class="announcement-bar">
      <div class="announcement-bar__track">
        <div class="announcement-bar__content">
          <span>${SITE_CONFIG.announcement}</span>
          <span class="announcement-dot">•</span>
        </div>
      </div>
    </div>
    <header class="site-header">
      <div class="container site-header__inner">
        <!-- Hamburger Menu toggle (mobile left) -->
        <button class="menu-toggle" type="button" aria-label="Toggle Menu" style="cursor: pointer;">
          <i class="fa-solid fa-bars" style="font-size: 1.35rem; color: #3b1c1c;"></i>
        </button>

        <!-- Brand Logo -->
        <a class="site-logo" href="/" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: #3b1c1c; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
            <img src="/assets/IMG-20260715-WA0003.jpg" alt="${SITE_CONFIG.brandName} Logo" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <span class="site-logo__text" style="font-family: 'Yeseva One', serif; font-size: 1.25rem; color: #3b1c1c; font-weight: bold;">${SITE_CONFIG.brandName}</span>
        </a>
        
        <!-- Search bar (Desktop) -->
        <div class="header-search" style="max-width: 600px; margin: 0 auto; width: 100%;">
          <input type="text" id="header-search-input" placeholder="Search anything..." aria-label="Search" style="border-radius: 8px; border: 1px solid #ddd; padding: 0.6rem 1rem; width: 100%;">
        </div>
        
        <div class="site-actions" style="justify-content: flex-end;">
          <button id="location-btn" class="pill-button location-btn" type="button" style="background: var(--color-primary); color: white; border: none; font-size: 0.85rem; padding: 0.6rem 1.2rem;">
            <i class="fa-solid fa-map-pin"></i>
            <span>Check Location</span>
          </button>

          <!-- Mobile Search Toggle Icon (🔍) -->
          <button id="mobile-search-toggle-btn" class="mobile-search-toggle" type="button" aria-label="Search">
            <i class="fa-solid fa-magnifying-glass" style="font-size: 1.15rem; color: #3b1c1c;"></i>
          </button>
          
          <button class="cart-icon" type="button" aria-label="Shopping Cart" style="color: #3b1c1c; font-size: 1.1rem; margin: 0 0.5rem;">
            <i class="fa-solid fa-cart-shopping"></i>
            <span class="cart-count">0</span>
          </button>
          
          <button id="auth-nav-btn" class="auth-text-link" type="button" style="color: #3b1c1c; font-size: 0.9rem;">Sign In</button>
        </div>
      </div>
      
      <!-- Mobile Search Bar input box -->
      <div id="mobile-search-bar" class="mobile-search-bar" hidden>
        <div class="container" style="padding: 0.5rem 1rem;">
          <input type="text" id="mobile-search-input" placeholder="Search anything..." aria-label="Search" style="width: 100%; padding: 0.6rem 1rem; border-radius: 8px; border: 1px solid #ddd; outline: none;">
        </div>
      </div>
      
      <!-- Sub navigation row -->
      <nav class="site-sub-nav" aria-label="Primary" style="border-top: none; padding-top: 1rem; padding-bottom: 1rem;">
        <div class="container site-sub-nav__inner" style="justify-content: space-around; max-width: 900px; margin: 0 auto; font-family: 'Yeseva One', serif; font-size: 0.95rem;">
          ${renderNavLinks(pageId)}
        </div>
      </nav>
    </header>
    <aside class="mobile-drawer" id="mobile-drawer">
      <div class="mobile-drawer__header">
        <div class="mobile-drawer__brand">
          <div class="mobile-drawer__logo-img">
            <img src="/assets/IMG-20260715-WA0003.jpg" alt="${SITE_CONFIG.brandName} Logo">
          </div>
          <span class="mobile-drawer__brand-title">${SITE_CONFIG.brandName}</span>
        </div>
        <button id="mobile-drawer-close-btn" class="mobile-drawer__close-btn" type="button" aria-label="Close menu">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="mobile-drawer__nav">
        <a href="/pages/featured" class="mobile-drawer__link">
          <span>Featured Products</span>
          <i class="fa-solid fa-wand-magic-sparkles" style="font-size:0.85em; color: #3b1c1c;"></i>
        </a>

        <div class="mobile-drawer__accordion">
          <button type="button" class="mobile-drawer__accordion-toggle">
            <span>Categories</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="mobile-drawer__accordion-content">
            <a href="/collections/paid-products" class="mobile-drawer__sublink">Magazine & Newspaper</a>
          </div>
        </div>

        <div class="mobile-drawer__accordion">
          <button type="button" class="mobile-drawer__accordion-toggle">
            <span>Collections</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="mobile-drawer__accordion-content">
            <a href="/collections/paid-products" class="mobile-drawer__sublink">FOR HER</a>
            <a href="/collections/paid-products" class="mobile-drawer__sublink">I Love My Self</a>
            <a href="/collections/paid-products" class="mobile-drawer__sublink">Best Selling</a>
            <a href="/collections/paid-products" class="mobile-drawer__sublink">Birthday Special</a>
            <a href="/collections/paid-products" class="mobile-drawer__sublink">FOR HIM</a>
          </div>
        </div>

        <a href="/collections/paid-products" class="mobile-drawer__link">All Products</a>
      </div>

      <div class="mobile-drawer__footer">
        <button id="auth-mobile-btn" class="mobile-drawer__auth-btn" type="button">
          <i class="fa-regular fa-user"></i>
          <span>Sign In</span>
        </button>
      </div>
    </aside>
    <div class="screen-overlay" id="screen-overlay"></div>
  `;

  // Dynamically create and position footer at the bottom of the body
  let footer = document.querySelector('.site-footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.className = 'site-footer';
    document.body.appendChild(footer);
  }
  footer.innerHTML = `
    <div class="container site-footer__top">
      <div class="footer-brand" style="padding-right: 2rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #3b1c1c; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <img src="/assets/IMG-20260715-WA0003.jpg" alt="${SITE_CONFIG.brandName} Logo" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <h3 style="font-family: 'Yeseva One', serif; font-size: 1.35rem; margin: 0; color: white;">${SITE_CONFIG.brandName}</h3>
        </div>
        
        <div style="display: flex; gap: 0.8rem; margin-bottom: 1rem; align-items: flex-start; font-size: 0.85rem;">
          <i class="fa-solid fa-location-dot" style="margin-top: 0.2rem;"></i>
          <p style="margin: 0;">heartsabeans, Tulsipur, Prayagraj, Uttar Pradesh, 211003</p>
        </div>
        
        <div style="display: flex; gap: 0.8rem; margin-bottom: 1.5rem; align-items: center; font-size: 0.85rem;">
          <i class="fa-solid fa-phone"></i>
          <div>
            <div style="font-size: 0.75rem; opacity: 0.9;">Talk to us</div>
            <div>${SITE_CONFIG.supportPhoneLabel}</div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 0.8rem; font-size: 0.85rem; font-weight: bold;">
          Connect with us 
          ${renderSocialLinks()}
        </div>
      </div>
      ${SITE_CONFIG.footerGroups.map(renderFooterGroup).join('')}
    </div>
    
    <div style="border-top: 1px solid rgba(255,255,255,0.2); margin: 0 2rem;"></div>
    
    <div class="container site-footer__bottom" style="padding: 1.5rem 0; color: white; font-size: 0.8rem;">
      <div style="display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap;">
        <strong>We accept</strong>
        <span style="font-weight:bold; font-size: 1rem;">VISA</span>
        <span style="display: inline-block; width: 24px; height: 16px; background: #ff5f00; border-radius: 2px; position:relative; overflow:hidden;"><span style="position:absolute; width:16px; height:16px; background:#eb001b; border-radius:50%; left:-4px;"></span><span style="position:absolute; width:16px; height:16px; background:#f79e1b; border-radius:50%; right:-4px;"></span></span>
        <span style="font-weight:bold; color: #5f6368;">G Pay</span>
        <span style="font-weight:bold;">BHIM UPI</span>
        <span style="display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-building-columns"></i> Net Banking</span>
        <span style="display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-wallet"></i> Wallet</span>
        <span style="display:flex; align-items:center; gap:0.2rem;"><i class="fa-solid fa-money-bill-1"></i> Cash on Delivery</span>
      </div>
      <div>
        Built with <span style="font-family: 'Yeseva One', serif; font-size: 1.1rem; display:inline-flex; align-items:baseline; gap:0.2rem;">smart<span style="color:#f79e1b;">biz</span></span> <span style="font-size:0.6rem; vertical-align:middle;">by amazon</span>
      </div>
    </div>
    
    <a href="https://wa.me/8801622000471?text=Hi%2C%20I%27m%20interested%20in%20your%20products" target="_blank" rel="noreferrer" class="whatsapp-float" style="position: fixed; bottom: 20px; right: 20px; background-color: #25d366; color: white; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 100;">
      <i class="fa-brands fa-whatsapp"></i>
    </a>
  `;

  overlays.innerHTML = `
    <div class="cart-drawer" id="cart-drawer">
      <div class="cart-drawer__header">
        <h3>Your Shopping Bag</h3>
        <button id="cart-drawer-close-btn" class="icon-close" type="button" aria-label="Close Cart">&times;</button>
      </div>
      <div class="cart-drawer__body">
        <div id="cart-items-container"></div>
        <div id="cart-empty-message" class="empty-state">
          <i class="fa-solid fa-bag-shopping"></i>
          <p>Your shopping bag is empty.</p>
        </div>
      </div>
      <div class="cart-drawer__footer" id="cart-drawer-footer" hidden>
        <div class="cart-total-row">
          <span>Subtotal</span>
          <strong id="cart-subtotal-val">$0.00</strong>
        </div>
        <form id="checkout-form" class="stack-form">
          <h4>Checkout Details</h4>
          <input type="text" id="checkout-name" placeholder="Full Name" required>
          <input type="email" id="checkout-email" placeholder="Email Address" required>
          <select id="checkout-purchase-type" required>
            <option value="template">Buy Ready-made Template</option>
            <option value="customOrder">Custom Order (Upload My Photos)</option>
          </select>
          <input type="text" id="checkout-txnid" placeholder="Transaction ID (bKash/Nagad)">
          <p class="form-help">Pay to Bkash/Nagad: <strong>017XXXXXXXX</strong> and enter the transaction ID to speed up approval.</p>
          <button class="pill-button" type="submit">Place Order</button>
        </form>
      </div>
    </div>
    <div class="drawer-overlay" id="cart-drawer-overlay"></div>

    <div class="auth-modal" id="auth-modal">
      <div class="auth-modal__card">
        <div class="auth-modal__header">
          <h3>Sign In</h3>
          <button id="auth-modal-close-btn" class="icon-close" type="button" aria-label="Close Auth">&times;</button>
        </div>
        <p>Sign in to track purchases, unlock your library, and speed up checkout.</p>
        <div class="auth-actions">
          <button type="button" class="pill-button pill-button--ghost" data-auth-provider="google">
            <i class="fa-brands fa-google"></i>
            <span>Continue with Google</span>
          </button>
          <button type="button" class="pill-button pill-button--ghost" data-auth-provider="facebook">
            <i class="fa-brands fa-facebook"></i>
            <span>Continue with Facebook</span>
          </button>
        </div>
      </div>
    </div>
    <div class="drawer-overlay" id="auth-modal-overlay"></div>

    <div class="upload-modal" id="upload-modal">
      <div class="upload-modal__card">
        <div class="auth-modal__header">
          <h3>Upload Photos</h3>
          <button id="upload-modal-close-btn" class="icon-close" type="button" aria-label="Close Upload">&times;</button>
        </div>
        <p id="upload-instruction">Please select exactly <strong id="upload-target-count">40</strong> photos.</p>
        <div id="upload-dropzone" class="upload-dropzone">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <p>Drag and drop photos here or click to browse</p>
        </div>
        <input type="file" id="upload-file-input" multiple accept="image/png,image/jpeg,image/jpg,image/webp,image/heic" hidden>
        <p id="upload-preview-header" class="upload-preview-header" hidden>Selected previews (<span id="upload-selected-count">0</span>)</p>
        <div id="upload-previews-grid" class="upload-previews-grid" hidden></div>
        <div id="upload-progress-container" class="upload-progress" hidden>
          <div class="upload-progress__bar"><div id="upload-progress-bar-fill"></div></div>
          <p id="upload-progress-status">Uploading...</p>
        </div>
        <button id="upload-submit-btn" class="pill-button" type="button" disabled>Upload & Submit</button>
      </div>
    </div>
    <div class="drawer-overlay" id="upload-modal-overlay"></div>

    <!-- Filter Drawer Panel -->
    <aside class="filter-drawer" id="filter-drawer">
      <div class="filter-drawer__header">
        <h3>Filter</h3>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <button id="filter-reset-btn" class="filter-reset-btn" type="button">Reset All</button>
          <button id="filter-drawer-close-btn" class="filter-close-btn" type="button" aria-label="Close filters">&times;</button>
        </div>
      </div>

      <div class="filter-drawer__body">
        <!-- Accordion 1: Inventory (Collapsed by default) -->
        <div class="filter-accordion">
          <div class="filter-accordion__header">
            <span>Inventory</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="filter-header-subtext" style="color: #d82b58; font-weight: 500; font-size: 0.85rem;">In Stock</span>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
          </div>
          <div class="filter-accordion__content">
            <label class="filter-checkbox-item">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" id="filter-in-stock" checked>
                <span>In Stock</span>
              </div>
              <span class="filter-item-count">19</span>
            </label>
            <label class="filter-checkbox-item">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" id="filter-out-stock">
                <span style="color: #888;">Out Stock</span>
              </div>
              <span class="filter-item-count">0</span>
            </label>
          </div>
        </div>

        <!-- Accordion 2: Discount (Collapsed by default) -->
        <div class="filter-accordion">
          <div class="filter-accordion__header">
            <span>Discount</span>
            <i class="fa-solid fa-chevron-down"></i>
          </div>
          <div class="filter-accordion__content">
            <label class="filter-checkbox-item">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" class="discount-filter-cb" value="0-20">
                <span>0 - 20%</span>
              </div>
              <span class="filter-item-count">0</span>
            </label>
            <label class="filter-checkbox-item">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" class="discount-filter-cb" value="21-40">
                <span>21 - 40%</span>
              </div>
              <span class="filter-item-count">0</span>
            </label>
            <label class="filter-checkbox-item">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" class="discount-filter-cb" value="41-60">
                <span>41 - 60%</span>
              </div>
              <span class="filter-item-count">2</span>
            </label>
            <label class="filter-checkbox-item">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" class="discount-filter-cb" value="61-80">
                <span>61 - 80%</span>
              </div>
              <span class="filter-item-count">13</span>
            </label>
            <label class="filter-checkbox-item">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" class="discount-filter-cb" value="81-100">
                <span>81 - 100%</span>
              </div>
              <span class="filter-item-count">4</span>
            </label>
          </div>
        </div>

        <!-- Accordion 3: Price Range (Collapsed by default) -->
        <div class="filter-accordion">
          <div class="filter-accordion__header">
            <span>Price Range</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="filter-header-subtext" id="price-range-header-subtext" style="color: #d82b58; font-weight: 500; font-size: 0.85rem; display: none;">Min +1 more</span>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
          </div>
          <div class="filter-accordion__content">
            <div class="filter-price-slider-wrapper">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="font-size: 0.85rem; color: #888;">Minimum</span>
                <span style="font-size: 0.85rem; color: #888;">Maximum</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 600; color: #2b1717; margin-bottom: 0.75rem;">
                <span id="price-min-display">₹199</span>
                <span id="price-max-display">₹799</span>
              </div>
              
              <!-- Dual Range Slider -->
              <div class="dual-range-slider">
                <div class="slider-track"></div>
                <div class="slider-track-fill" id="slider-track-fill"></div>
                <input type="range" id="price-slider-min" min="199" max="799" value="199" step="1">
                <input type="range" id="price-slider-max" min="199" max="799" value="799" step="1">
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="filter-drawer__footer">
        <button id="apply-filter-btn" class="pill-button" type="button" style="width: 100%; background: var(--color-primary); color: white; border-radius: 24px; padding: 0.85rem; font-weight: 600;">Show Products</button>
      </div>
    </aside>
    <div class="drawer-overlay" id="filter-drawer-overlay"></div>
  `;

  initStickyHeaderScroll();
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
          shell.classList.add('is-scrolled');
          if (currentScrollY > lastScrollY && currentScrollY - lastScrollY > 6) {
            // Scrolling down -> hide header
            shell.classList.add('is-hidden');
          } else if (lastScrollY - currentScrollY > 6) {
            // Scrolling up -> reveal header with animation
            shell.classList.remove('is-hidden');
          }
        } else {
          // Near top -> show header and remove shadow
          shell.classList.remove('is-hidden');
          shell.classList.remove('is-scrolled');
        }

        lastScrollY = currentScrollY;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

