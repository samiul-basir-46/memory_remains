import { firebaseConfig } from '../config/firebase-config.js';

let firebaseApp;

export function getFirebaseServices() {
  if (typeof firebase === 'undefined') {
    return { app: null, auth: null, db: null, storage: null };
  }

  if (!firebaseApp) {
    firebaseApp = firebase.apps?.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  }

  return {
    app: firebaseApp,
    auth: typeof firebase.auth === 'function' ? firebase.auth() : null,
    db: typeof firebase.firestore === 'function' ? firebase.firestore() : null,
    storage: typeof firebase.storage === 'function' ? firebase.storage() : null
  };
}
