import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  getDoc,
  runTransaction,
  DocumentReference,
  Transaction
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ProductInventoryEntry } from '../interfaces/product-inventory-entry.interface';
import { Product } from '../interfaces/product.interface';

@Injectable({
  providedIn: 'root'
})
export class ProductSummaryService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  /**
   * Recomputes product totalStock and sellingPrice based on current active batches
   * Uses FIFO for stock calculation and LIFO for price calculation
   * 
   * TRANSACTION SAFE: Can be called within existing transactions
   */
  async recomputeProductSummaryInTransaction(
    transaction: Transaction,
    productId: string,
    productRef?: DocumentReference,
    // Optional: if the caller already has the up-to-date batch documents
    // (for example, read inside the same transaction), pass them here so
    // the recompute can avoid non-transactional queries.
    updatedBatches?: ProductInventoryEntry[]
  ): Promise<{ totalStock: number; sellingPrice: number; originalPrice: number }> {
    const currentUser = this.authService.getCurrentUser();
    const permission = this.authService.getCurrentPermission();
    
    if (!currentUser || !permission) {
      throw new Error('User not authenticated or no company permission');
    }

    // Use provided batches if available (transactional path), otherwise fall
    // back to querying batches (non-transactional). Prefer using
    // `updatedBatches` when calling from within a transaction.
    let activeBatches: ProductInventoryEntry[];
    if (updatedBatches && updatedBatches.length > 0) {
      // Merge provided updated batches with existing active batches so we don't
      // omit other active batches that weren't part of the caller's update.
      console.log('🔁 Merging provided batch data with existing batches for recompute...');
      const existing = await this.getActiveBatchesFIFO(productId);
      const map = new Map<string, ProductInventoryEntry>();
      for (const b of existing) {
        if (b.batchId) map.set(b.batchId, b);
      }
      for (const ub of updatedBatches) {
        if (ub.batchId) map.set(ub.batchId, ub);
      }
      activeBatches = Array.from(map.values()).filter(b => (b.quantity || 0) > 0).sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
      console.log('🔁 Active batches count after merge:', activeBatches.length);
    } else {
      // Get all active batches for this product (FIFO order)
      activeBatches = await this.getActiveBatchesFIFO(productId);
    }
    
    console.log('🔢 Product Summary Calculation for productId:', productId);
    console.log('📦 Active batches found:', activeBatches.length);
    activeBatches.forEach((batch, index) => {
      console.log(`  Batch ${index + 1}: ID=${batch.batchId}, Qty=${batch.quantity}, Price=${batch.unitPrice}, Status=${batch.status}`);
    });
    
    // Calculate totalStock (sum of all active batch quantities)
    const totalStock = activeBatches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
    console.log('📊 Calculated totalStock:', totalStock);
    
    // Calculate sellingPrice (LIFO - latest batch unitPrice) and originalPrice (base/unit price)
    let sellingPrice = 0;
    let originalPrice = 0;
    if (activeBatches.length > 0) {
      // Sort by receivedAt DESC to get latest batch (LIFO for price)
      const sortedByLatest = [...activeBatches].sort((a, b) => 
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      );

      const latest = sortedByLatest[0];
      // Prefer explicit batch.sellingPrice when available, otherwise fall back to unitPrice
      sellingPrice = (latest?.sellingPrice ?? latest?.unitPrice) || 0;

      // Determine originalPrice: prefer unitPrice if present, otherwise compute from sellingPrice using VAT/discount metadata
      if (latest?.unitPrice !== undefined && latest?.unitPrice !== null) {
        originalPrice = Number(latest.unitPrice) || 0;
      } else if (latest?.sellingPrice !== undefined && latest?.sellingPrice !== null) {
        // Compute original from selling using batch VAT/discount settings
        try {
          const isVat = !!latest.isVatApplicable;
          const vatRate = Number(latest.vatRate ?? 0) || 0;
          const hasDisc = !!latest.hasDiscount;
          const discType = latest.discountType ?? 'percentage';
          const discValue = Number(latest.discountValue ?? 0) || 0;

          // Inverse calculation similar to computeOriginalFromSelling in component
          const sell = Number(latest.sellingPrice) || 0;
          const rate = isVat ? vatRate : 0;
          const disc = discValue;
          if (!hasDisc || disc === 0) {
            const denom = (1 + rate / 100) || 1;
            originalPrice = sell / denom;
          } else if (discType === 'percentage') {
            const denom = (1 + rate / 100) * (1 - disc / 100);
            originalPrice = denom === 0 ? 0 : sell / denom;
          } else {
            const denom = (1 + rate / 100) || 1;
            originalPrice = (sell + disc) / denom;
          }
        } catch (e) {
          originalPrice = 0;
        }
      }

      console.log('💰 Calculated sellingPrice from latest batch:', sellingPrice, 'from batch:', latest?.batchId);
      console.log('🔎 Determined originalPrice for product from latest batch:', originalPrice);
    }

    // Update product document within the transaction. Use transaction.get to check existence
    const productDocRef = productRef || doc(this.firestore, 'products', productId);
    const prodSnap = await transaction.get(productDocRef);
    const payload: any = {
      totalStock,
      sellingPrice,
      originalPrice,
      lastUpdated: new Date(),
      updatedBy: currentUser.uid
    };

    if (prodSnap.exists()) {
      transaction.update(productDocRef, payload);
    } else {
      // If product document doesn't exist, create it with minimal required fields
      transaction.set(productDocRef, {
        uid: currentUser.uid,
        companyId: permission.companyId,
        storeId: permission.storeId,
        status: 'active',
        createdAt: new Date(),
        createdBy: currentUser.uid,
        ...payload
      });
    }

    return { totalStock, sellingPrice, originalPrice };
  }

  /**
   * Standalone method to recompute product summary (creates its own transaction)
   */
  async recomputeProductSummary(productId: string): Promise<{ totalStock: number; sellingPrice: number; originalPrice: number }> {
    const result = await runTransaction(this.firestore, async (transaction) => {
      return this.recomputeProductSummaryInTransaction(transaction, productId);
    });

    // Notify product service (if present) to update its local cache without forcing a full refresh.
    try {
      const cb = (window as any).onProductSummaryUpdated;
      if (typeof cb === 'function') {
        cb(productId, {
          totalStock: result.totalStock,
          sellingPrice: result.sellingPrice,
          originalPrice: result.originalPrice,
          lastUpdated: new Date()
        });
      }
    } catch (e) {
      // Non-fatal: if the callback isn't present or errors, we still return the recompute result.
      console.warn('⚠️ Failed to notify product service of recompute:', e);
    }

    return result;
  }

  /**
   * Recomputes multiple products in a single transaction
   */
  async recomputeMultipleProductSummaries(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;

    const results: Array<{ productId: string; totalStock: number; sellingPrice: number; originalPrice: number }> = [];
    await runTransaction(this.firestore, async (transaction) => {
      for (const productId of productIds) {
        const res = await this.recomputeProductSummaryInTransaction(transaction, productId);
        results.push({ productId, totalStock: res.totalStock, sellingPrice: res.sellingPrice, originalPrice: res.originalPrice });
      }
    });

    // Notify product service about each updated product to keep local cache in sync
    try {
      const cb = (window as any).onProductSummaryUpdated;
      if (typeof cb === 'function') {
        for (const r of results) {
          try {
            cb(r.productId, { totalStock: r.totalStock, sellingPrice: r.sellingPrice, originalPrice: r.originalPrice, lastUpdated: new Date() });
          } catch (e) { /* ignore per-product notification errors */ }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to notify product service of multiple recomputes:', e);
    }
  }

  /**
   * Gets active batches for a product sorted by FIFO (oldest first)
   * This method is used for internal calculations
   * Uses simplified query to avoid complex index requirements
   */
  private async getActiveBatchesFIFO(productId: string): Promise<ProductInventoryEntry[]> {
    const permission = this.authService.getCurrentPermission();
    if (!permission) {
      throw new Error('No company permission found');
    }

    console.log('🔍 Querying inventory batches for:', { 
      productId, 
      companyId: permission.companyId, 
      storeId: permission.storeId 
    });

    const inventoryRef = collection(this.firestore, 'productInventory');
    
    try {
      // Try the optimized query first (if index exists)
      const q = query(
        inventoryRef,
        where('productId', '==', productId),
        where('companyId', '==', permission.companyId),
        where('storeId', '==', permission.storeId), // Filter by storeId as requested
        where('status', '==', 'active'),
        orderBy('receivedAt', 'asc') // FIFO: oldest first
      );

      const snapshot = await getDocs(q);
      const batches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProductInventoryEntry));

      // Filter out zero quantities in memory to avoid complex index
      const filteredBatches = batches.filter(batch => (batch.quantity || 0) > 0);
      
      console.log('✅ Query successful - found batches:', batches.length, 'active with quantity > 0:', filteredBatches.length);
      
      return filteredBatches;

    } catch (indexError: any) {
      console.warn('⚠️ Firestore index not ready, using fallback query:', indexError.message);
      
      // Fallback: Simple query and filter in memory
      const simpleQuery = query(
        inventoryRef,
        where('productId', '==', productId),
        where('companyId', '==', permission.companyId)
      );

      const snapshot = await getDocs(simpleQuery);
      const allBatches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProductInventoryEntry));

      // Filter and sort in memory (including storeId filter)
      const filteredBatches = allBatches
        .filter(batch => 
          batch.status === 'active' && 
          (batch.quantity || 0) > 0 &&
          batch.storeId === permission.storeId // Filter by storeId in fallback
        )
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
        
      console.log('⚠️ Fallback query successful - found batches:', allBatches.length, 'filtered:', filteredBatches.length);
      
      return filteredBatches;
    }
  }

  /**
   * Validates that a product summary matches its batches
   * Useful for debugging and data integrity checks
   */
  async validateProductSummary(productId: string): Promise<{
    isValid: boolean;
    currentSummary: { totalStock: number; sellingPrice: number };
    calculatedSummary: { totalStock: number; sellingPrice: number };
    discrepancies: string[];
  }> {
    // Get current product data
    const productRef = doc(this.firestore, 'products', productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error(`Product ${productId} not found`);
    }

    const productData = productSnap.data() as Product;
    const currentSummary = {
      totalStock: productData.totalStock || 0,
      sellingPrice: productData.sellingPrice || 0
    };

    // Calculate what the summary should be
    const activeBatches = await this.getActiveBatchesFIFO(productId);
    const calculatedTotalStock = activeBatches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
    
    let calculatedSellingPrice = 0;
    if (activeBatches.length > 0) {
      const sortedByLatest = [...activeBatches].sort((a, b) => 
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      );
      calculatedSellingPrice = (sortedByLatest[0]?.sellingPrice ?? sortedByLatest[0]?.unitPrice) || 0;
    }

    const calculatedSummary = {
      totalStock: calculatedTotalStock,
      sellingPrice: calculatedSellingPrice
    };

    // Check for discrepancies
    const discrepancies: string[] = [];
    
    if (currentSummary.totalStock !== calculatedSummary.totalStock) {
      discrepancies.push(
        `totalStock mismatch: current=${currentSummary.totalStock}, calculated=${calculatedSummary.totalStock}`
      );
    }
    
    if (Math.abs(currentSummary.sellingPrice - calculatedSummary.sellingPrice) > 0.01) {
      discrepancies.push(
        `sellingPrice mismatch: current=${currentSummary.sellingPrice}, calculated=${calculatedSummary.sellingPrice}`
      );
    }

    return {
      isValid: discrepancies.length === 0,
      currentSummary,
      calculatedSummary,
      discrepancies
    };
  }

  /**
   * Fixes product summary discrepancies by recomputing from batches
   */
  async fixProductSummaryDiscrepancies(productId: string): Promise<void> {
    const validation = await this.validateProductSummary(productId);
    
    if (!validation.isValid) {
      console.log(`Fixing discrepancies for product ${productId}:`, validation.discrepancies);
      await this.recomputeProductSummary(productId);
      console.log(`Product ${productId} summary fixed`);
    }
  }

  /**
   * Bulk validation and fixing of all products
   * Useful for data integrity maintenance
   */
  async validateAndFixAllProducts(): Promise<{
    total: number;
    fixed: number;
    errors: string[];
  }> {
    const permission = this.authService.getCurrentPermission();
    if (!permission) {
      throw new Error('No company permission found');
    }

    // Get all products for this company
    const productsRef = collection(this.firestore, 'products');
    const q = query(
      productsRef,
      where('companyId', '==', permission.companyId)
    );

    const snapshot = await getDocs(q);
    const productIds = snapshot.docs.map(doc => doc.id);

    let fixed = 0;
    const errors: string[] = [];

    // Process in batches to avoid overwhelming Firestore
    const batchSize = 10;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (productId) => {
        try {
          const validation = await this.validateProductSummary(productId);
          if (!validation.isValid) {
            await this.recomputeProductSummary(productId);
            fixed++;
          }
        } catch (error) {
          errors.push(`Failed to fix product ${productId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }));
    }

    return {
      total: productIds.length,
      fixed,
      errors
    };
  }
}