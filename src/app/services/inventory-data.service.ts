import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, query, where, orderBy, limit, Timestamp, writeBatch, addDoc, getDoc, updateDoc, runTransaction } from '@angular/fire/firestore';
import { applyCreateTimestamps } from '../core/utils/firestore-timestamps';
import { deleteField } from 'firebase/firestore';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { ProductSummaryService } from './product-summary.service';
import { ProductInventoryEntry } from '../interfaces/product-inventory-entry.interface';

@Injectable({ providedIn: 'root' })
export class InventoryDataService {
  private readonly firestore = inject(Firestore);
  private readonly offlineDocService = inject(OfflineDocumentService);
  private readonly auth = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly productSummaryService = inject(ProductSummaryService);

  private collectionName = 'productInventory'; // Use existing productInventory collection

  // Utility to sanitize objects (remove undefined) for Firestore
  private cleanUndefined<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;
    const out: any = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach((k) => {
      const v = (obj as any)[k];
      if (v === undefined) return;
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        out[k] = this.cleanUndefined(v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  async listBatches(productId: string): Promise<ProductInventoryEntry[]> {
    const colRef = collection(this.firestore, this.collectionName);
    
    try {
      // Try the optimized query with index first
      const qRef = query(colRef, where('productId', '==', productId), orderBy('receivedAt', 'desc'));
      const snap = await getDocs(qRef);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          receivedAt: data.receivedAt?.toDate?.() || data.receivedAt,
          expiryDate: data.expiryDate?.toDate?.() || data.expiryDate,
        } as ProductInventoryEntry;
      });
    } catch (indexError: any) {
      // If index is not ready, fall back to simple query and sort in memory
      console.warn('⚠️ Index not ready, using fallback query:', indexError.message);
      
      const simpleQuery = query(colRef, where('productId', '==', productId));
      const snap = await getDocs(simpleQuery);
      const batches = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          receivedAt: data.receivedAt?.toDate?.() || data.receivedAt,
          expiryDate: data.expiryDate?.toDate?.() || data.expiryDate,
        } as ProductInventoryEntry;
      });
      
      // Sort in memory by receivedAt descending
      return batches.sort((a, b) => {
        const dateA = new Date(a.receivedAt).getTime();
        const dateB = new Date(b.receivedAt).getTime();
        return dateB - dateA; // Descending order
      });
    }
  }

  async getLatestBatch(productId: string): Promise<ProductInventoryEntry | null> {
    const colRef = collection(this.firestore, this.collectionName);
    
    try {
      // Try the optimized query with index first
      const qRef = query(colRef, where('productId', '==', productId), where('status', '==', 'active'), orderBy('receivedAt', 'desc'), limit(1));
      const snap = await getDocs(qRef);
      if (snap.empty) return null;
      const d = snap.docs[0];
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        receivedAt: data.receivedAt?.toDate?.() || data.receivedAt,
        expiryDate: data.expiryDate?.toDate?.() || data.expiryDate,
      } as ProductInventoryEntry;
    } catch (indexError: any) {
      // If index is not ready, fall back to simple query and sort in memory
      console.warn('⚠️ Index not ready for getLatestBatch, using fallback:', indexError.message);
      
      const simpleQuery = query(colRef, where('productId', '==', productId), where('status', '==', 'active'));
      const snap = await getDocs(simpleQuery);
      if (snap.empty) return null;
      
      const batches = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          receivedAt: data.receivedAt?.toDate?.() || data.receivedAt,
          expiryDate: data.expiryDate?.toDate?.() || data.expiryDate,
        } as ProductInventoryEntry;
      });
      
      // Sort in memory and get the latest
      batches.sort((a, b) => {
        const dateA = new Date(a.receivedAt).getTime();
        const dateB = new Date(b.receivedAt).getTime();
        return dateB - dateA; // Descending order
      });
      
      return batches[0] || null;
    }
  }

  /**
   * Add a new inventory batch and automatically update product summary
   * ALL-OR-NOTHING TRANSACTION: Either both batch creation and product update succeed, or both fail
   */
  async addBatch(productId: string, entry: Omit<ProductInventoryEntry, 'id' | 'uid' | 'createdAt' | 'updatedAt' | 'productId'> & { productId?: string }): Promise<string> {
    console.log('🚀 Starting transactional addBatch process for productId:', productId);
    console.log('📦 Batch entry data:', entry);
    
    // Enhanced authentication and UID verification
    const user = this.auth.getCurrentUser();
    const permission = this.auth.getCurrentPermission();
    
    console.log('🔍 Auth check - user:', user ? { uid: user.uid, email: user.email } : 'NULL');
    console.log('🔍 Auth check - permission:', permission ? { companyId: permission.companyId, storeId: permission.storeId } : 'NULL');
    
    if (!user?.uid || !permission) {
      const error = `User not authenticated or no company permission found. User: ${user ? 'present' : 'null'}, Permission: ${permission ? 'present' : 'null'}`;
      console.error('❌ Authentication failed:', error);
      throw new Error(error);
    }

    console.log('🔐 User authenticated for batch creation:', { uid: user.uid, email: user.email, companyId: permission.companyId });

    // Prepare batch entry data
    const batchData: Omit<ProductInventoryEntry, 'id'> = {
      ...entry,
      productId,
      uid: user.uid,
      companyId: permission.companyId,
      storeId: permission.storeId || '', // Handle potential undefined
      status: 'active',
      createdBy: user.uid,
      updatedBy: user.uid,
      receivedAt: entry.receivedAt instanceof Date ? entry.receivedAt : new Date(entry.receivedAt),
      expiryDate: entry.expiryDate ? (entry.expiryDate instanceof Date ? entry.expiryDate : new Date(entry.expiryDate)) : undefined,
      syncStatus: 'SYNCED',
      isOffline: false,
      initialQuantity: entry.quantity,
      totalDeducted: 0,
      deductionHistory: []
    };

    // Use Firestore transaction for all-or-nothing operation
    return runTransaction(this.firestore, async (transaction) => {
      console.log('🔄 Starting Firestore transaction for addBatch...');

      // IMPORTANT: Do all reads FIRST, then all writes (Firestore transaction requirement)
      
      // 1. Read the product document first (before any writes)
      const productRef = doc(this.firestore, 'products', productId);
      const prodSnap = await transaction.get(productRef);
      console.log('📖 Product document read completed, exists:', prodSnap.exists());

      // 2. Now do all the writes after reads are complete
      
      // 2a. Create new batch document
      const batchRef = doc(collection(this.firestore, this.collectionName));
      const cleanBatchData = this.cleanUndefined(batchData);
      
      transaction.set(batchRef, {
        ...cleanBatchData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log('📦 Batch document queued for creation:', batchRef.id);

      // 2b. Update product summary within the same transaction
      try {
        // Compute incremental totals for totalStock
        const existingTotal = prodSnap.exists() ? (Number((prodSnap.data() as any).totalStock) || 0) : 0;
        const newTotal = existingTotal + (Number(cleanBatchData.quantity) || 0);

        // For sellingPrice, we'll let the post-commit recompute handle it correctly
        // since it can read all batches and determine the latest by receivedAt
        const currentSellingPrice = prodSnap.exists() ? (Number((prodSnap.data() as any).sellingPrice) || 0) : Number(cleanBatchData.unitPrice) || 0;

        if (prodSnap.exists()) {
          // For existing products, only update totalStock in transaction
          // Post-commit recompute will handle sellingPrice correctly
          transaction.update(productRef, {
            totalStock: newTotal,
            lastUpdated: new Date(),
            updatedBy: user.uid
          });
          console.log('� Updated existing product totalStock in transaction:', newTotal);
        } else {
          // If the product document does not exist yet, create it with initial values
          // Post-commit recompute will correct the sellingPrice if needed
          transaction.set(productRef, {
            uid: user.uid,
            companyId: permission.companyId,
            storeId: permission.storeId || '',
            totalStock: newTotal,
            sellingPrice: Number(cleanBatchData.unitPrice) || 0,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastUpdated: new Date(),
            createdBy: user.uid,
            updatedBy: user.uid
          });
          console.log('📊 Created new product with initial values:', { totalStock: newTotal, sellingPrice: cleanBatchData.unitPrice });
        }
      } catch (err) {
        // If product doesn't exist or update fails, still allow transaction to proceed
        // but surface a warning. The separate recompute path can be used to repair
        // discrepancies later.
        console.warn('⚠️ Failed to incrementally update product summary inside transaction:', err);
      }

      // Transaction will commit both operations atomically
      console.log('✅ Transaction prepared successfully - both batch and product will be updated atomically');
      
      return batchRef.id;
    }).then(async (batchId) => {
      console.log('🎉 Transaction committed successfully! Batch created:', batchId);
      try {
        // Ensure product summary is fully recomputed from committed batches
        // so UI and other services see the authoritative values.
        // This will correctly calculate sellingPrice from the latest batch by receivedAt.
        const summary = await this.productSummaryService.recomputeProductSummary(productId);
        console.log('🔁 Post-commit product summary recompute completed for', productId, 'with summary:', summary);
      } catch (recomputeErr) {
        console.warn('⚠️ Post-commit recompute failed:', recomputeErr);
      }
      return batchId;
    }).catch((error) => {
      console.error('❌ Transaction failed - no changes made:', error);
      throw new Error(`Failed to add batch: ${error.message}`);
    });
  }

  /**
   * Update an existing inventory batch and automatically update product summary
   * ALL-OR-NOTHING TRANSACTION: Either both batch update and product update succeed, or both fail
   */
  async updateBatch(productId: string, batchDocId: string, updates: Partial<ProductInventoryEntry>): Promise<void> {
    const user = this.auth.getCurrentUser();
    if (!user?.uid) {
      throw new Error('User not authenticated or missing UID');
    }

    console.log('🔐 User authenticated for batch update:', { uid: user.uid, email: user.email });

    // Use Firestore transaction for all-or-nothing operation
    await runTransaction(this.firestore, async (transaction) => {
      console.log('🔄 Starting Firestore transaction for updateBatch...');

      // 1. Update batch document
      const batchRef = doc(this.firestore, this.collectionName, batchDocId);
      const cleanUpdates = this.cleanUndefined({
        ...updates,
        uid: user.uid,
        updatedBy: user.uid,
        updatedAt: new Date(),
        receivedAt: updates.receivedAt ? (updates.receivedAt instanceof Date ? updates.receivedAt : new Date(updates.receivedAt)) : undefined,
        expiryDate: updates.expiryDate ? (updates.expiryDate instanceof Date ? updates.expiryDate : new Date(updates.expiryDate)) : undefined,
      });

      transaction.update(batchRef, cleanUpdates);
      console.log('� Batch update queued in transaction:', batchDocId);

      // 2. Update product summary using ProductSummaryService
      await this.productSummaryService.recomputeProductSummaryInTransaction(
        transaction,
        productId
      );

      console.log('📊 Product summary update queued in transaction');
    }).then(() => {
      console.log('✅ Batch update transaction committed successfully:', batchDocId);
    }).catch((error) => {
      console.error('❌ Batch update transaction failed - no changes made:', error);
      throw new Error(`Failed to update batch: ${error.message}`);
    });
  }

  async removeBatch(productId: string, batchDocId: string): Promise<void> {
    await this.updateBatch(productId, batchDocId, { status: 'removed' });
  }

  /**
   * Generates a unique batch ID using the format: 25MMDD######
   * Where 25 = year 2025, MM = month, DD = day, ###### = 6 random digits
   */
  private generateUniqueBatchId(): string {
    const now = new Date();
    const year = '25'; // 2025 as 25
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 01-12
    const day = String(now.getDate()).padStart(2, '0'); // 01-31
    
    // Generate 6 random digits
    const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
    return `${year}${month}${day}${randomSuffix}`;
  }

  /**
   * Direct Firestore document creation as fallback
   */
  private async createDirectFirestoreDocument(payload: any): Promise<string> {
    console.log('🔥 Creating document directly with Firestore...');
    const colRef = collection(this.firestore, this.collectionName);
    const toWrite = applyCreateTimestamps(payload, navigator.onLine as boolean);
    const docRef = await addDoc(colRef, toWrite);
    console.log('✅ Direct Firestore creation successful:', docRef.id);
    return docRef.id;
  }

  /**
   * Migration helper: Move embedded inventory arrays from product documents
   * into the productInventory collection, then remove the embedded field.
   * Call manually from an admin action or console.
   */
  async migrateEmbeddedInventoryForAllProducts(): Promise<{ migrated: number; skipped: number; errors: number; }> {
    const productsRef = collection(this.firestore, 'products');
    const snap = await getDocs(productsRef);
    let migrated = 0, skipped = 0, errors = 0;
    for (const d of snap.docs) {
      try {
        const data: any = d.data();
        const inv: any[] = Array.isArray(data.inventory) ? data.inventory : [];
        if (!inv.length) { skipped++; continue; }
        const productId = d.id;
        const unitType = data.unitType || 'pieces';
        const companyId = data.companyId || '';
        const storeId = data.storeId || '';
        for (const item of inv) {
          // Generate a proper unique batch ID if none exists
          const batchId = item.batchId || this.generateUniqueBatchId();
          
          await this.addBatch(productId, {
            batchId,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            costPrice: Number(item.costPrice || 0),
            receivedAt: item.receivedAt?.toDate?.() || new Date(),
            expiryDate: item.expiryDate?.toDate?.() || undefined,
            supplier: item.supplier || undefined,
            status: item.status || 'active',
            unitType,
            companyId,
            storeId,
            productId
          } as any);
        }
        // Remove embedded inventory fields
        await this.offlineDocService.updateDocument('products', productId, {
          inventory: deleteField(),
          isMultipleInventory: deleteField()
        });
        migrated++;
      } catch (e) {
        console.error('❌ Migration error for product:', d.id, e);
        errors++;
      }
    }
    console.log('✅ Migration complete:', { migrated, skipped, errors });
    return { migrated, skipped, errors };
  }
}
