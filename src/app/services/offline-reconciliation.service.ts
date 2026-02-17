import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, getDoc, Timestamp, orderBy, limit, addDoc } from '@angular/fire/firestore';
import { 
  ReconciliationDiscrepancy, 
  ReconciliationAction, 
  ReconciliationAuditLog, 
  ReconciliationValidation,
  ReconciliationSummary 
} from '../interfaces/reconciliation.interface';
import { OrderDetails } from '../interfaces/order-details.interface';
import { AuthService } from './auth.service';
import { StoreService } from './store.service';
import { LedgerService } from './ledger.service';
import { NetworkService } from './network.service';
import { OrdersSellingTrackingService } from './orders-selling-tracking.service';
import { CartItem } from '../interfaces/cart.interface';

@Injectable({
  providedIn: 'root'
})
export class OfflineReconciliationService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private storeService = inject(StoreService);
  private ledgerService = inject(LedgerService);
  private networkService = inject(NetworkService);
  private ordersSellingTrackingService = inject(OrdersSellingTrackingService);

  /**
   * Find all orders with discrepancies between ordersSellingTracking and orderAccountingLedger
   */
  async findDiscrepancies(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ReconciliationDiscrepancy[]> {
    try {
      console.log('🔍 Finding discrepancies for store:', storeId, 'from', startDate, 'to', endDate);

      // Get store name
      const store = await this.storeService.getStore(storeId);
      const storeName = store?.storeName || 'Unknown Store';

      // Query ordersSellingTracking as primary source (has invoiceNumber and product details)
      // Note: Can't filter by isStockTracked in query yet (new field, needs composite index)
      // Will filter by checking products individually
      const trackingQuery = query(
        collection(this.firestore, 'ordersSellingTracking'),
        where('storeId', '==', storeId),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );

      const trackingSnap = await getDocs(trackingQuery);
      console.log(`📦 Found ${trackingSnap.docs.length} tracking entries in date range`);

      const getDateKey = (dateVal: any): string => {
        const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
        return d.toISOString().split('T')[0];
      };

      // Daily totals for comparison (completed status only)
      const trackingTotalsByDate = new Map<string, { amount: number; quantity: number }>();

      // Build daily tracking totals first (processing/completed status for offline)
      for (const trackingDoc of trackingSnap.docs) {
        const trackingData = trackingDoc.data() as any;
        const status = String(trackingData.status || '').toLowerCase();
        if (status !== 'completed' && status !== 'processing') continue;

        const dateKey = getDateKey(trackingData.createdAt || trackingData.updatedAt || new Date());
        const prev = trackingTotalsByDate.get(dateKey) || { amount: 0, quantity: 0 };
        trackingTotalsByDate.set(dateKey, {
          amount: prev.amount + Number(trackingData.total || 0),
          quantity: prev.quantity + Number(trackingData.quantity || 0)
        });
      }

      // Daily ledger totals for comparison (completed eventType)
      const ledgerTotalsByDate = new Map<string, { amount: number; quantity: number }>();
      const ledgerQuery = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('storeId', '==', storeId),
        where('eventType', '==', 'completed')
      );

      const ledgerSnap = await getDocs(ledgerQuery);
      for (const ledgerDoc of ledgerSnap.docs) {
        const ledgerData = ledgerDoc.data() as any;
        const createdAt = ledgerData.createdAt?.toDate ? ledgerData.createdAt.toDate() : new Date(ledgerData.createdAt || new Date());
        if (createdAt < startDate || createdAt > endDate) continue;
        const dateKey = getDateKey(createdAt);
        const prev = ledgerTotalsByDate.get(dateKey) || { amount: 0, quantity: 0 };
        ledgerTotalsByDate.set(dateKey, {
          amount: prev.amount + Number(ledgerData.amount || 0),
          quantity: prev.quantity + Number(ledgerData.quantity || 0)
        });
      }

      // Group by orderId and invoiceNumber
      const orderMap = new Map<string, {
        orderId: string;
        invoiceNumber: string;
        orderDate: Date;
        cashierName: string;
        trackingAmount: number;
        trackingQuantity: number;
        trackingItemCount: number;
        products: Set<string>;
        isOffline: boolean;
      }>();

      for (const trackingDoc of trackingSnap.docs) {
        const trackingData = trackingDoc.data() as any;
        const orderId = trackingData.orderId;
        const productId = trackingData.productId;

        // Only include orders captured offline
        const isOfflineCapture = trackingData._offlineCreated ?? trackingData.isOffline ?? false;
        if (!isOfflineCapture) continue;

        // Check if product should be tracked
        // First try using the denormalized isStockTracked field (for new entries)
        let isStockTracked = trackingData.isStockTracked;
        
        // If field doesn't exist (old entries), check the product document
        if (isStockTracked === undefined) {
          try {
            const productRef = doc(this.firestore, 'products', productId);
            const productSnap = await getDoc(productRef);
            
            if (!productSnap.exists()) continue;
            
            const productData = productSnap.data() as any;
            isStockTracked = productData.isStockTracked ?? false;
          } catch (err) {
            console.warn(`Could not fetch product ${productId}:`, err);
            continue;
          }
        }
        
        // Only process products that are stock tracked
        if (!isStockTracked) continue;

        if (!orderMap.has(orderId)) {
          // Get invoice number from orders collection for accuracy
          let invoiceNumber = trackingData.invoiceNumber;
          
          if (!invoiceNumber || invoiceNumber === orderId) {
            try {
              const orderRef = doc(this.firestore, 'orders', orderId);
              const orderSnap = await getDoc(orderRef);
              if (orderSnap.exists()) {
                invoiceNumber = orderSnap.data()['invoiceNumber'] || orderId;
              } else {
                invoiceNumber = orderId;
              }
            } catch (err) {
              console.warn(`Could not fetch order ${orderId}:`, err);
              invoiceNumber = orderId;
            }
          }

          orderMap.set(orderId, {
            orderId,
            invoiceNumber,
            orderDate: trackingData.createdAt?.toDate ? trackingData.createdAt.toDate() : new Date(trackingData.createdAt),
            cashierName: trackingData.cashierName || trackingData.userName || 'Unknown',
            trackingAmount: 0,
            trackingQuantity: 0,
            trackingItemCount: 0,
            products: new Set(),
            isOffline: isOfflineCapture
          });
        }

        const order = orderMap.get(orderId)!;
        order.trackingAmount += Number(trackingData.total || 0);
        order.trackingQuantity += Number(trackingData.quantity || 0);
        order.trackingItemCount++;
        order.products.add(productId);
      }

      const discrepancies: ReconciliationDiscrepancy[] = [];

      for (const [orderId, orderData] of orderMap.entries()) {
        const invoiceNumber = orderData.invoiceNumber;
        const orderDateKey = getDateKey(orderData.orderDate);
        const dailyTracking = trackingTotalsByDate.get(orderDateKey) || { amount: 0, quantity: 0 };
        const dailyLedger = ledgerTotalsByDate.get(orderDateKey) || { amount: 0, quantity: 0 };
        const ledgerExists = ledgerTotalsByDate.has(orderDateKey);

        // Check if inventoryTracking entries exist (FIFO processed)
        // inventoryTracking records the actual deductions made during FIFO processing
        let inventoryProcessed = true;
        let fifoSkipped = false;
        
        for (const productId of orderData.products) {
          const inventoryTrackingQuery = query(
            collection(this.firestore, 'inventoryTracking'),
            where('productId', '==', productId),
            where('orderId', '==', orderId),
            limit(5)
          );
          const inventoryTrackingSnap = await getDocs(inventoryTrackingQuery);

          const hasProcessedTracking = !inventoryTrackingSnap.empty && inventoryTrackingSnap.docs.some(docSnap => {
            const data = docSnap.data() as any;
            return !data._offlinePendingFifo;
          });

          if (!hasProcessedTracking) {
            inventoryProcessed = false;
            fifoSkipped = true;
            break;
          }
        }

        const trackingAmount = dailyTracking.amount;
        const trackingQuantity = dailyTracking.quantity;
        const trackingExists = true; // We already have tracking data

        const ledgerAmount: number | undefined = ledgerExists ? dailyLedger.amount : undefined;
        const ledgerQuantity: number | undefined = ledgerExists ? dailyLedger.quantity : undefined;

        // Calculate discrepancies
        const amountDiscrepancy = trackingAmount - (ledgerAmount || 0);
        const quantityDiscrepancy = trackingQuantity - (ledgerQuantity || 0);
        const isOfflineOrder = orderData.isOffline;

        // Determine if needs reconciliation
        const needsInventoryReprocess = !inventoryProcessed || fifoSkipped;
        const needsLedgerCreation = !ledgerExists;
        const hasDiscrepancy = Math.abs(amountDiscrepancy) > 0.01 || Math.abs(quantityDiscrepancy) > 0;

        // Only include if there are issues
        if (needsInventoryReprocess || needsLedgerCreation || hasDiscrepancy) {
          // Determine severity
          let severity: 'critical' | 'warning' | 'info' = 'info';
          let priority = 3;

          if (!ledgerExists && !inventoryProcessed) {
            severity = 'critical';
            priority = 1;
          } else if (!ledgerExists || !inventoryProcessed) {
            severity = 'warning';
            priority = 2;
          } else if (hasDiscrepancy) {
            severity = 'warning';
            priority = 2;
          }

          // Build reconciliation actions
          const actions: ReconciliationAction[] = [];

          if (needsInventoryReprocess) {
            actions.push({
              type: 'reprocess_inventory',
              description: 'Reprocess FIFO inventory deduction for this order',
              canAutomate: true,
              riskLevel: 'medium',
              estimatedDuration: '30 seconds'
            });
          }

          if (needsLedgerCreation) {
            actions.push({
              type: 'create_ledger',
              description: 'Create missing accounting ledger entry',
              canAutomate: true,
              riskLevel: 'low',
              estimatedDuration: '5 seconds'
            });
          }

          if (hasDiscrepancy && ledgerExists && inventoryProcessed) {
            actions.push({
              type: 'review_manual',
              description: 'Manual review required for amount/quantity mismatch',
              canAutomate: false,
              riskLevel: 'high',
              estimatedDuration: '5-10 minutes'
            });
          }

          actions.push({
            type: 'mark_reconciled',
            description: 'Mark order as reconciled after fixing issues',
            canAutomate: true,
            riskLevel: 'low',
            estimatedDuration: '1 second'
          });

          discrepancies.push({
            invoiceNumber,
            orderId,
            storeId,
            storeName,
            orderDate: orderData.orderDate,
            trackingAmount,
            trackingQuantity,
            trackingItemCount: orderData.trackingItemCount,
            trackingExists,
            ledgerAmount,
            ledgerQuantity,
            ledgerExists,
            inventoryProcessed,
            fifoSkipped,
            amountDiscrepancy,
            quantityDiscrepancy,
            isOfflineOrder,
            needsInventoryReprocess,
            needsLedgerCreation,
            severity,
            priority,
            reconciliationActions: actions,
            orderDetails: undefined,
            cashierName: orderData.cashierName
          });
        }
      }

      // Sort by priority (highest first), then by date (newest first)
      discrepancies.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.orderDate.getTime() - a.orderDate.getTime();
      });

      console.log(`✅ Found ${discrepancies.length} orders with discrepancies`);
      return discrepancies;

    } catch (error) {
      console.error('❌ Error finding discrepancies:', error);
      throw error;
    }
  }

  /**
   * Get summary statistics for reconciliation
   */
  async getReconciliationSummary(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ReconciliationSummary> {
    const discrepancies = await this.findDiscrepancies(storeId, startDate, endDate);

    return {
      totalOrders: discrepancies.length,
      ordersWithDiscrepancies: discrepancies.length,
      criticalIssues: discrepancies.filter(d => d.severity === 'critical').length,
      warningIssues: discrepancies.filter(d => d.severity === 'warning').length,
      totalAmountDiscrepancy: discrepancies.reduce((sum, d) => sum + Math.abs(d.amountDiscrepancy), 0),
      totalQuantityDiscrepancy: discrepancies.reduce((sum, d) => sum + Math.abs(d.quantityDiscrepancy), 0),
      offlineOrders: discrepancies.filter(d => d.isOfflineOrder).length,
      unreconciledOrders: discrepancies.filter(d => d.needsInventoryReprocess || d.needsLedgerCreation).length
    };
  }

  /**
   * Validate if order can be reprocessed
   */
  async validateReprocessing(orderId: string): Promise<ReconciliationValidation> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Get order details
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', orderId),
        limit(1)
      );

      const orderDetailsSnap = await getDocs(orderDetailsQuery);
      if (orderDetailsSnap.empty) {
        errors.push('Order details not found in orderDetails collection');
        return { canProcess: false, warnings, errors };
      }

      const orderDetails = orderDetailsSnap.docs[0].data() as OrderDetails;

      // Check if already processed
      if (orderDetails.inventoryProcessed) {
        warnings.push('Inventory already processed - reprocessing will deduct stock again');
      }

      // Check if order was captured offline
      const trackingQuery = query(
        collection(this.firestore, 'ordersSellingTracking'),
        where('orderId', '==', orderId),
        limit(1)
      );
      const trackingSnap = await getDocs(trackingQuery);
      
      if (!trackingSnap.empty) {
        const trackingData = trackingSnap.docs[0].data() as any;
        if (trackingData.isOffline) {
          warnings.push('Order was captured offline - verify data before reprocessing');
        }
      }

      // Check stock availability and product tracking for each item
      const currentStock: { [key: string]: number } = {};
      const requiredStock: { [key: string]: number } = {};
      let hasUntrackedProducts = false;
      let hasNoInventoryProducts = false;
      let hasTrackedProductsWithInventory = false;

      for (const item of orderDetails.items || []) {
        const productRef = doc(this.firestore, 'products', item.productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const productData = productSnap.data() as any;
          
          // Check if product is tracked
          if (!productData.isStockTracked) {
            hasUntrackedProducts = true;
            warnings.push(`${item.productName} is not stock tracked - will be skipped`);
            continue;
          }

          // Check if product has inventory
          const inventoryQuery = query(
            collection(this.firestore, 'productInventory'),
            where('productId', '==', item.productId),
            where('storeId', '==', orderDetails.storeId)
          );
          const inventorySnap = await getDocs(inventoryQuery);
          
          if (inventorySnap.empty) {
            hasNoInventoryProducts = true;
            errors.push(`${item.productName} has no inventory batches - cannot process FIFO`);
            continue;
          }

          // Product is tracked and has inventory
          hasTrackedProductsWithInventory = true;

          const available = Number(productData.totalStock || 0);
          currentStock[item.productId] = available;
          requiredStock[item.productId] = item.quantity;

          if (available < item.quantity) {
            errors.push(`Insufficient stock for ${item.productName}: need ${item.quantity}, available ${available}`);
          }
        } else {
          errors.push(`Product not found: ${item.productName}`);
        }
      }

      // Add informative messages about root causes
      if (!hasTrackedProductsWithInventory) {
        if (hasUntrackedProducts && hasNoInventoryProducts) {
          errors.push('All products are either not tracked or have no inventory batches');
        } else if (hasUntrackedProducts) {
          errors.push('All products are not stock tracked - nothing to reprocess');
        } else if (hasNoInventoryProducts) {
          errors.push('No products have inventory batches - cannot perform FIFO deduction');
        }
      } else {
        if (hasUntrackedProducts) {
          warnings.push('Some products are not tracked and will be skipped');
        }
        if (hasNoInventoryProducts) {
          warnings.push('Some products have no inventory batches and will be skipped');
        }
      }

      // Check network status AFTER checking for actual issues
      // This way users can see the real problems even if offline
      if (!this.networkService.isOnline) {
        errors.push('Network is offline - connect to network to proceed');
      }

      return {
        canProcess: errors.length === 0,
        warnings,
        errors,
        currentStock,
        requiredStock
      };

    } catch (error) {
      console.error('❌ Error validating reprocessing:', error);
      errors.push(`Validation error: ${error}`);
      return { canProcess: false, warnings, errors };
    }
  }

  /**
   * Reprocess inventory for an order using existing FIFO logic
   */
  async reprocessInventory(orderId: string): Promise<{ success: boolean; message: string; error?: any }> {
    try {
      console.log('🔄 Reprocessing inventory for order:', orderId);

      // Validate first
      const validation = await this.validateReprocessing(orderId);
      if (!validation.canProcess) {
        return {
          success: false,
          message: `Cannot reprocess: ${validation.errors.join(', ')}`,
          error: validation.errors
        };
      }

      // Get order details
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', orderId),
        limit(1)
      );

      const orderDetailsSnap = await getDocs(orderDetailsQuery);
      if (orderDetailsSnap.empty) {
        return { success: false, message: 'Order details not found' };
      }

      const orderDetails = orderDetailsSnap.docs[0].data() as OrderDetails;
      const orderDetailsDocId = orderDetailsSnap.docs[0].id;

      // Get order data for invoice number
      const orderRef = doc(this.firestore, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      const invoiceNumber = orderSnap.exists() ? (orderSnap.data() as any).invoiceNumber || orderId : orderId;

      // Convert order items to cart items format (only valid CartItem properties)
      const cartItems: CartItem[] = orderDetails.items.map(item => ({
        productId: item.productId,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.total,
        discount: item.discount || 0,
        discountType: 'fixed' as const,
        isVatExempt: item.isVatExempt,
        vatAmount: item.vat
      }));

      // Process FIFO inventory deductions for each item
      console.log('🔄 Processing FIFO deductions for', orderDetails.items.length, 'items');
      
      for (const item of orderDetails.items) {
        // Only process stock-tracked products
        const productRef = doc(this.firestore, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        
        if (!productSnap.exists()) {
          console.warn(`⚠️ Product ${item.productId} not found, skipping`);
          continue;
        }
        
        const productData = productSnap.data() as any;
        const isStockTracked = productData.isStockTracked ?? false;
        
        if (!isStockTracked) {
          console.log(`⏭️ Product ${item.productName} is not stock tracked, skipping FIFO`);
          continue;
        }
        
        console.log(`📦 Processing FIFO for ${item.productName} (qty: ${item.quantity})`);
        
        // Get active batches for this product using FIFO (oldest first)
        const batchesQuery = query(
          collection(this.firestore, 'productInventory'),
          where('productId', '==', item.productId),
          where('storeId', '==', orderDetails.storeId),
          where('companyId', '==', orderDetails.companyId),
          where('status', '==', 'active')
        );
        
        const batchesSnap = await getDocs(batchesQuery);
        const batches = batchesSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() as any }))
          .filter(b => (b.quantity || 0) > 0)
          .sort((a, b) => {
            // Sort by batchId (contains timestamp) for FIFO
            const aBatchId = String(a.batchId || '');
            const bBatchId = String(b.batchId || '');
            if (aBatchId && bBatchId) return aBatchId.localeCompare(bBatchId);
            // Fallback to receivedAt
            const aTime = a.receivedAt?.toDate?.()?.getTime() || 0;
            const bTime = b.receivedAt?.toDate?.()?.getTime() || 0;
            return aTime - bTime;
          });
        
        console.log(`📊 Found ${batches.length} active batches with stock`);
        
        if (batches.length === 0) {
          console.warn(`⚠️ No batches available for ${item.productName}`);
          continue;
        }
        
        // Deduct from batches using FIFO
        let remainingQty = item.quantity;
        const deductions: Array<{ batchId: string; refId: string; costPrice: number; deductedQty: number }> = [];
        
        for (const batch of batches) {
          if (remainingQty <= 0) break;
          
          const availableQty = batch.quantity || 0;
          const deductQty = Math.min(remainingQty, availableQty);
          const newQty = availableQty - deductQty;
          const newTotalDeducted = (batch.totalDeducted || 0) + deductQty;
          const newStatus = newQty === 0 ? 'depleted' : 'active';
          
          // Update batch in productInventory
          const batchRef = doc(this.firestore, 'productInventory', batch.id);
          await updateDoc(batchRef, {
            quantity: newQty,
            totalDeducted: newTotalDeducted,
            status: newStatus,
            updatedAt: Timestamp.now(),
            updatedBy: this.authService.getCurrentUser()?.uid || 'system'
          });
          
          deductions.push({
            batchId: batch.batchId || batch.id,
            refId: batch.id,
            costPrice: batch.costPrice || 0,
            deductedQty: deductQty
          });
          
          remainingQty -= deductQty;
          console.log(`✅ Deducted ${deductQty} from batch ${batch.batchId}, remaining: ${newQty}`);
        }
        
        // Create inventoryTracking records for each deduction
        for (const deduction of deductions) {
          await addDoc(collection(this.firestore, 'inventoryTracking'), {
            eventType: 'completed',
            companyId: orderDetails.companyId,
            storeId: orderDetails.storeId,
            orderId: orderId,
            invoiceNumber: invoiceNumber,
            productId: item.productId,
            productName: item.productName,
            productCode: '',
            skuId: item.productSku || '',
            batchId: deduction.batchId,
            refId: deduction.refId,
            costPrice: deduction.costPrice,
            quantity: deduction.deductedQty,
            deductedAt: Timestamp.now(),
            deductedBy: this.authService.getCurrentUser()?.uid || 'system',
            createdBy: this.authService.getCurrentUser()?.uid || 'system',
            createdAt: Timestamp.now(),
            note: 'Reconciliation - FIFO reprocessed'
          });
        }
        
        console.log(`✅ Created ${deductions.length} inventoryTracking entries for ${item.productName}`);
      }

      // Update flags in orderDetails
      const orderDetailsRef = doc(this.firestore, 'orderDetails', orderDetailsDocId);
      await updateDoc(orderDetailsRef, {
        inventoryProcessed: true,
        'offlineMetadata.fifoSkipped': false,
        reconciledAt: Timestamp.now(),
        reconciledBy: this.authService.getCurrentUser()?.uid || 'system'
      });

      // Log audit trail
      await this.logReconciliationAction(orderId, invoiceNumber, orderDetails.storeId, 'inventory_reprocess', {
        inventoryProcessed: false,
        ledgerProcessed: orderDetails.ledgerProcessed ?? false,
        needsReconciliation: true
      }, {
        inventoryProcessed: true,
        ledgerProcessed: orderDetails.ledgerProcessed ?? false,
        needsReconciliation: false
      }, true);

      console.log('✅ Inventory reprocessed successfully');
      return { success: true, message: 'Inventory reprocessed successfully' };

    } catch (error) {
      console.error('❌ Error reprocessing inventory:', error);
      return {
        success: false,
        message: `Failed to reprocess inventory: ${error}`,
        error
      };
    }
  }

  /**
   * Create missing ledger entry for an order
   */
  async createMissingLedger(orderId: string): Promise<{ success: boolean; message: string; error?: any }> {
    try {
      console.log('📊 Creating missing ledger entry for order:', orderId);

      // Get order details
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', orderId),
        limit(1)
      );

      const orderDetailsSnap = await getDocs(orderDetailsQuery);
      if (orderDetailsSnap.empty) {
        return { success: false, message: 'Order details not found' };
      }

      const orderDetails = orderDetailsSnap.docs[0].data() as OrderDetails;
      const orderDetailsDocId = orderDetailsSnap.docs[0].id;

      // Get order data for company info
      const orderRef = doc(this.firestore, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) {
        return { success: false, message: 'Order not found' };
      }

      const orderData = orderSnap.data() as any;

      // Calculate totals from ordersSellingTracking
      const trackingQuery = query(
        collection(this.firestore, 'ordersSellingTracking'),
        where('orderId', '==', orderId)
      );

      const trackingSnap = await getDocs(trackingQuery);
      let totalAmount = 0;
      let totalQuantity = 0;

      trackingSnap.docs.forEach(doc => {
        const data = doc.data() as any;
        totalAmount += Number(data.total || 0);
        totalQuantity += Number(data.quantity || 0);
      });

      // Create ledger entry
      await this.ledgerService.recordEvent(
        orderDetails.companyId,
        orderDetails.storeId,
        orderId,
        'completed',
        totalAmount,
        totalQuantity,
        this.authService.getCurrentUser()?.uid || 'system'
      );

      // Update flags in orderDetails
      const orderDetailsRef = doc(this.firestore, 'orderDetails', orderDetailsDocId);
      await updateDoc(orderDetailsRef, {
        ledgerProcessed: true,
        'offlineMetadata.ledgerSkipped': false,
        reconciledAt: Timestamp.now(),
        reconciledBy: this.authService.getCurrentUser()?.uid || 'system'
      });

      // Log audit trail
      await this.logReconciliationAction(orderId, orderData.invoiceNumber || orderId, orderDetails.storeId, 'ledger_create', {
        inventoryProcessed: orderDetails.inventoryProcessed ?? false,
        ledgerProcessed: false,
        needsReconciliation: true
      }, {
        inventoryProcessed: orderDetails.inventoryProcessed ?? false,
        ledgerProcessed: true,
        needsReconciliation: false
      }, true);

      console.log('✅ Ledger entry created successfully');
      return { success: true, message: 'Ledger entry created successfully' };

    } catch (error) {
      console.error('❌ Error creating ledger entry:', error);
      return {
        success: false,
        message: `Failed to create ledger entry: ${error}`,
        error
      };
    }
  }

  /**
   * Mark order as reconciled
   */
  async markAsReconciled(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', orderId),
        limit(1)
      );

      const orderDetailsSnap = await getDocs(orderDetailsQuery);
      if (orderDetailsSnap.empty) {
        return { success: false, message: 'Order details not found' };
      }

      const orderDetailsDocId = orderDetailsSnap.docs[0].id;
      const orderDetails = orderDetailsSnap.docs[0].data() as OrderDetails;

      const orderDetailsRef = doc(this.firestore, 'orderDetails', orderDetailsDocId);
      await updateDoc(orderDetailsRef, {
        needsReconciliation: false,
        reconciledAt: Timestamp.now(),
        reconciledBy: this.authService.getCurrentUser()?.uid || 'system'
      });

      // Log audit trail
      await this.logReconciliationAction(orderId, 'N/A', orderDetails.storeId, 'mark_reconciled', {
        inventoryProcessed: orderDetails.inventoryProcessed ?? false,
        ledgerProcessed: orderDetails.ledgerProcessed ?? false,
        needsReconciliation: true
      }, {
        inventoryProcessed: orderDetails.inventoryProcessed ?? false,
        ledgerProcessed: orderDetails.ledgerProcessed ?? false,
        needsReconciliation: false
      }, true);

      return { success: true, message: 'Order marked as reconciled' };
    } catch (error) {
      console.error('❌ Error marking as reconciled:', error);
      return { success: false, message: `Error: ${error}` };
    }
  }

  /**
   * Log reconciliation action to audit trail
   */
  private async logReconciliationAction(
    orderId: string,
    invoiceNumber: string,
    storeId: string,
    action: ReconciliationAuditLog['action'],
    beforeState: ReconciliationAuditLog['beforeState'],
    afterState: ReconciliationAuditLog['afterState'],
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const user = this.authService.getCurrentUser();
      const auditLog: ReconciliationAuditLog = {
        orderId,
        invoiceNumber,
        storeId,
        performedBy: user?.uid || 'system',
        performedByName: user?.displayName || user?.email || 'System',
        performedAt: new Date(),
        action,
        beforeState,
        afterState,
        success,
        error
      };

      const auditRef = collection(this.firestore, 'reconciliationAuditLog');
      await addDoc(auditRef, auditLog);
    } catch (err) {
      console.error('⚠️ Failed to log reconciliation action:', err);
    }
  }
}
