import { getFirebaseServices } from './firebase-service.js';
import { createToast, qs } from '../utils/ui.js';

export function openAuthModal(initialTab = 'login') {
  const modal = qs('#auth-modal');
  const overlay = qs('#auth-modal-overlay');
  if (!modal || !overlay) return;

  modal.classList.add('is-open');
  overlay.classList.add('is-open');

  if (initialTab === 'signup') {
    qs('#auth-tab-signup')?.click();
  } else {
    qs('#auth-tab-login')?.click();
  }
}

export function closeAuthModal() {
  const modal = qs('#auth-modal');
  const overlay = qs('#auth-modal-overlay');
  if (!modal || !overlay) return;

  modal.classList.remove('is-open');
  overlay.classList.remove('is-open');
}

export function watchAuthState(onAuthStateChangedCallback) {
  const { auth } = getFirebaseServices();
  if (!auth) return;

  auth.onAuthStateChanged((user) => {
    const userBtnText = qs('#header-user-btn-text');
    if (userBtnText) {
      userBtnText.textContent = user ? (user.displayName || user.email?.split('@')[0] || 'Account') : 'Sign In';
    }

    if (onAuthStateChangedCallback) {
      onAuthStateChangedCallback(user);
    }
  });
}

export function initAuthModalEvents() {
  const { auth } = getFirebaseServices();
  const overlay = qs('#auth-modal-overlay');
  const closeBtn = qs('#auth-modal-close-btn');

  overlay?.addEventListener('click', closeAuthModal);
  closeBtn?.addEventListener('click', closeAuthModal);

  const tabLogin = qs('#auth-tab-login');
  const tabSignup = qs('#auth-tab-signup');
  const formLogin = qs('#auth-form-login');
  const formSignup = qs('#auth-form-signup');

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('is-active');
    tabSignup?.classList.remove('is-active');
    if (formLogin) formLogin.hidden = false;
    if (formSignup) formSignup.hidden = true;
  });

  tabSignup?.addEventListener('click', () => {
    tabSignup.classList.add('is-active');
    tabLogin?.classList.remove('is-active');
    if (formSignup) formSignup.hidden = false;
    if (formLogin) formLogin.hidden = true;
  });

  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth) return;
    const email = qs('#login-email')?.value.trim();
    const pass = qs('#login-password')?.value.trim();

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      createToast('Successfully logged in.');
      closeAuthModal();
    } catch (err) {
      createToast(err.message || 'Login failed', 'error');
    }
  });

  formSignup?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth) return;
    const name = qs('#signup-name')?.value.trim();
    const email = qs('#signup-email')?.value.trim();
    const pass = qs('#signup-password')?.value.trim();

    try {
      const res = await auth.createUserWithEmailAndPassword(email, pass);
      if (res.user && name) {
        await res.user.updateProfile({ displayName: name });
      }
      createToast('Account created successfully.');
      closeAuthModal();
    } catch (err) {
      createToast(err.message || 'Registration failed', 'error');
    }
  });
}
