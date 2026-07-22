import { getFirebaseServices } from './firebase-service.js';
import { createToast, qs } from '../utils/ui.js';

export function openAuthModal() {
  const modal = qs('#auth-modal');
  const overlay = qs('#auth-modal-overlay');
  if (!modal || !overlay) return;

  modal.classList.add('is-open');
  overlay.classList.add('is-open', 'is-visible');
}

export function closeAuthModal() {
  const modal = qs('#auth-modal');
  const overlay = qs('#auth-modal-overlay');
  if (!modal || !overlay) return;

  modal.classList.remove('is-open');
  overlay.classList.remove('is-open', 'is-visible');
}

export async function signInWithGoogle() {
  const { auth } = getFirebaseServices();
  if (!auth) {
    createToast('Firebase service is not initialized.', 'error');
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    await auth.signInWithPopup(provider);
    createToast('Signed in with Google successfully.');
    closeAuthModal();
  } catch (err) {
    console.warn('Google popup auth failed, attempting redirect:', err);
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithRedirect(provider);
      } catch (redirectErr) {
        createToast(redirectErr.message || 'Google sign in failed.', 'error');
      }
    } else {
      createToast(err.message || 'Google sign in failed.', 'error');
    }
  }
}

export async function signInWithFacebook() {
  const { auth } = getFirebaseServices();
  if (!auth) {
    createToast('Firebase service is not initialized.', 'error');
    return;
  }

  try {
    const provider = new firebase.auth.FacebookAuthProvider();
    await auth.signInWithPopup(provider);
    createToast('Signed in with Facebook successfully.');
    closeAuthModal();
  } catch (err) {
    console.warn('Facebook popup auth failed, attempting redirect:', err);
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      try {
        const provider = new firebase.auth.FacebookAuthProvider();
        await auth.signInWithRedirect(provider);
      } catch (redirectErr) {
        createToast(redirectErr.message || 'Facebook sign in failed.', 'error');
      }
    } else {
      createToast(err.message || 'Facebook sign in failed.', 'error');
    }
  }
}

