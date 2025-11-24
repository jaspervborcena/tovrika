// Quick script to check current store types in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

// Dev environment config
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

async function checkStoreTypes() {
  try {
    console.log('\n🔍 Checking store types in jasperpos-dev...\n');
    
    const predefinedTypesRef = collection(db, 'predefinedTypes');
    const q = query(
      predefinedTypesRef,
      where('storeId', '==', 'global'),
      where('typeCategory', '==', 'storeType')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ No store types found in database\n');
      console.log('Available store types that can be added:');
      console.log('  - Barbershop');
      console.log('  - Restaurant');
      console.log('  - Retail Store');
      console.log('  - Grocery');
      console.log('  - Pharmacy');
      console.log('  - Cafe');
      console.log('  - Salon');
      return;
    }
    
    console.log(`✅ Found ${snapshot.size} store type(s):\n`);
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`  📋 ${data.typeLabel}`);
      console.log(`     ID: ${data.typeId}`);
      console.log(`     Description: ${data.typeDescription}`);
      console.log(`     Created: ${data.createdAt?.toDate?.() || 'N/A'}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error checking store types:', error.message);
  }
  
  process.exit(0);
}

checkStoreTypes();
