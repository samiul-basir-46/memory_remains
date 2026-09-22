import { getFirebaseServices } from '../services/firebase-service.js';
import { adminState } from './admin-state.js';

export async function loginAdmin(email, password) {
  const { auth } = getFirebaseServices();
  if (!auth) throw new Error('Firebase Auth not available');
  return await auth.signInWithEmailAndPassword(email, password);
}

export async function registerAdmin(email, password) {
  const { auth } = getFirebaseServices();
  if (!auth) throw new Error('Firebase Auth not available');
  return await auth.createUserWithEmailAndPassword(email, password);
}

export async function logoutAdmin() {
  const { auth } = getFirebaseServices();
  if (!auth) return;
  adminState.clearSubscriptions();
  await auth.signOut();
  adminState.setState({ currentUser: null, activeTabIndex: 0 });
}

export function initAdminAuth(onAuthChange) {
  const { auth } = getFirebaseServices();
  if (!auth) {
    console.error('Firebase Auth is not initialized');
    adminState.setState({ authLoading: false, currentUser: null });
    if (onAuthChange) onAuthChange(null);
    return () => {};
  }

  return auth.onAuthStateChanged(user => {
    adminState.setState({
      currentUser: user,
      authLoading: false
    });
    if (onAuthChange) onAuthChange(user);
  });
}
