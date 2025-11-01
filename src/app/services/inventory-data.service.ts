import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, query, where, orderBy, limit, Timestamp, writeBatch, addDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { deleteField } from 'firebase/firestore';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { ProductInventoryEntry } from '../interfaces/product-inventory-entry.interface';

@Injectable({ providedIn: 'root' })
export class InventoryDataService {
  private readonly firestore = inject(Firestore);
  private readonly offlineDocService = inject(OfflineDocumentService);
  private readonly auth = inject(AuthService);
  private readonly productService = inject(ProductService);

  private collectionName = 'productInventory';

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

  async addBatch(productId: string, entry: Omit<ProductInventoryEntry, 'id' | 'uid' | 'createdAt' | 'updatedAt' | 'productId'> & { productId?: string }): Promise<string> {
    console.log('🚀 Starting addBatch process...');
    
    // Enhanced authentication and UID verification with retry logic
    let user = this.auth.getCurrentUser();
    
    // If no user, wait a bit and try again (handles timing issues)
    if (!user?.uid) {
      console.log('⏳ No user found, waiting for authentication...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      user = this.auth.getCurrentUser();
    }
    
    if (!user?.uid) {
      throw new Error('User not authenticated or missing UID. Please refresh and try again.');
    }

    console.log('🔐 User authenticated for batch creation:', { uid: user.uid, email: user.email });
    
    // Check Firebase Auth directly as well
    try {
      const firebaseUser = (window as any).firebase?.auth?.()?.currentUser;
      console.log('🔥 Firebase Auth user:', firebaseUser ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        emailVerified: firebaseUser.emailVerified
      } : 'Not found');
      
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        console.log('🎫 Firebase ID token exists:', !!token);
      }
    } catch (fbError) {
      console.warn('⚠️ Firebase Auth check failed:', fbError);
    }
    
    const payload: any = this.cleanUndefined({
      ...entry,
      productId,
      // Explicitly add UID to ensure it's present
      uid: user.uid,
      // Add additional security fields
      createdBy: user.uid,
      updatedBy: user.uid,
      receivedAt: Timestamp.fromDate(entry.receivedAt instanceof Date ? entry.receivedAt : new Date(entry.receivedAt as any)),
      expiryDate: entry.expiryDate ? Timestamp.fromDate(entry.expiryDate instanceof Date ? entry.expiryDate : new Date(entry.expiryDate as any)) : undefined,
    });

    console.log('🔍 Creating inventory batch with payload:', payload);
    console.log('🌐 Online status:', navigator.onLine);
    
    // Verify UID is in the payload before sending to OfflineDocumentService
    if (!payload.uid) {
      console.error('❌ UID missing in payload before creation');
      throw new Error('UID is required for inventory batch creation');
    }

    try {
      // Create inventory entry (offline-safe) - but ensure UID is preserved
      const id = await this.offlineDocService.createDocument(this.collectionName, payload);
      
      console.log('✅ Inventory batch created successfully:', { id, uid: payload.uid });

      // Recompute product summary
      await this.recomputeAndUpdateProductSummary(productId);
      return id;
    } catch (error: any) {
      console.error('❌ Failed to create inventory batch:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Enhanced error logging for permissions issues
      if (error.message?.includes('permissions') || error.code === 'permission-denied') {
        console.error('🚫 PERMISSIONS ERROR DETAILS:', {
          userUID: user.uid,
          payloadUID: payload.uid,
          online: navigator.onLine,
          error: error.message,
          errorCode: error.code,
          payload: payload
        });
        
        // Try a direct Firestore write as fallback with even more logging
        console.log('🔄 Attempting direct Firestore write as fallback...');
        try {
          console.log('📝 Direct write payload:', payload);
          const directResult = await this.createDirectFirestoreDocument(payload);
          console.log('✅ Direct Firestore write successful:', directResult);
          await this.recomputeAndUpdateProductSummary(productId);
          return directResult;
        } catch (directError: any) {
          console.error('❌ Direct Firestore write also failed:', directError);
          console.error('❌ Direct error details:', {
            code: directError.code,
            message: directError.message,
            stack: directError.stack
          });
        }
      }
      
      throw error;
    }
  }

  async updateBatch(productId: string, batchDocId: string, updates: Partial<ProductInventoryEntry>): Promise<void> {
    // Enhanced authentication check
    const user = this.auth.getCurrentUser();
    if (!user?.uid) {
      throw new Error('User not authenticated or missing UID');
    }

    console.log('🔐 User authenticated for batch update:', { uid: user.uid, email: user.email });

    const clean = this.cleanUndefined({
      ...updates,
      // Ensure UID is preserved in updates
      uid: user.uid,
      receivedAt: updates.receivedAt ? Timestamp.fromDate(updates.receivedAt instanceof Date ? updates.receivedAt : new Date(updates.receivedAt)) : undefined,
      expiryDate: updates.expiryDate ? Timestamp.fromDate(updates.expiryDate instanceof Date ? updates.expiryDate : new Date(updates.expiryDate)) : undefined,
    });

    console.log('🔍 Updating inventory batch:', { batchDocId, uid: clean.uid });

    try {
      await this.offlineDocService.updateDocument(this.collectionName, batchDocId, clean);
      await this.recomputeAndUpdateProductSummary(productId);
      
      console.log('✅ Inventory batch updated successfully:', batchDocId);
    } catch (error: any) {
      console.error('❌ Failed to update inventory batch:', error);
      
      if (error.message?.includes('permissions') || error.code === 'permission-denied') {
        console.error('🚫 UPDATE PERMISSIONS ERROR:', {
          userUID: user.uid,
          batchDocId,
          error: error.message
        });
      }
      
      throw error;
    }
    await this.recomputeAndUpdateProductSummary(productId);
  }

  async removeBatch(productId: string, batchDocId: string): Promise<void> {
    await this.updateBatch(productId, batchDocId, { status: 'removed' });
  }

  async recomputeAndUpdateProductSummary(productId: string): Promise<void> {
    console.log('📊 Recomputing product summary for:', productId);
    
    // Load all active batches for product
    const batches = await this.listBatches(productId);
    const active = batches.filter((b) => b.status === 'active');
    
    // Calculate total stock from all active batches
    const totalStock = active.reduce((s, b) => s + (b.quantity || 0), 0);
    console.log('📦 Total stock calculated:', totalStock, 'from', active.length, 'active batches');
    
    // Get latest batch for selling price (most recent first)
    const latest = active.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())[0] || null;
    const sellingPrice = latest ? latest.unitPrice : 0;
    console.log('💰 Selling price from latest batch:', sellingPrice, latest ? `(batch: ${latest.batchId})` : '(no active batches)');

    // Update product with calculated values
    const updateData = {
      totalStock,
      sellingPrice,
      lastUpdated: new Date(),
    };
    
    console.log('🔄 Updating product with:', updateData);
    await this.productService.updateProduct(productId, updateData as any);
    console.log('✅ Product summary updated successfully');
  }

  /**
   * Direct Firestore document creation as fallback
   */
  private async createDirectFirestoreDocument(payload: any): Promise<string> {
    console.log('🔥 Creating document directly with Firestore...');
    const colRef = collection(this.firestore, this.collectionName);
    const docRef = await addDoc(colRef, payload);
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
          await this.addBatch(productId, {
            batchId: item.batchId || `BATCH-${Date.now()}`,
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
