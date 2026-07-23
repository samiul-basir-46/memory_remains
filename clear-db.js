import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC3itdNEl2ygjnv0wWDgwkx5DFd0awfzMs',
  authDomain: 'memory-remains-b5d38.firebaseapp.com',
  projectId: 'memory-remains-b5d38',
  storageBucket: 'memory-remains-b5d38.firebasestorage.app',
  messagingSenderId: '769735601721',
  appId: '1:769735601721:web:130b0e6511b9aa3bd667e8'
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
