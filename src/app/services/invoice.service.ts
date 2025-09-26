import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  doc, 
  getDoc, 
  runTransaction,
  collection,
  addDoc,
  DocumentReference
} from '@angular/fire/firestore';
import { StoreService } from './store.service';
import { AuthService } from './auth.service';

export interface InvoiceTransactionData {
  storeId: string;
  orderData: any; // The complete order data to be saved
  customerInfo?: any;
  receiptData?: any;
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

  /**
   * Generate and assign invoice number with atomic transaction
   * This ensures that invoice numbers are never duplicated
   */
  async processInvoiceTransaction(transactionData: InvoiceTransactionData): Promise<InvoiceResult> {
    const { storeId, orderData, customerInfo, receiptData } = transactionData;
    
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
        
        // 3. Update store with new invoice number
        transaction.update(storeDocRef, { 
          invoiceNo: nextInvoiceNo,
          updatedAt: new Date()
        });
        
        // 4. Create order with the assigned invoice number
        const ordersRef = collection(this.firestore, 'orders');
        const orderDocRef = doc(ordersRef); // Generate new doc reference
        
        const completeOrderData = {
          ...orderData,
          invoiceNumber: nextInvoiceNo, // Assign the generated invoice number
          storeId: storeId,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'completed',
          customerInfo: customerInfo || null,
          receiptData: receiptData || null,
          createdBy: this.authService.getCurrentUser()?.uid || 'system'
        };
        
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
}