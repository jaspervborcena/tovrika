import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  doc, 
  getDoc, 
  runTransaction,
  collection,
  addDoc,
  DocumentReference,
  query,
  where,
  getDocs
} from '@angular/fire/firestore';
import { StoreService } from './store.service';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';

export interface InvoiceTransactionData {
  storeId: string;
  orderData: any; // The complete order data to be saved
  customerInfo?: any;
  paymentsData?: any; // Payment information
}

export interface InvoiceResult {
  invoiceNumber: string;
  orderId: string;
  success: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private firestore = inject(Firestore);
  private storeService = inject(StoreService);
  private authService = inject(AuthService);
  private securityService = inject(FirestoreSecurityService);
  private offlineDocService = inject(OfflineDocumentService);

  /**
   * Check if an invoice number already exists in the orders collection
   */
  async checkInvoiceNumberExists(invoiceNumber: string, storeId: string): Promise<boolean> {
    try {
      console.log('🔍 Checking if invoice number exists:', invoiceNumber);
      
      const ordersRef = collection(this.firestore, 'orders');
      const q = query(
        ordersRef,
        where('invoiceNumber', '==', invoiceNumber),
        where('storeId', '==', storeId)
      );
      
      const snapshot = await getDocs(q);
      const exists = !snapshot.empty;
      
      console.log(`🔍 Invoice number ${invoiceNumber} exists:`, exists);
      
      if (exists) {
        console.log('⚠️ Duplicate invoice number detected:', invoiceNumber);
        // Log the existing order details
        snapshot.docs.forEach(doc => {
          console.log('📋 Existing order:', {
            id: doc.id,
            invoiceNumber: doc.data()['invoiceNumber'],
            createdAt: doc.data()['createdAt'],
            totalAmount: doc.data()['totalAmount']
          });
        });
      }
      
      return exists;
      
    } catch (error) {
      console.error('❌ Error checking invoice number existence:', error);
      // In case of error, assume it doesn't exist to allow the transaction to proceed
      return false;
    }
  }

