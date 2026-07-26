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
    console.error('Google sign in error:', err);
    if (err.code === 'auth/popup-blocked') {
      createToast('Popup was blocked by your browser. Please allow popups and try again.', 'error');
    } else if (err.code === 'auth/popup-closed-by-user') {
      createToast('Sign in popup was closed before completing.', 'error');
    } else {
      createToast(err.message || 'Google sign in failed.', 'error');
    }
  }
}

export async function signInWithFacebook() {
  const { auth, db } = getFirebaseServices();
  if (!auth) {
    createToast('Firebase service is not initialized.', 'error');
    return;
  }

  try {
    const provider = new firebase.auth.FacebookAuthProvider();
    provider.addScope('email');
    provider.addScope('public_profile');
    const result = await auth.signInWithPopup(provider);
    console.log('Facebook sign in result:', result);

    const user = result.user;
    if (user) {
      // Extract exact OAuth photo URL from additionalUserInfo or providerData
      const fbPhoto = result.additionalUserInfo?.profile?.picture?.data?.url ||
                      user.providerData?.[0]?.photoURL ||
                      user.photoURL;

      if (fbPhoto) {
        console.log('Detected Facebook profile photo URL:', fbPhoto);
        await user.updateProfile({ photoURL: fbPhoto });
        if (db) {
          await db.collection('users').doc(user.uid).set({
            photoURL: fbPhoto,
            name: user.displayName || '',
            email: user.email || '',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }
    }

    createToast('Signed in with Facebook successfully.');
    closeAuthModal();
  } catch (err) {
    console.error('Facebook sign in detailed error:', err);
    if (err.code === 'auth/popup-blocked') {
      createToast('Popup was blocked by your browser. Please allow popups and try again.', 'error');
    } else if (err.code === 'auth/popup-closed-by-user') {
      createToast('Sign in popup was closed before completing.', 'error');
    } else if (err.code === 'auth/unauthorized-domain') {
      createToast('Domain not authorized in Firebase Console.', 'error');
    } else if (err.code === 'auth/account-exists-with-different-credential') {
      createToast('An account already exists with the same email address using Google or Email/Password.', 'error');
    } else if (err.code === 'auth/auth-domain-config-required') {
      createToast('Firebase authDomain configuration issue.', 'error');
    } else {
      createToast(`Facebook sign in failed: ${err.message || err.code}`, 'error');
    }
  }
}

export function getHighResPhotoUrl(photoURL) {
  if (!photoURL) return '';
  if (photoURL.includes('facebook.com') || photoURL.includes('graph.facebook.com')) {
    if (!photoURL.includes('type=')) {
      return photoURL.includes('?') ? `${photoURL}&type=large` : `${photoURL}?type=large`;
    }
  }
  return photoURL;
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
      const userPhoto = getHighResPhotoUrl(user.photoURL);

      if (userBtnText) userBtnText.textContent = displayName;
      if (dropdownName) dropdownName.textContent = displayName;
      if (dropdownEmail) dropdownEmail.textContent = user.email || '';

      if (avatarBox) avatarBox.classList.remove('hidden');

      if (userPhoto) {
        if (avatarImg) {
          avatarImg.src = userPhoto;
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

      if (userPhoto) {
        if (mobileAvatarImg) {
          mobileAvatarImg.src = userPhoto;
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

      // Only write to Firestore once per session to save writes
      if (db) {
        const sessionKey = `user_synced_${user.uid}`;
        const alreadySynced = sessionStorage.getItem(sessionKey);
        if (!alreadySynced) {
          try {
            await db.collection('users').doc(user.uid).set({
              uid: user.uid,
              name: displayName,
              email: user.email || '',
              photoURL: userPhoto || '',
              updatedAt: new Date().toISOString()
            }, { merge: true });
            sessionStorage.setItem(sessionKey, '1');
          } catch (_) {}
        }
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
  const userPhoto = getHighResPhotoUrl(user.photoURL);

  if (db) {
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      photoURL: userPhoto || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  const userBtnText = qs('#header-user-btn-text');
  const avatarImg = qs('#header-user-avatar-img');
  const avatarInitials = qs('#header-user-avatar-initials');

  if (displayName && userBtnText) userBtnText.textContent = displayName;
  if (userPhoto && avatarImg) {
    avatarImg.src = userPhoto;
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
