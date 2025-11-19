// Test data creation script for orderSellingTracking
// You can run this in your browser console on the POS page to create sample data

async function createSampleTrackingData() {
  try {
    console.log('🧪 Creating sample tracking data...');
    
    // Get the Firebase Firestore instance that's already loaded in your app
    const firestore = window.firebase?.firestore || window.firestore;
    if (!firestore) {
      console.error('❌ Firebase Firestore not available. Make sure you\'re on the POS app page.');
      return;
    }

    const { addDoc, collection } = firestore;
    const db = firestore.getFirestore();

    // Sample tracking entries for testing
    const sampleEntries = [
      {
        orderId: 'INV-2025-000066', // Use the order ID from your screenshot
        productName: 'Premium Coffee Beans',
        skuId: 'CB-001',
        productSku: 'CB-001',
        price: 150.00,
        sellingPrice: 150.00,
        quantity: 2,
        qty: 2,
        vatAmount: 18.00,
        vat: 12,
        vatRate: 12,
        discountAmount: 10.00,
        discount: 10.00,
        total: 290.00,
        status: 'completed',
        entryStatus: 'completed',
        entryType: 'sale',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        orderId: 'INV-2025-000066',
        productName: 'Espresso Roast',
        skuId: 'ER-002',
        productSku: 'ER-002',
        price: 75.00,
        sellingPrice: 75.00,
        quantity: 1,
        qty: 1,
        vatAmount: 9.00,
        vat: 12,
        vatRate: 12,
        discountAmount: 0.00,
        discount: 0.00,
        total: 84.00,
        status: 'pending',
        entryStatus: 'pending',
        entryType: 'sale',
        createdAt: new Date(Date.now() - 60000), // 1 minute ago
        updatedAt: new Date()
      },
      {
        orderId: 'INV-2025-000066',
        productName: 'Coffee Filter Papers',
        skuId: 'CFP-003',
        productSku: 'CFP-003',
        price: 25.00,
        sellingPrice: 25.00,
        quantity: 1,
        qty: 1,
        vatAmount: 3.00,
        vat: 12,
        vatRate: 12,
        discountAmount: 5.00,
        discount: 5.00,
        total: 23.00,
        status: 'processing',
        entryStatus: 'processing',
        entryType: 'sale',
        createdAt: new Date(Date.now() - 120000), // 2 minutes ago
        updatedAt: new Date()
      }
    ];

    console.log(`📝 Adding ${sampleEntries.length} sample tracking entries...`);

    for (let i = 0; i < sampleEntries.length; i++) {
      const entry = sampleEntries[i];
      console.log(`   Adding entry ${i + 1}: ${entry.productName} (${entry.status})`);
      
      await addDoc(collection(db, 'orderSellingTracking'), entry);
      console.log(`   ✅ Added: ${entry.productName}`);
    }

    console.log('🎉 Sample tracking data created successfully!');
    console.log('💡 Now try opening the "Manage Item Status" dialog again.');
    
    return true;
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    return false;
  }
}

// Auto-run the function
createSampleTrackingData();