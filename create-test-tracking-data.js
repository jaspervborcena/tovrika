// Simple script to create test orderSellingTracking data
// Run this in browser console on your app page to create test data

const createTestTrackingData = async () => {
  // Using the Firebase SDK that's already loaded in your app
  const { addDoc, collection, getFirestore } = window.firebase.firestore || window.firestore;
  
  if (!addDoc) {
    console.error('Firebase Firestore not available');
    return;
  }

  const db = getFirestore();
  const testData = [
    {
      orderId: 'INV-2025-000066', // The order from your screenshot
      productName: 'Coffee Beans - Premium Blend',
      sku: 'CB-001',
      price: 150.00,
      quantity: 2,
      vatAmount: 18.00,
      discountAmount: 10.00,
      total: 290.00,
      status: 'pending',
      createdAt: new Date(),
      entryType: 'sale'
    },
    {
      orderId: 'INV-2025-000066',
      productName: 'Espresso Cup Set',
      sku: 'EC-002',
      price: 50.00,
      quantity: 1,
      vatAmount: 6.00,
      discountAmount: 0.00,
      total: 56.00,
      status: 'completed',
      createdAt: new Date(),
      entryType: 'sale'
    }
  ];

  try {
    for (const entry of testData) {
      await addDoc(collection(db, 'orderSellingTracking'), entry);
      console.log('✅ Created test tracking entry:', entry.productName);
    }
    console.log('🎉 All test tracking data created! Try opening Manage Item Status again.');
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
};

// Run the function
createTestTrackingData();