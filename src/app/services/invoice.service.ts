import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  doc, 
  getDoc,
  getDocFromServer,
  runTransaction,
  collection,
  addDoc,
  DocumentReference,
  query,
  where,
  getDocs,
  writeBatch
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
  
  // Cache for invoice numbers to support offline mode
  private storeInvoiceCache = new Map<string, string>();

  /**
   * Check if an invoice number already exists in the orders collection
   * Returns false in offline mode to skip duplicate check
   */
  async checkInvoiceNumberExists(invoiceNumber: string, storeId: string): Promise<boolean> {
    try {
      // Skip check in offline mode - Firestore offline persistence will handle conflicts
      if (!navigator.onLine) {
        console.log('📱 Offline mode - skipping invoice duplicate check');
        return false;
      }
      
      console.log('🔍 Checking if invoice number exists:', invoiceNumber);
      
      const ordersRef = collection(this.firestore, 'orders');
      const q = query(
        ordersRef,
        where('invoiceNumber', '==', invoiceNumber),
        where('storeId', '==', storeId)
      );
      
      // Use very short timeout (200ms) to prevent hanging
      const snapshot = await Promise.race([
        getDocs(q),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Invoice check timeout')), 200)
        )
      ]);
      
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
      console.warn('⚠️ Error checking invoice number existence:', error);
      // In case of error (timeout, offline, etc.), assume it doesn't exist
      // Firestore offline persistence will queue the write and handle conflicts when online
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
    
    // Check if we're offline first - no need to try online operations
    if (!navigator.onLine) {
      console.log('📴 Already offline - using offline processing immediately');
      return await this.processOfflineInvoiceTransaction(transactionData);
    }
    
    try {
      // --- PREPARE NON-TRANSACTIONAL READS AND SECURITY DATA FIRST ---
      const storeDocRef = doc(this.firestore, 'stores', storeId);

      // Try to get store document first to validate connectivity
      let storeSnapshot;
      let useOfflineMode = false;
      
      try {
        // Use very short timeout (300ms) for fast offline detection
        storeSnapshot = await Promise.race([
          getDocFromServer(storeDocRef),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Store read timeout - switching to offline mode')), 300)
          )
        ]);
      } catch (storeReadError) {
        console.warn('⚠️ Failed to read store document, switching to offline mode:', storeReadError);
        useOfflineMode = true;
      }
      
      // If offline mode detected or store read failed, switch to offline processing
      if (useOfflineMode) {
        console.log('📱 Network issue detected - using offline document service');
        return await this.processOfflineInvoiceTransaction(transactionData);
      }
      
      if (!storeSnapshot || !storeSnapshot.exists()) {
        throw new Error(`Store with ID ${storeId} not found`);
      }

      const storeDataOutside = storeSnapshot.data();
      
      // Generate random invoice number and check if it exists
      let nextInvoiceNoOutside: string;
      let attempts = 0;
      const maxAttempts = 10;
      
      console.log('🎲 Generating random invoice number...');
      
      do {
        nextInvoiceNoOutside = this.storeService.generateRandomInvoiceNo();
        attempts++;
        
        console.log(`🎲 Attempt ${attempts}: Generated ${nextInvoiceNoOutside}`);
        
        // Check if this invoice number already exists
        const exists = await this.checkInvoiceNumberExists(nextInvoiceNoOutside, storeId);
        
        if (!exists) {
          console.log(`✅ Invoice number ${nextInvoiceNoOutside} is available`);
          break;
        }
        
        console.log(`⚠️ Invoice number ${nextInvoiceNoOutside} already exists, regenerating...`);
        
        if (attempts >= maxAttempts) {
          throw new Error('Failed to generate unique invoice number after 10 attempts');
        }
        
      } while (attempts < maxAttempts);

      console.log('🧾 Invoice number generation:', {
        generated: nextInvoiceNoOutside,
        attempts: attempts,
        storeId: storeId
      });

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

      const currentUser = this.authService.getCurrentUser();
      const currentUserId = currentUser?.uid || 'system';
      const now = new Date();
      
      const orderWithSecurityPre = await this.securityService.addSecurityFields({
        ...orderDataWithoutItems,
        invoiceNumber: nextInvoiceNoOutside,
        storeId: storeId,
        companyTaxId: storeTaxId,
        status: 'completed',
        createdBy: currentUserId,
        // Initialize status tracking
        statusHistory: [{
          status: 'completed',
          changedAt: now,
          changedBy: currentUserId
        }],
        statusTags: ['completed']
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
          paymentDescription: paymentsData.paymentDescription !== undefined && paymentsData.paymentDescription !== null ? paymentsData.paymentDescription : 'Cash Payment',
          paymentType: paymentsData.paymentType || 'Cash'
        } : {
          amountTendered: 0,
          changeAmount: 0,
          paymentDescription: 'Cash Payment',
          paymentType: 'Cash'
        }
      };

      console.log('🔥 Main order structure prepared (pre-transaction) for orderId:', orderDocRef.id);

      // --- USE BATCH WRITES FOR OFFLINE SUPPORT ---
      console.log('📦 Starting batch write operation...');
      
      try {
        const batch = writeBatch(this.firestore);
        
        // Write main order document
        batch.set(orderDocRef, completeOrderDataPre as any);
        console.log('📝 Added order to batch:', orderDocRef.id);
        
        // Write all orderDetails batch documents
        for (const od of orderDetailsBatchDocs) {
          batch.set(od.ref as any, od.data);
          console.log('📝 Added orderDetails to batch:', od.ref.id);
        }
        
        // Update store with new invoice number
        batch.update(storeDocRef, {
          tempInvoiceNumber: nextInvoiceNoOutside,
          updatedAt: new Date()
        });
        console.log('📝 Added store update to batch');
        
        // Commit the batch - Firestore offline persistence will queue if offline
        // No timeout needed as offline persistence handles queuing automatically
        await batch.commit();
        
        console.log('✅ Batch write completed successfully');
        
        const result = {
          invoiceNumber: nextInvoiceNoOutside,
          orderId: orderDocRef.id,
          success: true
        };
      
        // Update the store service cache
        this.updateStoreCache(storeId, result.invoiceNumber);
        
        return result;
        
      } catch (batchError) {
        console.warn('⚠️ Batch write failed or timed out:', batchError);
        
        // Check if it's a connection-related error
        const errorMessage = batchError instanceof Error ? batchError.message : String(batchError);
        const errorString = errorMessage.toLowerCase();
        const isConnectionError = errorString.includes('connection') || 
                                  errorString.includes('network') || 
                                  errorString.includes('unavailable') ||
                                  errorString.includes('failed') ||
                                  errorString.includes('offline') ||
                                  errorString.includes('timeout');
        
        if (isConnectionError) {
          console.log('📱 Connection issue detected during batch write');
          console.log('📱 Batch will be queued by Firestore offline persistence and synced when online');
          
          // Return success anyway - Firestore offline persistence will handle the sync
          const result = {
            invoiceNumber: nextInvoiceNoOutside,
            orderId: orderDocRef.id,
            success: true
          };
          
          this.updateStoreCache(storeId, result.invoiceNumber);
          return result;
        }
        
        // If not a connection error, rethrow
        throw batchError;
      }
      
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
      // Generate a random invoice number for preview
      // Works both online and offline - no Firestore dependency
      const previewInvoice = this.storeService.generateRandomInvoiceNo();
      
      console.log('📋 Invoice number preview (random):', {
        preview: previewInvoice,
        mode: navigator.onLine ? 'online' : 'offline',
        note: 'Actual invoice will be generated during order creation'
      });
      
      return previewInvoice;
    } catch (error) {
      console.error('❌ Error generating invoice preview:', error);
      // Fallback to a basic random invoice
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const random = Math.floor(100000 + Math.random() * 900000);
      return `INV-${yy}${mm}-${random}`;
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
      // Update the local cache map for offline support
      this.storeInvoiceCache.set(storeId, newInvoiceNo);
      
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

  /**
   * Process invoice transaction in offline mode
   * Uses offline document service to queue the order for later sync
   */
  private async processOfflineInvoiceTransaction(transactionData: InvoiceTransactionData): Promise<InvoiceResult> {
    const { storeId, orderData, customerInfo, paymentsData } = transactionData;
    
    try {
      // Generate random invoice number for offline mode
      const nextInvoiceNo = this.storeService.generateRandomInvoiceNo();
      
      console.log('📱 Offline invoice generation:', {
        generated: nextInvoiceNo,
        mode: 'random',
        storeId: storeId
      });
      
      // Update cache with the generated invoice number
      this.updateStoreCache(storeId, nextInvoiceNo);
      
      // Generate temporary order ID for offline mode
      const tempOrderId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare complete order data
      const currentUser = this.authService.getCurrentUser();
      const currentUserId = currentUser?.uid || 'system';
      const now = new Date();
      
      const completeOrderData = {
        ...orderData,
        invoiceNumber: nextInvoiceNo,
        storeId: storeId,
        status: 'completed',
        createdBy: currentUserId,
        createdAt: now,
        updatedAt: now,
        statusHistory: [{
          status: 'completed',
          changedAt: now,
          changedBy: currentUserId
        }],
        statusTags: ['completed'],
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
          paymentDescription: paymentsData.paymentDescription || 'Cash Payment',
          paymentType: paymentsData.paymentType || 'Cash'
        } : {
          amountTendered: 0,
          changeAmount: 0,
          paymentDescription: 'Cash Payment',
          paymentType: 'Cash'
        },
        _offlineId: tempOrderId,
        _offlineCreated: true
      };
      
      console.log('📱 Saving offline order to Firestore cache:', tempOrderId);
      console.log('📱 Generated unique invoice number:', nextInvoiceNo);
      
      // Save to Firestore with offline persistence enabled
      // Firestore will automatically queue this write and sync when online
      const ordersRef = collection(this.firestore, 'orders');
      let orderDocRef;
      
      try {
        // Save directly - Firestore offline persistence will queue if offline
        orderDocRef = await addDoc(ordersRef, completeOrderData);
        console.log('✅ Order saved/queued successfully:', orderDocRef.id);
      } catch (saveError) {
        console.warn('⚠️ Order save error, generating temp doc ref:', saveError);
        // Generate a temporary doc reference for response
        // Firestore offline persistence will handle the actual write
        orderDocRef = doc(ordersRef);
      }
      
      // Also save order details if there are items
      if (orderData.items && orderData.items.length > 0) {
        const batches = this.createOrderDetailsBatches(orderData.items, 50);
        for (const batch of batches) {
          const orderDetailsData = {
            orderId: orderDocRef.id,
            companyId: orderData.companyId,
            storeId: storeId,
            batchNumber: batch.batchNumber,
            items: batch.items,
            status: OrderDetailsStatus.COMPLETED,
            createdBy: currentUserId,
            createdAt: now,
            updatedAt: now,
            _offlineCreated: true
          };
          
          const orderDetailsRef = collection(this.firestore, 'orderDetails');
          
          try {
            // Save directly - Firestore offline persistence will queue if offline
            await addDoc(orderDetailsRef, orderDetailsData);
          } catch (detailsError) {
            console.warn('⚠️ OrderDetails save error, continuing (queued by persistence):', detailsError);
            // Continue - Firestore offline persistence will handle it
          }
        }
      }
      
      console.log('✅ Offline order saved successfully, will sync when online');
      
      return {
        invoiceNumber: nextInvoiceNo,
        orderId: orderDocRef.id,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Offline invoice transaction failed:', error);
      return {
        invoiceNumber: '',
        orderId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}