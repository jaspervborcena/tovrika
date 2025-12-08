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
import { OrderDetailsStatus } from '../interfaces/order-details.interface';

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
      // --- PREPARE NON-TRANSACTIONAL READS AND SECURITY DATA FIRST ---
      const storeDocRef = doc(this.firestore, 'stores', storeId);

      // Read store outside the transaction to compute the next invoice number and check duplicates
      const storeSnapshot = await getDoc(storeDocRef);
      if (!storeSnapshot.exists()) {
        throw new Error(`Store with ID ${storeId} not found`);
      }

      const storeDataOutside = storeSnapshot.data();
      const currentInvoiceNoOutside = storeDataOutside['tempInvoiceNumber'] || this.storeService.generateDefaultInvoiceNo();
      const nextInvoiceNoOutside = this.storeService.generateNextInvoiceNo(currentInvoiceNoOutside);

      console.log('🧾 Current invoice number (pre-read):', currentInvoiceNoOutside);
      console.log('🧾 Next invoice number (pre-read):', nextInvoiceNoOutside);

      // Check duplicates BEFORE opening the transaction (non-transactional read)
      const isDuplicateOutside = await this.checkInvoiceNumberExists(nextInvoiceNoOutside, storeId);
      if (isDuplicateOutside) {
        const errorMessage = `Duplicate invoice number detected: ${nextInvoiceNoOutside}. This order may have already been processed.`;
        console.error('🚨 DUPLICATE PREVENTION:', errorMessage);
        throw new Error(errorMessage);
      }

      // Prepare order and orderDetails doc refs and security-enriched payloads BEFORE transaction
      const ordersRef = collection(this.firestore, 'orders');
      const orderDocRef = doc(ordersRef); // Generate new doc reference (id available)

      const orderDetailsBatchDocs: Array<{ ref: DocumentReference; data: any }> = [];
      if (orderData.items && orderData.items.length > 0) {
        const batches = this.createOrderDetailsBatches(orderData.items, 50);
        console.log(`📦 Preparing ${batches.length} orderDetails batch(es) (pre-transaction)`);
        for (const batch of batches) {
          const orderDetailsRef = collection(this.firestore, 'orderDetails');
          const orderDetailsDocRef = doc(orderDetailsRef);

          const orderDetailsWithSecurity = await this.securityService.addSecurityFields({
            orderId: orderDocRef.id,
            companyId: orderData.companyId,
            storeId: storeId,
            batchNumber: batch.batchNumber,
            items: batch.items,
            // Ensure orderDetails created for a completed order are marked as COMPLETED
            status: OrderDetailsStatus.COMPLETED
          });

          orderDetailsBatchDocs.push({ ref: orderDetailsDocRef as DocumentReference, data: orderDetailsWithSecurity });
          console.log(`📦 Prepared batch ${batch.batchNumber} (docId: ${orderDetailsDocRef.id}) with ${batch.items.length} items`);
        }
      }

      // Prepare main order payload (without items) with security fields
      const { items, ...orderDataWithoutItems } = orderData;
      // Ensure companyTaxId is sourced from the store's tax id (tinNumber) when available
      const storeTaxId = storeDataOutside?.['tinNumber'] || storeDataOutside?.['taxId'] || orderDataWithoutItems?.companyTaxId || '';

      const orderWithSecurityPre = await this.securityService.addSecurityFields({
        ...orderDataWithoutItems,
        invoiceNumber: nextInvoiceNoOutside,
        storeId: storeId,
        companyTaxId: storeTaxId,
        status: 'completed',
        createdBy: this.authService.getCurrentUser()?.uid || 'system'
      });

      const completeOrderDataPre = {
        ...orderWithSecurityPre,
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

      console.log('🔥 Main order structure prepared (pre-transaction) for orderId:', orderDocRef.id);

      // --- RUN TRANSACTION: READS FIRST, THEN WRITES ---
      const result = await runTransaction(this.firestore, async (transaction) => {
        // 1. Read store inside transaction
        const storeDoc = await transaction.get(storeDocRef);
        if (!storeDoc.exists()) {
          throw new Error(`Store with ID ${storeId} not found (transaction)`);
        }

        // 2. Read all product docs required for validation BEFORE performing any writes
        const productReadSnapshots: Array<{ item: any; ref: any; snap: any }> = [];
        if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
          for (const item of orderData.items) {
            const productId = item.productId;
            const qty = Number(item.quantity || 0);
            if (!productId || qty <= 0) continue;

            const productRef = doc(this.firestore, 'products', productId);
            const productSnap = await transaction.get(productRef);
            productReadSnapshots.push({ item, ref: productRef, snap: productSnap });
          }
        }

        // All reads are complete at this point. Now perform writes.

        // Update store with new invoice number
        transaction.update(storeDocRef, {
          tempInvoiceNumber: nextInvoiceNoOutside,
          updatedAt: new Date()
        });

        // Persist orderDetails batch documents
        for (const od of orderDetailsBatchDocs) {
          transaction.set(od.ref as any, od.data);
        }

         // Validate product existence and availability only.
         // NOTE: Do NOT mutate `products.totalStock` here — inventory writes
         // (batch deductions and summary recompute) are handled by the
         // dedicated FIFO/inventory flows so we avoid double-deduction.
        for (const prs of productReadSnapshots) {
          const item = prs.item;
          const productSnap = prs.snap;
          const productRef = prs.ref;

          if (!productSnap.exists()) {
            throw new Error(`Product ${item.productId} not found while deducting stock (transaction)`);
          }

          const prodData: any = productSnap.data();

          // Validate store/company match if present
          if (prodData.storeId && prodData.storeId !== storeId) {
            throw new Error(`Product ${item.productId} belongs to store ${prodData.storeId} which does not match order store ${storeId}`);
          }
          if (orderData.companyId && prodData.companyId && prodData.companyId !== orderData.companyId) {
            throw new Error(`Product ${item.productId} company ${prodData.companyId} does not match order company ${orderData.companyId}`);
          }

          const currentTotal = Number(prodData.totalStock || 0);
          const qty = Number(item.quantity || 0);
          if (currentTotal < qty) {
            throw new Error(`Insufficient stock for product ${item.productId}. Available: ${currentTotal}, Requested: ${qty}`);
          }



            console.log(`✅ Product ${item.productId} validated for availability: ${currentTotal} available, ${qty} requested`);
        }

        // Finally, write main order document
        transaction.set(orderDocRef, completeOrderDataPre as any);

        console.log('🧾 Transaction prepared and committed (reads before writes)');

        return {
          invoiceNumber: nextInvoiceNoOutside,
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
      const currentInvoiceNo = storeData['tempInvoiceNumber'] || this.storeService.generateDefaultInvoiceNo();
      
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
        if (!store.tempInvoiceNumber && store.id) {
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
        store.tempInvoiceNumber = newInvoiceNo;
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
        currentInvoiceNo: store?.tempInvoiceNumber || 'Not set',
        nextInvoiceNo: nextInvoice,
        isValidFormat: store?.tempInvoiceNumber ? this.validateInvoiceNumberFormat(store.tempInvoiceNumber) : false
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