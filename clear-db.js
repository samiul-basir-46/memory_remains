import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDsa-BtG68kkEVASVq_v8gtjURwzzRnSdA',
  authDomain: 'petty-bloom.firebaseapp.com',
  projectId: 'petty-bloom',
  storageBucket: 'petty-bloom.firebasestorage.app',
  messagingSenderId: '616648686687',
  appId: '1:616648686687:web:6a3b7f3d507839308fafea'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collectionsToClear = ['purchases', 'payments', 'orders', 'unmatched_sms', 'sms_logs'];

async function clearDatabase() {
  console.log('Starting Firestore database clear...');
  for (const collName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, collName));
      console.log(`Found ${snap.docs.length} documents in '${collName}'`);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, collName, d.id));
        console.log(`Deleted document ${d.id} from '${collName}'`);
      }
    } catch (err) {
      console.error(`Error clearing collection '${collName}':`, err);
    }
  }
  console.log('Database clear completed successfully!');
  process.exit(0);
}

clearDatabase();
