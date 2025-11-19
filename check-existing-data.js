// Script to check existing orders and tracking data
// Run this in browser console to see what data exists

const checkExistingData = async () => {
  try {
    const { getDocs, collection, getFirestore, query, orderBy, limit } = window.firebase.firestore || window.firestore;
    
    if (!getDocs) {
      console.error('Firebase Firestore not available');
      return;
    }

    const db = getFirestore();
    
    console.log('🔍 Checking existing orderSellingTracking data...');
    
    // Check orderSellingTracking collection
    const trackingRef = collection(db, 'orderSellingTracking');
    const trackingQuery = query(trackingRef, orderBy('createdAt', 'desc'), limit(10));
    const trackingSnap = await getDocs(trackingQuery);
    
    console.log(`📦 Found ${trackingSnap.size} tracking entries:`);
    trackingSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- Order: ${data.orderId} | Product: ${data.productName || data.name || 'Unknown'} | Status: ${data.status}`);
    });
    
    // Check recent orders
    console.log('\n🔍 Checking recent orders...');
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, orderBy('createdAt', 'desc'), limit(5));
    const ordersSnap = await getDocs(ordersQuery);
    
    console.log(`📝 Found ${ordersSnap.size} recent orders:`);
    ordersSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id} | Invoice: ${data.invoiceNumber} | Status: ${data.status} | Total: ₱${data.totalAmount}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking data:', error);
  }
};

// Run the function
checkExistingData();