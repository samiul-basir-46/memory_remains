import { firebaseConfig } from '../config/firebase-config.js';

let firebaseApp;

export function getFirebaseServices() {
  if (typeof firebase === 'undefined') {
    return { app: null, auth: null, db: null };
  }

  if (!firebaseApp) {
    firebaseApp = firebase.apps?.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  }

  return {
    app: firebaseApp,
    auth: firebase.auth(),
    db: firebase.firestore()
  };
}
