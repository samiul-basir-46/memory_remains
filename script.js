// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC3itdNEl2ygjnv0wWDgwkx5DFd0awfzMs",
  authDomain: "memory-remains-b5d38.firebaseapp.com",
  projectId: "memory-remains-b5d38",
  storageBucket: "memory-remains-b5d38.firebasestorage.app",
  messagingSenderId: "769735601721",
  appId: "1:769735601721:web:130b0e6511b9aa3bd667e8",
  measurementId: "G-FT7FNJH5MZ"
};

// Check if firebase is loaded (it might not be on some pages if scripts fail to load)
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}

document.addEventListener('DOMContentLoaded', () => {
  const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

  // Sticky header on scroll
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Mobile menu drawer toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileDrawer = document.querySelector('.mobile-drawer');
  const overlay = document.querySelector('.overlay');

  if (menuToggle && mobileDrawer && overlay) {
    const toggleMenu = () => {
      mobileDrawer.classList.toggle('open');
      overlay.classList.toggle('visible');
      
      // Transform hamburger into an 'X'
      const spans = menuToggle.querySelectorAll('span');
      if (mobileDrawer.classList.contains('open')) {
        spans[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    };

    menuToggle.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
  }

  // Active navigation link highlighting based on current URL path
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const normalizedHref = href.replace(/index\.html$/, '').replace(/^\.\.\/\.\.\//, '/').replace(/^\.\./, '/');
      const normalizedPath = currentPath.replace(/index\.html$/, '');
      
      if (normalizedPath.endsWith(normalizedHref) && normalizedHref !== '/') {
        link.classList.add('active');
      } else if (normalizedHref === '/' && (normalizedPath === '/' || normalizedPath === '')) {
        link.classList.add('active');
      }
    }
  });

  // Real cart implementation (persisted in localStorage)
  let cart = JSON.parse(localStorage.getItem('memory_remains_cart') || '[]');
  const cartCountEl = document.querySelector('.cart-count');

  const staticProducts = {
    "Cozy Autumn Instagram Stories": { title: "Cozy Autumn Instagram Stories", price: 12.00, imageUrl: "./assets/instagram_stories_cozy.png" },
    "Summer Vibes Instagram Carousel": { title: "Summer Vibes Instagram Carousel", price: 15.00, imageUrl: "./assets/instagram_carousel_summer.png" },
    "Cozy Scrapbook Template Bundle": { title: "Cozy Scrapbook Template Bundle", price: 24.00, imageUrl: "./assets/scrapbook_collage_bundle.png" }
  };

  function updateCartCountBadge() {
    if (cartCountEl) {
      cartCountEl.textContent = cart.length;
    }
  }

  window.addToCart = function(productName) {
    const item = staticProducts[productName];
    if (item) {
      window.addTemplateToCart(item);
    } else {
      window.addTemplateToCart({ title: productName, price: 15.00 });
    }
  };

  window.addTemplateToCart = function(template) {
    if (cart.some(item => item.title === template.title)) {
      showToast(`"${template.title}" is already in your bag.`);
      return;
    }
    cart.push(template);
    localStorage.setItem('memory_remains_cart', JSON.stringify(cart));
    updateCartCountBadge();
    updateCartDrawer();
    showToast(`"${template.title}" has been added to your bag.`);
  };

  window.addToCartFromCard = function(encodedTemplate) {
    try {
      const template = JSON.parse(decodeURIComponent(encodedTemplate));
      window.addTemplateToCart(template);
    } catch (e) {
      console.error("Error decoding template: ", e);
    }
  };

  window.removeFromCart = function(title) {
    cart = cart.filter(item => item.title !== title);
    localStorage.setItem('memory_remains_cart', JSON.stringify(cart));
    updateCartCountBadge();
    updateCartDrawer();
    showToast('Item removed from your bag.');
  };

  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: '#744237',
      color: '#ffffff',
      padding: '12px 24px',
      borderRadius: '4px',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
      fontFamily: "'Nunito', sans-serif",
      fontSize: '0.9rem',
      fontWeight: '600',
      zIndex: '1000',
      transform: 'translateY(100px)',
      opacity: '0',
      transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'
    });
    
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.transform = 'translateY(100px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 3000);
  }

  // --- Dynamic Templates Loading ---
  let allTemplates = [];

  function createProductCard(template, isSubDir = false) {
    const imageSrc = template.imageUrl || (isSubDir ? '../../assets/placeholder.png' : './assets/placeholder.png');
    const badgeHtml = template.badge ? `<span class="product-badge">${template.badge}</span>` : '';
    
    // Always hide Canva link on the main page/shop page; users must checkout first
    const escapedTemplate = encodeURIComponent(JSON.stringify(template));
    const buttonAction = `<button onclick="event.stopPropagation(); addToCartFromCard('${escapedTemplate}')" class="btn btn-primary" style="margin-top: 1rem; width: 100%; font-size: 0.8rem; padding: 0.6rem;">Add to Bag</button>`;

    // If template has ID, click navigates to details page
    const detailsUrl = template.id 
      ? '/pages/product-details?id=' + template.id
      : '#';

    return `
      <div class="product-card" onclick="if('${detailsUrl}' !== '#') window.location.href='${detailsUrl}';" style="cursor: pointer;">
        <div class="product-image-container">
          ${badgeHtml}
          <img src="${imageSrc}" alt="${template.title}" class="product-image" onerror="this.src='${isSubDir ? '../../assets/instagram_stories_cozy.png' : './assets/instagram_stories_cozy.png'}';">
        </div>
        <div class="product-info">
          <h3 class="product-title" style="margin-bottom: 0.5rem;">${template.title}</h3>
          <p class="product-price">$${Number(template.price || 0).toFixed(2)}</p>
          ${buttonAction}
        </div>
      </div>
    `;
  }

  function renderTemplates(templatesList, containerId, isSubDir = false) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    
    if (templatesList.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-fg-light);">No templates available.</p>';
      return;
    }

    grid.innerHTML = templatesList.map(t => createProductCard(t, isSubDir)).join('');
  }

  // Fetch from Firestore
  if (db) {
    // 1. Featured templates (Home page)
    const featuredGrid = document.getElementById('featured-templates-grid');
    if (featuredGrid) {
      db.collection('templates')
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get()
        .then(snapshot => {
          const templates = [];
          snapshot.forEach(doc => {
            templates.push({ id: doc.id, ...doc.data() });
          });
          renderTemplates(templates, 'featured-templates-grid', false);
        })
        .catch(err => {
          console.error("Error fetching featured templates: ", err);
        });
    }

    // 2. All templates (Shop page)
    const templatesGrid = document.getElementById('templates-grid');
    if (templatesGrid) {
      db.collection('templates')
        .get()
        .then(snapshot => {
          allTemplates = [];
          snapshot.forEach(doc => {
            allTemplates.push({ id: doc.id, ...doc.data() });
          });
          
          // Update product count label
          const countLabel = document.getElementById('product-count-label');
          if (countLabel) {
            countLabel.textContent = `${allTemplates.length} product${allTemplates.length === 1 ? '' : 's'}`;
          }

          // Initial Render (Featured / Date descending)
          sortAndRenderTemplates('Featured');
        })
        .catch(err => {
          console.error("Error fetching templates: ", err);
        });

      // Sort event listener
      const sortBySelect = document.getElementById('sort-by');
      if (sortBySelect) {
        sortBySelect.addEventListener('change', (e) => {
          sortAndRenderTemplates(e.target.value);
        });
      }
    }
  }

  function sortAndRenderTemplates(criteria) {
    let sorted = [...allTemplates];
    if (criteria === 'Price: Low to High') {
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (criteria === 'Price: High to Low') {
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (criteria === 'Alphabetically: A-Z') {
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      // Featured / Default
      sorted.sort((a, b) => {
        const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });
    }
    renderTemplates(sorted, 'templates-grid', true);
  }

  // --- Form Submissions to Firestore ---
  
  // Contact form submission
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const subject = document.getElementById('subject').value.trim();
      const message = document.getElementById('message').value.trim();
      
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;

      if (db) {
        // Save to Firestore contact_messages collection
        db.collection('contact_messages').add({
          name,
          email,
          subject,
          message,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
          showToast('Message sent! We will contact you soon.');
          contactForm.reset();
        })
        .catch(err => {
          console.error("Error saving message: ", err);
          showToast('Something went wrong. Please try again.');
        })
        .finally(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        });
      } else {
        // Fallback simulate
        setTimeout(() => {
          showToast('Message sent! We will contact you soon.');
          contactForm.reset();
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 1000);
      }
    });
  }

  // Newsletter form submission
  const newsletterForms = document.querySelectorAll('.newsletter-form');
  newsletterForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const email = emailInput.value.trim();
      const submitBtn = form.querySelector('button[type="submit"]');
      
      if (email !== '') {
        if (db) {
          submitBtn.disabled = true;
          db.collection('newsletter_subscribers').add({
            email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          })
          .then(() => {
            showToast('Thank you for subscribing to our newsletter!');
            emailInput.value = '';
          })
          .catch(err => {
            console.error("Error subscribing: ", err);
            showToast('Something went wrong. Please try again.');
          })
          .finally(() => {
            submitBtn.disabled = false;
          });
        } else {
          showToast('Thank you for subscribing to our newsletter!');
          emailInput.value = '';
        }
      }
    });
  });

  // --- Cart Drawer Event Listeners ---
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-drawer-overlay');
  const cartIcon = document.querySelector('.cart-icon');
  const cartCloseBtn = document.getElementById('cart-drawer-close-btn');

  function openCartDrawer() {
    if (cartDrawer && cartOverlay) {
      cartDrawer.classList.add('open');
      cartOverlay.classList.add('visible');
      updateCartDrawer();
    }
  }

  function closeCartDrawer() {
    if (cartDrawer && cartOverlay) {
      cartDrawer.classList.remove('open');
      cartOverlay.classList.remove('visible');
    }
  }

  if (cartIcon) {
    cartIcon.addEventListener('click', openCartDrawer);
  }

  if (cartCloseBtn) {
    cartCloseBtn.addEventListener('click', closeCartDrawer);
  }

  if (cartOverlay) {
    cartOverlay.addEventListener('click', closeCartDrawer);
  }

  // Initial cart UI load
  updateCartCountBadge();

  // --- Auth Modal Toggling ---
  const authModal = document.getElementById('auth-modal');
  const authOverlay = document.getElementById('auth-modal-overlay');
  const authCloseBtn = document.getElementById('auth-modal-close-btn');
  const authNavBtn = document.getElementById('auth-nav-btn');
  const authMobileBtn = document.getElementById('auth-mobile-btn');

  window.openAuthModal = function() {
    if (authModal && authOverlay) {
      authModal.classList.add('open');
      authOverlay.classList.add('visible');
    }
  };

  window.closeAuthModal = function() {
    if (authModal && authOverlay) {
      authModal.classList.remove('open');
      authOverlay.classList.remove('visible');
    }
  };

  if (authCloseBtn) {
    authCloseBtn.addEventListener('click', window.closeAuthModal);
  }
  if (authOverlay) {
    authOverlay.addEventListener('click', window.closeAuthModal);
  }

  // Bind auth buttons to open modal
  function bindAuthNav() {
    const user = firebase.auth().currentUser;
    if (user) {
      // If logged in, button clicks log out
      firebase.auth().signOut().then(() => {
        showToast('Logged out successfully.');
      });
    } else {
      window.openAuthModal();
    }
  }

  if (authNavBtn) {
    authNavBtn.addEventListener('click', bindAuthNav);
  }
  if (authMobileBtn) {
    authMobileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      bindAuthNav();
    });
  }

  // --- Google & Facebook Auth ---
  let isSigningIn = false;

  window.loginWithGoogle = function() {
    if (isSigningIn) return;
    if (typeof firebase !== 'undefined') {
      isSigningIn = true;
      const buttons = document.querySelectorAll('#auth-modal button');
      buttons.forEach(b => b.disabled = true);
      
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider)
        .then((result) => {
          showToast(`Welcome ${result.user.displayName || 'Creator'}!`);
          window.closeAuthModal();
        })
        .catch((error) => {
          console.error("Google login failed: ", error);
          showToast(`Login failed: ${error.message}`);
        })
        .finally(() => {
          isSigningIn = false;
          buttons.forEach(b => b.disabled = false);
        });
    }
  };

  window.loginWithFacebook = function() {
    if (isSigningIn) return;
    if (typeof firebase !== 'undefined') {
      isSigningIn = true;
      const buttons = document.querySelectorAll('#auth-modal button');
      buttons.forEach(b => b.disabled = true);
      
      const provider = new firebase.auth.FacebookAuthProvider();
      firebase.auth().signInWithPopup(provider)
        .then((result) => {
          showToast(`Welcome ${result.user.displayName || 'Creator'}!`);
          window.closeAuthModal();
        })
        .catch((error) => {
          console.error("Facebook login failed: ", error);
          showToast(`Login failed: ${error.message}`);
        })
        .finally(() => {
          isSigningIn = false;
          buttons.forEach(b => b.disabled = false);
        });
    }
  };

  // --- Auth State Change Listener ---
  if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged((user) => {
      const checkoutNameInput = document.getElementById('checkout-name');
      const checkoutEmailInput = document.getElementById('checkout-email');

      // Update Nav buttons
      const btnText = user ? 'Logout' : 'Login';
      if (authNavBtn) authNavBtn.textContent = btnText;
      if (authMobileBtn) authMobileBtn.textContent = btnText;

      if (user) {
        // Pre-fill checkout form details
        if (checkoutNameInput) checkoutNameInput.value = user.displayName || '';
        if (checkoutEmailInput) {
          checkoutEmailInput.value = user.email || '';
          checkoutEmailInput.disabled = true;
        }

        // Toggle My Library page content
        const authRequiredEl = document.getElementById('library-auth-required');
        const contentContainerEl = document.getElementById('library-content-container');
        if (authRequiredEl && contentContainerEl) {
          authRequiredEl.style.display = 'none';
          contentContainerEl.style.display = 'block';
          loadUserLibrary(user.email);
        }

        // Toggle Profile page content
        const profileAuthRequired = document.getElementById('profile-auth-required');
        const profileContentContainer = document.getElementById('profile-content-container');
        if (profileAuthRequired && profileContentContainer) {
          profileAuthRequired.style.display = 'none';
          profileContentContainer.style.display = 'block';
          loadUserProfile(user);
        }
      } else {
        // Reset checkout form details
        if (checkoutNameInput) checkoutNameInput.value = '';
        if (checkoutEmailInput) {
          checkoutEmailInput.value = '';
          checkoutEmailInput.disabled = false;
        }

        // Toggle My Library page content
        const authRequiredEl = document.getElementById('library-auth-required');
        const contentContainerEl = document.getElementById('library-content-container');
        if (authRequiredEl && contentContainerEl) {
          authRequiredEl.style.display = 'block';
          contentContainerEl.style.display = 'none';
        }

        // Toggle Profile page content
        const profileAuthRequired = document.getElementById('profile-auth-required');
        const profileContentContainer = document.getElementById('profile-content-container');
        if (profileAuthRequired && profileContentContainer) {
          profileAuthRequired.style.display = 'block';
          profileContentContainer.style.display = 'none';
        }
      }
    });
  }

  // --- Checkout form logic ---
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const user = firebase.auth().currentUser;
      if (!user) {
        closeCartDrawer();
        showToast('You must be logged in to place an order.');
        window.openAuthModal();
        return;
      }

      const name = document.getElementById('checkout-name').value.trim();
      const email = user.email; // Use logged-in user email directly
      
      const submitBtn = checkoutForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Processing...';
      submitBtn.disabled = true;

      if (db && cart.length > 0) {
        // Create a purchase record for each item in the cart
        const promises = cart.map(item => {
          return db.collection('purchases').add({
            email: email,
            productName: item.title,
            pricePaid: Number(item.price || 0),
            purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
            status: "pending",
            buyerName: name
          });
        });

        Promise.all(promises)
          .then(() => {
            showToast('Order placed! We will verify payment and activate your access.');
            cart = [];
            localStorage.setItem('memory_remains_cart', JSON.stringify(cart));
            updateCartCountBadge();
            updateCartDrawer();
            closeCartDrawer();
            checkoutForm.reset();
          })
          .catch(err => {
            console.error("Error creating purchases: ", err);
            showToast('Checkout failed. Please try again.');
          })
          .finally(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          });
      }
    });
  }

  // --- My Library Automatic Loading Logic ---
  function loadUserLibrary(email) {
    const resultsGrid = document.getElementById('library-results-grid');
    const statusMsg = document.getElementById('library-status-message');

    if (!resultsGrid || !statusMsg) return;

    statusMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Accessing your template library...';
    resultsGrid.style.display = 'none';
    resultsGrid.innerHTML = '';

    if (db) {
      db.collection('purchases')
        .where('email', '==', email)
        .where('status', '==', 'completed')
        .get()
        .then(purchaseSnapshot => {
          if (purchaseSnapshot.empty) {
            statusMsg.textContent = 'No confirmed templates found for this account. Please verify payment or contact support.';
            return;
          }

          // Fetch templates to find the matching Canva URL
          db.collection('templates').get().then(templateSnapshot => {
            const templatesDb = {};
            templateSnapshot.forEach(doc => {
              const data = doc.data();
              templatesDb[data.title] = data;
            });

            const listHTML = [];
            purchaseSnapshot.forEach(doc => {
              const purchase = doc.data();
              const productName = purchase.productName;
              
              // Retrieve original template from DB for image/canvaLink
              const template = templatesDb[productName];
              const imageSrc = template ? template.imageUrl : '../../assets/placeholder.png';
              const canvaUrl = template ? template.canvaUrl : 'https://canva.com';

              listHTML.push(`
                <div class="product-card" style="box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid var(--color-border);">
                  <div class="product-image-container" style="padding-top: 100%; position: relative; background: var(--color-secondary);">
                    <span class="product-badge" style="background: #28a745; color: white;">APPROVED</span>
                    <img src="${imageSrc}" alt="${productName}" class="product-image" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;" onerror="this.src='../../assets/instagram_stories_cozy.png';">
                  </div>
                  <div class="product-info" style="padding: 1.2rem; text-align: center;">
                    <h3 class="product-title" style="font-size: 1rem; margin-bottom: 0.5rem;">${productName}</h3>
                    <p class="product-price" style="font-size: 0.9rem; font-weight: 600; color: var(--color-primary); margin-bottom: 1rem;">Available</p>
                    <a href="${canvaUrl}" target="_blank" class="btn btn-primary" style="display: block; font-size: 0.8rem; padding: 0.6rem; text-align: center; text-decoration: none;">Get Template</a>
                  </div>
                </div>
              `);
            });

            statusMsg.textContent = `Found ${listHTML.length} confirmed template(s) in your library!`;
            resultsGrid.innerHTML = listHTML.join('');
            resultsGrid.style.display = 'grid';
          });
        })
        .catch(err => {
          console.error("Error fetching library: ", err);
          statusMsg.textContent = 'Failed to load library. Please try again.';
        });
    } else {
      statusMsg.textContent = 'Firebase not initialized. Cannot fetch library.';
    }
  }

  // Helper to update the cart drawer body HTML
  function updateCartDrawer() {
    const itemsContainer = document.getElementById('cart-items-container');
    const emptyMsg = document.getElementById('cart-empty-message');
    const footer = document.getElementById('cart-drawer-footer');
    const subtotalVal = document.getElementById('cart-subtotal-val');

    if (!itemsContainer) return;

    if (cart.length === 0) {
      itemsContainer.innerHTML = '';
      if (emptyMsg) emptyMsg.style.display = 'block';
      if (footer) footer.style.display = 'none';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    if (footer) footer.style.display = 'block';

    let total = 0;
    const isSubDir = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/collections/');
    
    itemsContainer.innerHTML = cart.map(item => {
      total += Number(item.price || 0);
      let img = item.imageUrl || './assets/placeholder.png';
      if (isSubDir && img.startsWith('./')) {
        img = '../../' + img.substring(2);
      }
      return `
        <div class="cart-item">
          <img src="${img}" alt="${item.title}" class="cart-item-image">
          <div class="cart-item-details">
            <h4 class="cart-item-title">${item.title}</h4>
            <p class="cart-item-price">$${Number(item.price || 0).toFixed(2)}</p>
          </div>
          <button onclick="removeFromCart('${item.title.replace(/'/g, "\\'")}')" class="cart-item-remove" aria-label="Remove item">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
    }).join('');

    if (subtotalVal) {
      subtotalVal.textContent = `$${total.toFixed(2)}`;
    }
  }

  // --- Profile Page Logic ---
  function loadUserProfile(user) {
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const profilePhoneInput = document.getElementById('profile-phone');
    const profileAvatar = document.getElementById('profile-avatar');
    const welcomeTitle = document.getElementById('profile-welcome-title');

    if (profileNameInput) profileNameInput.value = user.displayName || '';
    if (profileEmailInput) profileEmailInput.value = user.email || '';
    if (welcomeTitle) welcomeTitle.textContent = `Welcome, ${user.displayName || 'Creator'}!`;
    if (profileAvatar) {
      profileAvatar.src = user.photoURL || (window.location.pathname.includes('/pages/') ? '../../assets/placeholder.png' : './assets/placeholder.png');
    }

    if (db && profilePhoneInput) {
      db.collection('users').doc(user.uid).get()
        .then(doc => {
          if (doc.exists && doc.data().phoneNumber) {
            profilePhoneInput.value = doc.data().phoneNumber;
          }
        })
        .catch(err => {
          console.error("Error loading user profile from Firestore: ", err);
        });
    }
  }

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = firebase.auth().currentUser;
      if (!user) return;

      const newName = document.getElementById('profile-name').value.trim();
      const newPhone = document.getElementById('profile-phone').value.trim();
      const submitBtn = profileForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;

      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;

      // 1. Update Firebase Auth Profile (displayName)
      user.updateProfile({
        displayName: newName
      })
      .then(() => {
        // 2. Save metadata to Firestore
        if (db) {
          return db.collection('users').doc(user.uid).set({
            displayName: newName,
            phoneNumber: newPhone,
            email: user.email,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      })
      .then(() => {
        showToast('Profile updated successfully!');
        const welcomeTitle = document.getElementById('profile-welcome-title');
        if (welcomeTitle) welcomeTitle.textContent = `Welcome, ${newName}!`;
      })
      .catch(err => {
        console.error("Error updating profile: ", err);
        showToast('Failed to save profile. Please try again.');
      })
      .finally(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // --- Product Details Page Fetching & Carousel Gallery ---
  const urlParams = new URLSearchParams(window.location.search);
  const templateId = urlParams.get('id');
  
  const detailsLoading = document.getElementById('details-loading-state');
  const detailsContent = document.getElementById('details-content-container');

  if (templateId && detailsLoading && detailsContent) {
    if (db) {
      db.collection('templates').doc(templateId).get()
        .then(doc => {
          if (!doc.exists) {
            detailsLoading.innerHTML = '<p style="color: red;">Product not found.</p>';
            return;
          }
          
          const template = { id: doc.id, ...doc.data() };
          
          // Populate details
          document.getElementById('details-title').textContent = template.title;
          document.getElementById('details-price').textContent = `$${Number(template.price || 0).toFixed(2)}`;
          document.getElementById('details-description').textContent = template.description || 'A beautiful minimalist design template, fully customizable in Canva to matches your aesthetic needs.';
          
          const categoryEl = document.getElementById('details-category');
          if (categoryEl) categoryEl.textContent = template.category || 'Templates';

          const badgeEl = document.getElementById('details-badge');
          if (badgeEl) {
            if (template.badge) {
              badgeEl.textContent = template.badge;
              badgeEl.style.display = 'inline-block';
            } else {
              badgeEl.style.display = 'none';
            }
          }

          // Populate main image
          const mainImage = document.getElementById('details-main-image');
          if (mainImage) mainImage.src = template.imageUrl || '../../assets/placeholder.png';

          // Populate showcase thumbnails
          const thumbnailsGallery = document.getElementById('details-thumbnails-gallery');
          if (thumbnailsGallery) {
            const imagesList = [];
            // Add the main preview image first
            if (template.imageUrl) imagesList.push(template.imageUrl);
            // Add any additional showcase images
            if (template.showcaseImages && Array.isArray(template.showcaseImages)) {
              imagesList.push(...template.showcaseImages);
            }

            if (imagesList.length > 1) {
              thumbnailsGallery.innerHTML = imagesList.map((url, idx) => `
                <img src="${url}" class="gallery-thumbnail ${idx === 0 ? 'active' : ''}" onclick="switchDetailsImage(this, '${url}')" 
                     style="width: 70px; height: 70px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 2px solid ${idx === 0 ? 'var(--color-primary)' : 'transparent'}; transition: all 0.2s ease;">
              `).join('');
            } else {
              thumbnailsGallery.style.display = 'none';
            }
          }

          // Bind add to bag button
          const addToBagBtn = document.getElementById('details-add-to-bag-btn');
          if (addToBagBtn) {
            addToBagBtn.addEventListener('click', () => {
              window.addTemplateToCart(template);
            });
          }

          // Show content
          detailsLoading.style.display = 'none';
          detailsContent.style.display = 'grid';
        })
        .catch(err => {
          console.error("Error loading product details: ", err);
          detailsLoading.innerHTML = '<p style="color: red;">Failed to load product. Please try again later.</p>';
        });
    } else {
      detailsLoading.innerHTML = '<p style="color: red;">Firebase not initialized.</p>';
    }
  }

  // Helper to switch main gallery image with cross-fade
  window.switchDetailsImage = function(thumbnailEl, url) {
    const mainImage = document.getElementById('details-main-image');
    if (!mainImage) return;

    // Remove active state from all thumbnails
    const thumbnails = document.querySelectorAll('.gallery-thumbnail');
    thumbnails.forEach(thumb => thumb.style.borderColor = 'transparent');

    // Make this thumbnail active
    thumbnailEl.style.borderColor = 'var(--color-primary)';

    // Cross-fade animation
    mainImage.style.opacity = '0';
    setTimeout(() => {
      mainImage.src = url;
      mainImage.style.opacity = '1';
    }, 200);
  };
});