export function watchAuthState(onAuthStateChangedCallback) {
  const { auth, db } = getFirebaseServices();
  if (!auth) return;

  // Handle redirect sign-in results (mobile browsers or popup-blocked fallbacks)
  auth.getRedirectResult().then((result) => {
    if (result && result.user) {
      createToast('Signed in successfully.');
      closeAuthModal();
    }
  }).catch((err) => {
    if (err && err.code !== 'auth/null-user') {
      console.error('Redirect sign in error:', err);
    }
  });

  auth.onAuthStateChanged(async (user) => {
    const userBtnText = qs('#header-user-btn-text');
    const avatarBox = qs('#header-user-avatar');
    const avatarImg = qs('#header-user-avatar-img');
    const avatarInitials = qs('#header-user-avatar-initials');
    const dropdown = qs('#user-profile-dropdown');
    const dropdownName = qs('#user-dropdown-name');
    const dropdownEmail = qs('#user-dropdown-email');
    const authNavBtn = qs('#auth-nav-btn');
    const logoutBtn = qs('#header-logout-btn');

    // Mobile Drawer elements
    const authMobileBtn = qs('#auth-mobile-btn');
    const mobileUserProfileBox = qs('#mobile-user-profile-box');
    const mobileUserName = qs('#mobile-user-name');
    const mobileUserEmail = qs('#mobile-user-email');
    const mobileAvatarImg = qs('#mobile-user-avatar-img');
    const mobileAvatarInitials = qs('#mobile-user-avatar-initials');
    const mobileLogoutBtn = qs('#mobile-logout-btn');

    if (user) {
      const displayName = user.displayName || user.email?.split('@')[0] || 'Account';
      if (userBtnText) userBtnText.textContent = displayName;
      if (dropdownName) dropdownName.textContent = displayName;
      if (dropdownEmail) dropdownEmail.textContent = user.email || '';

      if (avatarBox) avatarBox.classList.remove('hidden');

      if (user.photoURL) {
        if (avatarImg) {
          avatarImg.src = user.photoURL;
          avatarImg.classList.remove('hidden');
        }
        if (avatarInitials) avatarInitials.classList.add('hidden');
      } else {
        if (avatarImg) avatarImg.classList.add('hidden');
        if (avatarInitials) {
          avatarInitials.textContent = displayName.charAt(0).toUpperCase();
          avatarInitials.classList.remove('hidden');
        }
      }

      // Mobile Drawer User View
      if (authMobileBtn) authMobileBtn.classList.add('hidden');
      if (mobileUserProfileBox) mobileUserProfileBox.classList.remove('hidden');
      if (mobileUserName) mobileUserName.textContent = displayName;
      if (mobileUserEmail) mobileUserEmail.textContent = user.email || '';

      if (user.photoURL) {
        if (mobileAvatarImg) {
          mobileAvatarImg.src = user.photoURL;
          mobileAvatarImg.classList.remove('hidden');
        }
        if (mobileAvatarInitials) mobileAvatarInitials.classList.add('hidden');
      } else {
        if (mobileAvatarImg) mobileAvatarImg.classList.add('hidden');
        if (mobileAvatarInitials) {
          mobileAvatarInitials.textContent = displayName.charAt(0).toUpperCase();
          mobileAvatarInitials.classList.remove('hidden');
        }
      }

      if (db) {
        try {
          await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            name: displayName,
            email: user.email || '',
            photoURL: user.photoURL || '',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (_) {}
      }
    } else {
      if (userBtnText) userBtnText.textContent = 'Sign In';
      if (avatarBox) avatarBox.classList.add('hidden');
      if (dropdown) dropdown.classList.add('hidden');

      if (authMobileBtn) authMobileBtn.classList.remove('hidden');
      if (mobileUserProfileBox) mobileUserProfileBox.classList.add('hidden');
    }

    if (authNavBtn) {
      authNavBtn.onclick = (e) => {
        e.stopPropagation();
        if (auth.currentUser) {
          if (dropdown) dropdown.classList.toggle('hidden');
        } else {
          openAuthModal();
        }
      };
    }

    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        try {
          await auth.signOut();
          createToast('Logged out successfully.');
          if (dropdown) dropdown.classList.add('hidden');
        } catch (err) {
          createToast(err.message || 'Logout failed', 'error');
        }
      };
    }

    if (mobileLogoutBtn) {
      mobileLogoutBtn.onclick = async () => {
        try {
          await auth.signOut();
          createToast('Logged out successfully.');
        } catch (err) {
          createToast(err.message || 'Logout failed', 'error');
        }
      };
    }

    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && !authNavBtn?.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });

    if (onAuthStateChangedCallback) {
      onAuthStateChangedCallback(user);
    }
  });
}

export async function updateUserProfileInfo({ displayName, photoURL }) {
  const { auth, db } = getFirebaseServices();
  if (!auth || !auth.currentUser) {
    throw new Error('Not authenticated');
  }

  const user = auth.currentUser;
  const updateData = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (photoURL !== undefined) updateData.photoURL = photoURL;

  await user.updateProfile(updateData);

  if (db) {
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  const userBtnText = qs('#header-user-btn-text');
  const avatarImg = qs('#header-user-avatar-img');
  const avatarInitials = qs('#header-user-avatar-initials');

  if (displayName && userBtnText) userBtnText.textContent = displayName;
  if (photoURL && avatarImg) {
    avatarImg.src = photoURL;
    avatarImg.classList.remove('hidden');
    if (avatarInitials) avatarInitials.classList.add('hidden');
  }

  return user;
}

export function initAuthModalEvents() {
  const overlay = qs('#auth-modal-overlay');
  const closeBtn = qs('#auth-modal-close-btn');

  overlay?.addEventListener('click', closeAuthModal);
  closeBtn?.addEventListener('click', closeAuthModal);

  document.addEventListener('click', (e) => {
    const googleBtn = e.target.closest('#btn-google-login');
    if (googleBtn) {
      e.preventDefault();
      signInWithGoogle();
      return;
    }

    const facebookBtn = e.target.closest('#btn-facebook-login');
    if (facebookBtn) {
      e.preventDefault();
      signInWithFacebook();
      return;
    }

    const closeTarget = e.target.closest('#auth-modal-close-btn');
    if (closeTarget) {
      e.preventDefault();
      closeAuthModal();
      return;
    }
  });
}
