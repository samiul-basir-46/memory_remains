import { SITE_CONFIG } from '../config/site-config.js';

function renderNavLinks(pageId) {
  return SITE_CONFIG.navLinks.map((link) => {
    const activeClass = link.page === pageId ? 'is-active' : '';
    return `<a href="${link.href}" class="nav-link ${activeClass}">${link.label}</a>`;
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
      <div class="container site-header__inner">
        <a class="site-logo" href="/">${SITE_CONFIG.brandName}</a>
        
        <!-- Search bar -->
        <div class="header-search">
          <input type="text" id="header-search-input" placeholder="Search anything..." aria-label="Search">
          <i class="fa-solid fa-magnifying-glass"></i>
        </div>
        
        <div class="site-actions">
          <button id="location-btn" class="pill-button location-btn" type="button">
            <i class="fa-solid fa-map-pin"></i>
            <span>Check Location</span>
          </button>
          
          <button class="cart-icon" type="button" aria-label="Shopping Cart">
            <i class="fa-solid fa-bag-shopping"></i>
            <span class="cart-count">0</span>
          </button>
          
          <button id="auth-nav-btn" class="auth-text-link" type="button">Sign In</button>
          
          <button class="menu-toggle" type="button" aria-label="Toggle Menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      
      <!-- Sub navigation row -->
      <nav class="site-sub-nav" aria-label="Primary">
        <div class="container site-sub-nav__inner">
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
    <div class="container site-footer__top">
      <div class="footer-brand">
        <h3>${SITE_CONFIG.brandName}</h3>
        <p>Premium customized magazines and keepsakes designed to capture your most core memories. Handcrafted with love.</p>
        <a class="footer-phone" href="${SITE_CONFIG.supportPhoneHref}">
          <i class="fa-solid fa-phone"></i>
          <span>${SITE_CONFIG.supportPhoneLabel}</span>
        </a>
      </div>
      ${SITE_CONFIG.footerGroups.map(renderFooterGroup).join('')}
    </div>
    <div class="container site-footer__bottom">
      <div class="footer-socials">${renderSocialLinks()}</div>
      <p>&copy; 2026 ${SITE_CONFIG.brandName}. All rights reserved.</p>
    </div>
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
