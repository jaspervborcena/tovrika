import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, query, where, orderBy, limit, Timestamp, writeBatch } from '@angular/fire/firestore';
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
  }

  async getLatestBatch(productId: string): Promise<ProductInventoryEntry | null> {
    const colRef = collection(this.firestore, this.collectionName);
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
  }

  async addBatch(productId: string, entry: Omit<ProductInventoryEntry, 'id' | 'uid' | 'createdAt' | 'updatedAt' | 'productId'> & { productId?: string }): Promise<string> {
    const user = this.auth.getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    const payload: any = this.cleanUndefined({
      ...entry,
      productId,
      uid: user.uid,
      receivedAt: Timestamp.fromDate(entry.receivedAt instanceof Date ? entry.receivedAt : new Date(entry.receivedAt as any)),
      expiryDate: entry.expiryDate ? Timestamp.fromDate(entry.expiryDate instanceof Date ? entry.expiryDate : new Date(entry.expiryDate as any)) : undefined,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Create inventory entry (offline-safe)
    const id = await this.offlineDocService.createDocument(this.collectionName, payload);

    // Recompute product summary
    await this.recomputeAndUpdateProductSummary(productId);
    return id;
  }

  async updateBatch(productId: string, batchDocId: string, updates: Partial<ProductInventoryEntry>): Promise<void> {
    const user = this.auth.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const clean = this.cleanUndefined({
      ...updates,
      uid: user.uid,
      updatedAt: Timestamp.now(),
      receivedAt: updates.receivedAt ? Timestamp.fromDate(updates.receivedAt instanceof Date ? updates.receivedAt : new Date(updates.receivedAt)) : undefined,
      expiryDate: updates.expiryDate ? Timestamp.fromDate(updates.expiryDate instanceof Date ? updates.expiryDate : new Date(updates.expiryDate)) : undefined,
    });

    await this.offlineDocService.updateDocument(this.collectionName, batchDocId, clean);
    await this.recomputeAndUpdateProductSummary(productId);
  }

  async removeBatch(productId: string, batchDocId: string): Promise<void> {
    await this.updateBatch(productId, batchDocId, { status: 'removed' });
  }

  async recomputeAndUpdateProductSummary(productId: string): Promise<void> {
    // Load all active batches for product
    const batches = await this.listBatches(productId);
    const active = batches.filter((b) => b.status === 'active');
    const totalStock = active.reduce((s, b) => s + (b.quantity || 0), 0);
    const latest = active.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())[0] || null;
    const sellingPrice = latest ? latest.unitPrice : 0;

    await this.productService.updateProduct(productId, {
      totalStock,
      sellingPrice,
      lastUpdated: new Date(),
    } as any);
  }
}
