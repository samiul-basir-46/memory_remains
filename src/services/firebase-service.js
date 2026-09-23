import { firebaseConfig } from '../config/firebase-config.js';

export const formFirebaseConfig = {
  apiKey: "AIzaSyB807RNQxhKNDsuzq6odGZsMYOqnfrr1Z8",
  authDomain: "pettybloomform.firebaseapp.com",
  projectId: "pettybloomform",
  storageBucket: "pettybloomform.firebasestorage.app",
  messagingSenderId: "620706941312",
  appId: "1:620706941312:web:b5f6f6adc5d2b9d4099965"
};

let firebaseApp;
let formFirebaseApp;

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

export function getFormDb() {
  if (typeof firebase === 'undefined') return null;

  if (!formFirebaseApp) {
    try {
      formFirebaseApp = firebase.app('pettyBloomForm');
    } catch (_) {
      formFirebaseApp = firebase.initializeApp(formFirebaseConfig, 'pettyBloomForm');
    }
  }

  return typeof formFirebaseApp.firestore === 'function' ? formFirebaseApp.firestore() : null;
}