  /**
   * Generate and assign invoice number with atomic transaction
   * This ensures that invoice numbers are never duplicated
   * Now includes duplicate prevention check
   */
  async processInvoiceTransaction(transactionData: InvoiceTransactionData): Promise<InvoiceResult> {
    const { storeId, orderData, customerInfo, paymentsData } = transactionData;
    
    console.log('🧾 Starting invoice transaction for store:', storeId);
    
    try {
      const result = await runTransaction(this.firestore, async (transaction) => {
        // 1. Get current store data
        const storeDocRef = doc(this.firestore, 'stores', storeId);
        const storeDoc = await transaction.get(storeDocRef);
        
        if (!storeDoc.exists()) {
          throw new Error(`Store with ID ${storeId} not found`);
        }

        const storeData = storeDoc.data();
        const currentInvoiceNo = storeData['invoiceNo'] || this.storeService.generateDefaultInvoiceNo();
        
        console.log('🧾 Current invoice number:', currentInvoiceNo);
        
        // 2. Generate next invoice number
        const nextInvoiceNo = this.storeService.generateNextInvoiceNo(currentInvoiceNo);
        console.log('🧾 Next invoice number:', nextInvoiceNo);
        
        // 🚨 NEW: Check for duplicate invoice number before proceeding
        const isDuplicate = await this.checkInvoiceNumberExists(nextInvoiceNo, storeId);
        
        if (isDuplicate) {
          const errorMessage = `Duplicate invoice number detected: ${nextInvoiceNo}. This order may have already been processed.`;
          console.error('🚨 DUPLICATE PREVENTION:', errorMessage);
          throw new Error(errorMessage);
        }
        
        console.log('✅ Invoice number is unique, proceeding with transaction:', nextInvoiceNo);
        
        // 3. Update store with new invoice number
        transaction.update(storeDocRef, { 
          invoiceNo: nextInvoiceNo,
          updatedAt: new Date()
        });
        
        // 4. Create order with the assigned invoice number
        const ordersRef = collection(this.firestore, 'orders');
        const orderDocRef = doc(ordersRef); // Generate new doc reference
        
        // 5. Create orderDetails documents with batching (BEFORE removing items from main order)
        if (orderData.items && orderData.items.length > 0) {
          const batches = this.createOrderDetailsBatches(orderData.items, 50);
          console.log(`📦 Creating ${batches.length} orderDetails batch(es) for ${orderData.items.length} total items`);
          
          // Create one document per batch to avoid 1MB Firestore limit
          for (const batch of batches) {
            const orderDetailsRef = collection(this.firestore, 'orderDetails');
            const orderDetailsDocRef = doc(orderDetailsRef);
            
            // Add security fields to orderDetails (with IndexedDB UID support)
            const orderDetailsWithSecurity = await this.securityService.addSecurityFields({
              orderId: orderDocRef.id,
              companyId: orderData.companyId,
              storeId: storeId,
              batchNumber: batch.batchNumber,
              items: batch.items // Max 50 items per batch
            });
            
            const orderDetailsData = orderDetailsWithSecurity;
            
            transaction.set(orderDetailsDocRef, orderDetailsData);
            console.log(`📦 Batch ${batch.batchNumber}/${batches.length} prepared with ${batch.items.length} items (docId: ${orderDetailsDocRef.id})`);
          }
          
          console.log(`✅ All ${batches.length} orderDetails batches prepared successfully for order ${orderDocRef.id}`);
        }
        
        // Remove items from main order data (items will only be in orderDetails collection)
        const { items, ...orderDataWithoutItems } = orderData;
        
        // Add security fields to order (with IndexedDB UID support)
        const orderWithSecurity = await this.securityService.addSecurityFields({
          ...orderDataWithoutItems, // Order data WITHOUT items
          invoiceNumber: nextInvoiceNo,
          storeId: storeId,
          status: 'completed',
          createdBy: this.authService.getCurrentUser()?.uid || 'system'
        });
        
        const completeOrderData = {
          ...orderWithSecurity,
          
          // NEW: customerInfo as a proper map structure
          customerInfo: customerInfo ? {
            customerId: customerInfo.customerId || '',
            fullName: customerInfo.fullName || 'Walk-in Customer',
            address: customerInfo.address || 'Philippines',
            tin: customerInfo.tin || ''
          } : {
            customerId: '',
            fullName: 'Walk-in Customer',
            address: 'Philippines',
            tin: ''
          },
          
          // NEW: payments as a proper map structure  
          payments: paymentsData ? {
            amountTendered: paymentsData.amountTendered || 0,
            changeAmount: paymentsData.changeAmount || 0,
            paymentDescription: paymentsData.paymentDescription || 'Cash Payment'
          } : {
            amountTendered: 0,
            changeAmount: 0,
            paymentDescription: 'Cash Payment'
          }
        };
        
        console.log('🔥 Main order structure (WITHOUT items):', JSON.stringify(completeOrderData, null, 2));
        
        transaction.set(orderDocRef, completeOrderData);
        
        console.log('🧾 Transaction prepared successfully');
        
        return {
          invoiceNumber: nextInvoiceNo,
          orderId: orderDocRef.id,
          success: true
        };
      });
      
      console.log('✅ Invoice transaction completed successfully:', result);
      
      // Update the store service cache
      this.updateStoreCache(storeId, result.invoiceNumber);
      
      return result;
      
    } catch (error) {
      console.error('❌ Invoice transaction failed:', error);
      return {
        invoiceNumber: '',
        orderId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get next invoice number preview (without updating)
   */
  async getNextInvoiceNumberPreview(storeId: string): Promise<string> {
    try {
      const storeDocRef = doc(this.firestore, 'stores', storeId);
      const storeDoc = await getDoc(storeDocRef);
      
      if (!storeDoc.exists()) {
        throw new Error(`Store with ID ${storeId} not found`);
      }
      
      const storeData = storeDoc.data();
      const currentInvoiceNo = storeData['invoiceNo'] || this.storeService.generateDefaultInvoiceNo();
      
      return this.storeService.generateNextInvoiceNo(currentInvoiceNo);
    } catch (error) {
      console.error('❌ Error getting next invoice number preview:', error);
      return 'ERROR-PREVIEW-FAILED';
    }
  }

  /**
   * Initialize invoice numbers for stores that don't have them
   */
  async initializeInvoiceNumbers(companyId: string): Promise<void> {
    try {
      const stores = this.storeService.getStores();
      const companyStores = stores.filter(store => store.companyId === companyId);
      
      console.log(`🧾 Initializing invoice numbers for ${companyStores.length} stores...`);
      
      for (const store of companyStores) {
        if (!store.invoiceNo && store.id) {
          await this.storeService.initializeInvoiceNoForStore(store.id);
        }
      }
      
      console.log('✅ Invoice numbers initialized for all stores');
    } catch (error) {
      console.error('❌ Error initializing invoice numbers:', error);
      throw error;
    }
  }

  /**
   * Update store cache after successful transaction
   */
  private updateStoreCache(storeId: string, newInvoiceNo: string): void {
    try {
      // Update the store service cache
      const store = this.storeService.getStore(storeId);
      if (store) {
        store.invoiceNo = newInvoiceNo;
        console.log(`🧾 Updated store cache for ${store.storeName}: ${newInvoiceNo}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not update store cache:', error);
    }
  }

  /**
   * Validate invoice number format
   */
  validateInvoiceNumberFormat(invoiceNo: string): boolean {
    const invoiceRegex = /^INV-\d{4}-\d{6}$/;
    return invoiceRegex.test(invoiceNo);
  }

  /**
   * Debug method to check current invoice status
   */
  async debugInvoiceStatus(storeId: string): Promise<any> {
    try {
      const store = this.storeService.getStore(storeId);
      const nextInvoice = await this.getNextInvoiceNumberPreview(storeId);
      
      return {
        storeId,
        storeName: store?.storeName || 'Unknown',
        currentInvoiceNo: store?.invoiceNo || 'Not set',
        nextInvoiceNo: nextInvoice,
        isValidFormat: store?.invoiceNo ? this.validateInvoiceNumberFormat(store.invoiceNo) : false
      };
    } catch (error) {
      return {
        storeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create batches of order items to avoid Firestore 1MB document limit
   * Each batch will contain maximum specified items (default 50)
   */
  private createOrderDetailsBatches(items: any[], maxItemsPerBatch: number = 50): Array<{ batchNumber: number; items: any[] }> {
    const batches = [];
    
    for (let i = 0; i < items.length; i += maxItemsPerBatch) {
      const batchNumber = Math.floor(i / maxItemsPerBatch) + 1;
      const batchItems = items.slice(i, i + maxItemsPerBatch);
      
      batches.push({
        batchNumber: batchNumber,
        items: batchItems
      });
    }
    
    console.log(`🔢 Created ${batches.length} batches from ${items.length} items (max ${maxItemsPerBatch} per batch)`);
    return batches;
  }
}