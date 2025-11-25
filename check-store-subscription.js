const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, orderBy, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyABpbnPUjr16LnLU8WSJ1BmVvWy0tTmaI4",
  authDomain: "jasperpos-dev.firebaseapp.com",
  projectId: "jasperpos-dev",
  storageBucket: "jasperpos-dev.firebasestorage.app",
  messagingSenderId: "425012486350",
  appId: "1:425012486350:web:6a1289e238eb26fb36709f",
  measurementId: "G-5BLXC1688Z"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run(companyId, storeName) {
  try {
    console.log('Searching for store', { companyId, storeName });
    const storesRef = collection(db, 'stores');
    const q = query(storesRef, where('companyId', '==', companyId), where('storeName', '==', storeName));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log('No matching store found');
      return;
    }
    const storeDoc = snap.docs[0];
    console.log('Found store:', storeDoc.id);
    const storeData = storeDoc.data();
    console.log('store.subscriptionEndDate raw:', storeData.subscriptionEndDate);
    const storeEnd = storeData.subscriptionEndDate && storeData.subscriptionEndDate.toDate ? storeData.subscriptionEndDate.toDate().toISOString() : storeData.subscriptionEndDate || null;
    console.log('store.subscriptionEndDate parsed:', storeEnd);

    // Now fetch latest subscription for this company+store
    const subsRef = collection(db, 'subscriptions');
    const q2 = query(subsRef, where('companyId', '==', companyId), where('storeId', '==', storeDoc.id), orderBy('endDate', 'desc'), limit(1));
    const snap2 = await getDocs(q2);
    if (snap2.empty) {
      console.log('No subscriptions found for this store');
      return;
    }
    const subDoc = snap2.docs[0];
    const raw = subDoc.data();
    const subEnd = raw.endDate && raw.endDate.toDate ? raw.endDate.toDate().toISOString() : raw.endDate || null;
    console.log('Latest subscription id:', subDoc.id);
    console.log('Latest subscription endDate raw:', raw.endDate);
    console.log('Latest subscription endDate parsed:', subEnd);
  } catch (err) {
    console.error('Error:', err);
  }
}

// Replace these values if different
const companyId = 'gMasGJII3kR4f1w3IHQV';
const storeName = 'Brew Organics inc';
run(companyId, storeName).then(() => process.exit(0));
