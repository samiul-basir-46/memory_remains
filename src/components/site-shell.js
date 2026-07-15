import { SITE_CONFIG } from '../config/site-config.js';

function renderNavLinks(pageId, isMobile = false) {
  return SITE_CONFIG.navLinks.map((link) => {
    const activeClass = link.page === pageId ? 'is-active' : '';
    const isDropdown = !isMobile && (link.label === 'Categories' || link.label === 'Collections');
    const hasChevron = !isMobile && link.label !== 'All Products';
    const icon = hasChevron ? ' <i class="fa-solid fa-chevron-down" style="font-size:0.7em; margin-left:4px; color: var(--color-text-soft);"></i>' : '';
    
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
      <div class="nav-item-wrapper ${isDropdown ? 'has-dropdown' : ''}" style="position: ${isMobile ? 'static' : 'relative'};">
        <a href="${link.href}" class="nav-link ${activeClass}" style="color: #3b1c1c; text-decoration: none; display: inline-flex; align-items: center; height: 100%;">
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
    <div class="announcement-bar">${SITE_CONFIG.announcement}</div>
    <header class="site-header">
      <div class="container site-header__inner" style="display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; gap: 1rem;">
        <a class="site-logo" href="/" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #3b1c1c; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <span style="color: #fff; font-family: 'Yeseva One', serif; font-size: 0.6rem; text-align: center; line-height: 1.1;">Hearts &<br>Beans</span>
          </div>
          <span style="font-family: 'Yeseva One', serif; font-size: 1.35rem; color: #3b1c1c;">${SITE_CONFIG.brandName}</span>
        </a>
        
        <!-- Search bar -->
        <div class="header-search" style="max-width: 600px; margin: 0 auto; width: 100%;">
          <input type="text" id="header-search-input" placeholder="Search anything..." aria-label="Search" style="border-radius: 8px; border: 1px solid #ddd; padding: 0.6rem 1rem; width: 100%;">
        </div>
        
        <div class="site-actions" style="justify-content: flex-end;">
          <button id="location-btn" class="pill-button location-btn" type="button" style="background: var(--color-primary); color: white; border: none; font-size: 0.85rem; padding: 0.6rem 1.2rem;">
            <i class="fa-solid fa-map-pin"></i>
            <span>Check Location</span>
          </button>
          
          <button class="cart-icon" type="button" aria-label="Shopping Cart" style="color: #3b1c1c; font-size: 1.1rem; margin: 0 0.5rem;">
            <i class="fa-solid fa-cart-shopping"></i>
            <span class="cart-count">0</span>
          </button>
          
          <button id="auth-nav-btn" class="auth-text-link" type="button" style="color: #3b1c1c; font-size: 0.9rem;">Sign In</button>
          
          <button class="menu-toggle" type="button" aria-label="Toggle Menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      
      <!-- Sub navigation row -->
      <nav class="site-sub-nav" aria-label="Primary" style="border-top: none; padding-top: 1rem; padding-bottom: 1rem;">
        <div class="container site-sub-nav__inner" style="justify-content: space-around; max-width: 900px; margin: 0 auto; font-family: 'Yeseva One', serif; font-size: 0.9rem;">
          ${renderNavLinks(pageId)}
        </div>
      </nav>
    </header>
    <aside class="mobile-drawer" id="mobile-drawer">
      <div class="mobile-drawer__body">
        ${renderNavLinks(pageId, true)}
        <hr style="border:0;border-top:1px solid var(--color-border);margin:0.5rem 0">
        <a href="/pages/library" class="nav-link">My Library</a>
        <a href="/pages/profile" class="nav-link">Profile</a>
        <a href="#" id="auth-mobile-btn" class="mobile-auth-link">Sign In</a>
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
    <div class="container site-footer__top" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1rem; padding: 3rem 0; color: white;">
      <div class="footer-brand" style="padding-right: 2rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #3b1c1c; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <span style="color: #fff; font-family: 'Yeseva One', serif; font-size: 0.6rem; text-align: center; line-height: 1.1;">Hearts &<br>Beans</span>
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
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; grid-column: span 3;">
        ${SITE_CONFIG.footerGroups.map(renderFooterGroup).join('')}
      </div>
    </div>
    
    <div style="border-top: 1px solid rgba(255,255,255,0.2); margin: 0 2rem;"></div>
    
    <div class="container site-footer__bottom" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 0; color: white; font-size: 0.8rem;">
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
    
    <a href="https://wa.me/919250303360" target="_blank" rel="noreferrer" class="whatsapp-float" style="position: fixed; bottom: 20px; right: 20px; background-color: #25d366; color: white; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 100;">
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
  `;
}
