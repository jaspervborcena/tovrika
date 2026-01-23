 
import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  doc
} from '@angular/fire/firestore';
import { getDocs, getAggregateFromServer, count, getDoc } from 'firebase/firestore';
import { ProductService } from './product.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';

export interface InventoryRow {
  invoiceNo: string;
  batchId?: string | null;
  date?: Date | string;
  performedBy?: string;
  productCode?: string;
  sku?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  profitPerUnit: number;
  totalGross: number;
  totalProfit: number;
}

export interface InventoryItem {
  productId: string;
  branchId?: string;
  storeId?: string;
  companyId?: string;
  quantity: number;
  minStock?: number;
  maxStock?: number;
  lastRestocked?: Date;
  updatedAt?: Date;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private firestore = inject(Firestore);
  private productService = inject(ProductService);
  private offlineDocService = inject(OfflineDocumentService);

  public rows = signal<InventoryRow[]>([]);
  public isLoading = signal<boolean>(false);
  public totalCount = signal<number>(0);
  public currentPage = signal<number>(1);
  public readonly pageSize = 20;
  public totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  private readonly inventory = signal<InventoryItem[]>([]);

  public totalGross = computed(() => this.rows().reduce((s, r) => s + (r.totalGross || 0), 0));
  public totalProfit = computed(() => this.rows().reduce((s, r) => s + (r.totalProfit || 0), 0));

  readonly lowStockItems = computed(() => this.inventory().filter(item => item.quantity <= (item.minStock ?? 0)));
  readonly outOfStockItems = computed(() => this.inventory().filter(item => item.quantity === 0));

  // Cache for user display names to avoid repeated queries
  private userDisplayNameCache = new Map<string, string>();

  constructor() {}

  /**
   * Get user display name from Firestore users collection by UID
   */
  private async getUserDisplayName(uid: string | undefined): Promise<string | null> {
    if (!uid) return null;
    // Normalize system/service accounts to a friendly label to avoid raw uid duplicates
    if (uid === 'system' || uid === 'SYSTEM') return 'System';
    
    // Check cache first
    if (this.userDisplayNameCache.has(uid)) {
      return this.userDisplayNameCache.get(uid) || null;
    }

    try {
      const userDoc = await getDocs(query(
        collection(this.firestore, 'users'),
        where('uid', '==', uid),
        limit(1)
      ) as any);

      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data() as any;
        const displayName = userData?.displayName || userData?.email || uid;
        this.userDisplayNameCache.set(uid, displayName);
        return displayName;
      }
    } catch (error) {
      console.warn('Failed to fetch user display name:', error);
    }

    return null;
  }

  /**
   * Build a detailed invoice report for a given orderId or for a date range.
   * If orderId is provided, filters by orderId. Otherwise, filters by date range.
   *
   * @param params { orderId?: string, period?: 'today'|'yesterday'|'this_month'|'previous_month'|'range', range?: {start: Date, end: Date} }
   */
  async buildInvoiceReport(params: {
    orderId?: string;
    period?: 'today'|'yesterday'|'this_month'|'previous_month'|'range';
    range?: { start: Date; end: Date };
  }): Promise<any[]> {
    const reportRows: any[] = [];

    // Helpers to compute period start/end Dates
    const computePeriodRange = (): { start: Date; end: Date } => {
      const now = new Date();
      if (params.period === 'today') {
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        };
      }
      if (params.period === 'yesterday') {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        return {
          start: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0),
          end: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999)
        };
      }
      if (params.period === 'this_month') {
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        };
      }
      if (params.period === 'previous_month') {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return {
          start: new Date(prev.getFullYear(), prev.getMonth(), 1, 0, 0, 0, 0),
          end: new Date(prev.getFullYear(), prev.getMonth() + 1, 0, 23, 59, 59, 999)
        };
      }
      if (params.period === 'range' && params.range) {
        return { start: params.range.start, end: params.range.end };
      }
      throw new Error('Invalid period or range');
    };

    // Normalize various timestamp values to Date
    const normalizeToDate = (v: any): Date | null => {
      if (!v && v !== 0) return null;
      if (v instanceof Date) return v;
      if (typeof v === 'number') return new Date(v);
      if (typeof v === 'string') {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      }
      if (v && typeof v.toDate === 'function') {
        try { return v.toDate(); } catch { return null; }
      }
      return null;
    };

    // Build filters for tracking (ordersSellingTracking) and deductions (inventoryDeductions)
    const trackingFilters: any[] = [];
    const deductionFilters: any[] = [];

    if (params.orderId) {
      trackingFilters.push(where('orderId', '==', params.orderId));
      deductionFilters.push(where('orderId', '==', params.orderId));
    } else if (params.period) {
      const { start, end } = computePeriodRange();
      // ordersSellingTracking.createdAt is often stored as epoch ms (number)
      trackingFilters.push(where('createdAt', '>=', start.getTime()));
      trackingFilters.push(where('createdAt', '<=', end.getTime()));
      // deductions tend to use Date/Timestamp
      deductionFilters.push(where('createdAt', '>=', start));
      deductionFilters.push(where('createdAt', '<=', end));
    }

    // Query tracking documents
    let trackDocs: any[] = [];
    try {
      const trackingQ = query(collection(this.firestore, 'ordersSellingTracking'), ...trackingFilters);
      const trackSnap = await getDocs(trackingQ as any);
      trackDocs = trackSnap.docs;
    } catch (err) {
      console.warn('ordersSellingTracking query failed, returning empty list for tracking:', err);
      trackDocs = [];
    }

    // Query deductions (merge multiple queries to cover different timestamp fields)
    const dedById = new Map<string, any>();
    try {
      const deductionQ = query(collection(this.firestore, 'inventoryDeductions'), ...deductionFilters);
      const deductionSnapAll = await getDocs(deductionQ as any);
      for (const d of deductionSnapAll.docs) dedById.set(d.id, d);
    } catch (err) {
      console.warn('Primary deduction query failed (createdAt):', err);
    }

    // Also try querying by deductedAt if period provided (some docs use deductedAt)
    if (params.period) {
      try {
        const { start, end } = computePeriodRange();
        const dedFilters: any[] = [where('deductedAt', '>=', start), where('deductedAt', '<=', end)];
        const deductionQ2 = query(collection(this.firestore, 'inventoryDeductions'), ...dedFilters);
        const deductionSnap2 = await getDocs(deductionQ2 as any);
        for (const d of deductionSnap2.docs) if (!dedById.has(d.id)) dedById.set(d.id, d);
      } catch (err) {
        console.warn('Fallback deduction query failed (deductedAt):', err);
      }
    }

    const deductionDocs = Array.from(dedById.values());

    // Collect productIds from tracking + deduction docs
    const productIds = new Set<string>();
    for (const d of trackDocs) {
      const pd = (d.data() as any).productId;
      if (pd) productIds.add(pd);
    }
    for (const d of deductionDocs) {
      const pd = (d.data() as any).productId;
      if (pd) productIds.add(pd);
    }

    const productIdsArr = Array.from(productIds);
    const productRefs = productIdsArr.map(pid => doc(this.firestore, 'products', pid));
    const productSnaps = await Promise.all(productRefs.map(ref => getDoc(ref as any)));
    const productMap = new Map<string, any>();
    productSnaps.forEach((snap, idx) => { if (snap.exists()) productMap.set(productIdsArr[idx], snap.data()); });

    // Index deductions by orderId::productId
    const dedIndex = new Map<string, any>();
    for (const d of deductionDocs) {
      const dd: any = d.data();
      const key = `${dd.orderId || ''}::${dd.productId || ''}`;
      if (!dedIndex.has(key)) dedIndex.set(key, dd);
    }

    // Process tracking rows
    for (const trackDoc of trackDocs) {
      const track: any = trackDoc.data();
      const productData = productMap.get(track.productId) || {};
      const productName = productData.productName || track.productName || '';
      const sku = productData.skuId || track.sku || '';
      const resolvedSellingPrice = Number(track.price ?? productData.sellingPrice ?? 0) || 0;
      const qty = Number(track.quantity || 0) || 0;

      const row: any = {
        invoiceNumber: track.invoiceNumber || null,
        invoiceNo: track.invoiceNumber || null,
        orderId: track.orderId,
        productId: track.productId,
        productName,
        sku,
        sellingPrice: resolvedSellingPrice,
        quantity: qty,
        totalGross: +(resolvedSellingPrice * qty)
      };

      const dedKey = `${row.orderId || ''}::${row.productId || ''}`;
      const ded = dedIndex.get(dedKey);
      if (ded) {
        row.batchId = ded.batchId;
        row.deductedAt = normalizeToDate(ded.deductedAt) || normalizeToDate(ded.createdAt) || null;
        const dedUid = ded.deductedBy || ded.deductedByUid || null;
        const fallbackUid = track.createdBy || track.cashierId || null;
        row.performedBy = (await this.getUserDisplayName(dedUid)) || (await this.getUserDisplayName(fallbackUid)) || dedUid || fallbackUid || null;
        row.costPrice = typeof ded.costPrice === 'number' ? ded.costPrice : (ded.costPrice ? Number(ded.costPrice) : null);
        row.profitPerUnit = (row.sellingPrice || 0) - (row.costPrice ?? 0);
        row.totalProfit = +(row.profitPerUnit * (row.quantity || 0));
      } else {
        row.batchId = null;
        row.deductedAt = null;
        const trackUid = track.createdBy || track.cashierId || null;
        row.performedBy = (await this.getUserDisplayName(trackUid)) || trackUid || null;
        row.costPrice = null;
        row.profitPerUnit = null;
        row.totalProfit = null;
      }

      // Enrich with batch if available
      if (row.batchId) {
        try {
          const batchRef = doc(this.firestore, 'productInventory', row.batchId);
          const batchSnap = await getDoc(batchRef as any);
          if (batchSnap.exists()) {
            const batchData: any = batchSnap.data();
            row.unitPrice = batchData.unitPrice;
            if (row.costPrice == null && typeof batchData.unitPrice === 'number') {
              row.costPrice = batchData.unitPrice;
              row.profitPerUnit = (row.sellingPrice || 0) - (row.costPrice || 0);
              row.totalProfit = +(row.profitPerUnit * (row.quantity || 0));
            }
            row.status = batchData.status;
          }
        } catch (err) {
          // ignore batch fetch errors
        }
      }

      reportRows.push(row);
    }

    // Add deduction-only rows
    for (const d of deductionDocs) {
      const ded: any = d.data();
      const key = `${ded.orderId || ''}::${ded.productId || ''}`;
      const exists = reportRows.find(r => (r.orderId || '') === (ded.orderId || '') && (r.productId || '') === (ded.productId || ''));
      if (exists) continue;

      const productData = productMap.get(ded.productId) || {};
      const productName = productData.productName || ded.productName || '';
      const sku = productData.skuId || ded.sku || '';
      const resolvedSelling = Number(ded.sellingPrice ?? productData.sellingPrice ?? 0) || 0;
      const resolvedQty = Number(ded.quantity || 0) || 0;

      const row: any = {
        invoiceNumber: ded.invoiceNumber || null,
        invoiceNo: ded.invoiceNumber || null,
        orderId: ded.orderId,
        productId: ded.productId,
        productName,
        sku,
        sellingPrice: resolvedSelling,
        quantity: resolvedQty,
        totalGross: +(resolvedSelling * resolvedQty),
        batchId: ded.batchId,
        deductedAt: normalizeToDate(ded.deductedAt) || normalizeToDate(ded.createdAt) || null,
        performedBy: (await this.getUserDisplayName(ded.deductedBy)) || ded.deductedBy || null,
        costPrice: typeof ded.costPrice === 'number' ? ded.costPrice : (ded.costPrice ? Number(ded.costPrice) : null)
      };
      row.profitPerUnit = (row.sellingPrice || 0) - (row.costPrice ?? 0);
      row.totalProfit = +(row.profitPerUnit * (row.quantity || 0));

      if (row.batchId) {
        try {
          const batchRef = doc(this.firestore, 'productInventory', row.batchId);
          const batchSnap = await getDoc(batchRef as any);
          if (batchSnap.exists()) {
            const batchData: any = batchSnap.data();
            row.unitPrice = batchData.unitPrice;
            row.status = batchData.status;
          }
        } catch (err) {
          // ignore
        }
      }

      reportRows.push(row);
    }

    return reportRows;
  }

  /**
   * Fetch and map rows from any collection with optional filters.
   * Returns mapped InventoryRow[] ordered by `updatedAt` desc limited by fetchLimit.
   */
  async fetchRowsFromCollection(
    collectionName: string,
    baseFilters: any[] = [],
    fetchLimit: number = 1000,
    updatedAtRange?: { start?: Date | null; end?: Date | null }
  ): Promise<InventoryRow[]> {
    const col = collection(this.firestore, collectionName);
    const out: InventoryRow[] = [];
    try {
      const q = query(col, ...baseFilters, orderBy('createdAt', 'desc'), limit(fetchLimit));
      const snaps = await getDocs(q as any);
      for (const s of snaps.docs) {
        const data: any = s.data() || {};
      const productId: string = data.productId;
      const quantity: number = Number(data.quantity || 0);
      const product = this.productService.getProduct(productId);

      const productCode = (product && product.productCode) ? product.productCode : (data.productCode || '');
      const sku = (product && product.skuId) ? product.skuId : (data.sku || '');

      // Use costPrice directly from inventoryDeductions (per-batch cost)
      const costPrice = Number(data.costPrice || 0) || 0;
      
      const batchId: string | null = data.batchId ? String(data.batchId) : null;

      const sellingPrice = Number(product?.sellingPrice ?? data.price ?? 0) || 0;
      const profitPerUnit = +(sellingPrice - costPrice);
      const totalGross = +(sellingPrice * quantity);
      const totalProfit = +(profitPerUnit * quantity);

      const outProductCode = (productCode && productCode.trim().length > 0) ? productCode : '';
      const outSku = (sku && sku.trim().length > 0) ? sku : '';
      const finalProductCode = outProductCode || outSku ? outProductCode : productId;

      // Extract date and performedBy from inventoryDeductions data
      let deductionDate: Date | string | undefined = undefined;
      if (data.deductedAt) {
        if (typeof data.deductedAt === 'string') {
          deductionDate = data.deductedAt;
        } else if (data.deductedAt instanceof Date) {
          deductionDate = data.deductedAt;
        } else if (typeof data.deductedAt.toDate === 'function') {
          deductionDate = data.deductedAt.toDate();
        }
      }

      // Get user displayName from deductedBy (uid)
      const performedBy = await this.getUserDisplayName(data.deductedBy) || data.deductedBy || '';

      out.push({
        invoiceNo: data.invoiceNumber || data.orderId || '',
        batchId,
        date: deductionDate,
        performedBy,
        productCode: finalProductCode,
        sku: outSku,
        costPrice,
        sellingPrice,
        quantity,
        profitPerUnit,
        totalGross,
        totalProfit
      });
      }
      return out;
    } catch (err) {
      // Likely index required or other query error — fall back to a simpler query and client-side filter
      console.warn('fetchRowsFromCollection primary query failed, falling back:', err);
      // Attempt to use the first filter (commonly status equality) and order by createdAt
      const fallbackFilters = baseFilters && baseFilters.length > 0 ? [baseFilters[0]] : [];
      const fallbackQ = query(col, ...fallbackFilters, orderBy('createdAt', 'desc'), limit(fetchLimit));
      const snapsFallback = await getDocs(fallbackQ as any);
      for (const s of snapsFallback.docs) {
        const data: any = s.data() || {};
          // if updatedAtRange provided, enforce it client-side
          if (updatedAtRange && (updatedAtRange.start || updatedAtRange.end)) {
            const ca = data.createdAt;
            let createdAtDate: Date | null = null;
            if (!ca) continue;
            if (typeof ca.toDate === 'function') createdAtDate = ca.toDate();
            else if (ca instanceof Date) createdAtDate = ca as Date;
            else createdAtDate = new Date(ca);
            if (!createdAtDate) continue;
            if (updatedAtRange.start && createdAtDate < updatedAtRange.start) continue;
            if (updatedAtRange.end && createdAtDate > updatedAtRange.end) continue;
          }
        const productId: string = data.productId;
        const quantity: number = Number(data.quantity || 0);
        const product = this.productService.getProduct(productId);

        const productCode = (product && product.productCode) ? product.productCode : (data.productCode || '');
        const sku = (product && product.skuId) ? product.skuId : (data.sku || '');

        // Use costPrice directly from inventoryDeductions (per-batch cost)
        const costPrice = Number(data.costPrice || 0) || 0;
        
        const batchId: string | null = data.batchId ? String(data.batchId) : null;

        const sellingPrice = Number(product?.sellingPrice ?? data.price ?? 0) || 0;
        const profitPerUnit = +(sellingPrice - costPrice);
        const totalGross = +(sellingPrice * quantity);
        const totalProfit = +(profitPerUnit * quantity);

        const outProductCode = (productCode && productCode.trim().length > 0) ? productCode : '';
        const outSku = (sku && sku.trim().length > 0) ? sku : '';
        const finalProductCode = outProductCode || outSku ? outProductCode : productId;

        // Extract date and performedBy from inventoryDeductions data
        let deductionDate: Date | string | undefined = undefined;
        if (data.deductedAt) {
          if (typeof data.deductedAt === 'string') {
            deductionDate = data.deductedAt;
          } else if (data.deductedAt instanceof Date) {
            deductionDate = data.deductedAt;
          } else if (typeof data.deductedAt.toDate === 'function') {
            deductionDate = data.deductedAt.toDate();
          }
        }

        // Get user displayName from deductedBy (uid)
        const performedBy = await this.getUserDisplayName(data.deductedBy) || data.deductedBy || '';

        out.push({
          invoiceNo: data.invoiceNumber || data.orderId || '',
          batchId,
          date: deductionDate,
          performedBy,
          productCode: finalProductCode,
          sku: outSku,
          costPrice,
          sellingPrice,
          quantity,
          profitPerUnit,
          totalGross,
          totalProfit
        });
      }
      return out;
    }
  }
/**
 * Load rows for a given period and page (uses fetchRowsFromCollection internally).
 */
async loadRowsForPeriod(period: string, page: number = 1): Promise<void> {
  this.isLoading.set(true);
  this.currentPage.set(page);

  try {
    const trackingColName = 'inventoryDeductions';
    const filters: any[] = [];

    const now = new Date();
    let updatedAtRange: { start?: Date | null; end?: Date | null } | undefined;

    if (period === 'this_month' || period === 'previous_month') {
      // compute month range start/end and filter by updatedAt so we don't rely on a yearMonth field
      let targetMonth: Date;
      if (period === 'this_month') {
        targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      }
      const year = targetMonth.getFullYear();
      const month = targetMonth.getMonth();
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      filters.push(where('createdAt', '>=', start));
      filters.push(where('createdAt', '<=', end));
      updatedAtRange = { start, end };
    } else if (period === 'today' || period === 'yesterday') {
      // keep using exact date range for daily queries
      let start: Date | null = null;
      let end: Date | null = null;
      if (period === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
        end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      }
      if (start && end) {
        filters.push(where('createdAt', '>=', start));
        filters.push(where('createdAt', '<=', end));
        updatedAtRange = { start, end };
      }
    }
    // Note: we intentionally do not rely on a `yearMonth` field here because historical
    // tracking documents may lack it. Instead we filter by `createdAt` ranges above.

    const pageSize = this.pageSize;
    const fetchLimit = Math.max(page * pageSize, pageSize);
    const allRows = await this.fetchRowsFromCollection(trackingColName, filters, fetchLimit, updatedAtRange);

    this.totalCount.set(allRows.length);

    const startIndex = Math.max(0, (page - 1) * pageSize);
    const pageItems = allRows.slice(startIndex, startIndex + pageSize);
    this.rows.set(pageItems);
  } catch (e) {
    console.error('InventoryService.loadRowsForPeriod failed', e);
    this.rows.set([]);
    this.totalCount.set(0);
  } finally {
    this.isLoading.set(false);
  }
}

  async loadInventory(companyId: string, storeId: string, branchId: string) {
    try {
      const inventoryRef = collection(this.firestore, `companies/${companyId}/stores/${storeId}/branches/${branchId}/inventory`);
      const querySnapshot = await getDocs(inventoryRef as any);
      const inventory = querySnapshot.docs.map(d => ({ productId: d.id, ...(d.data() as any) } as InventoryItem));
      this.inventory.set(inventory);
    } catch (error) {
      console.error('Error loading inventory:', error);
      throw error;
    }
  }

  async updateStock(
    productId: string,
    quantity: number,
    companyId?: string,
    storeId?: string,
    branchId?: string,
    isIncrement: boolean = false
  ) {
    try {
      const safeCompanyId = companyId ?? '';
      const safeStoreId = storeId ?? '';
      const safeBranchId = branchId ?? '';

      const currentItem = this.inventory().find(item => item.productId === productId);
      const newQuantity = isIncrement ? (currentItem?.quantity || 0) + quantity : quantity;

      const updateData: any = {
        quantity: newQuantity,
        updatedAt: new Date()
      };

      const collectionPath = `companies/${safeCompanyId}/stores/${safeStoreId}/branches/${safeBranchId}/inventory`;

      if (!currentItem) {
        const newItem: InventoryItem = {
          productId,
          branchId: safeBranchId,
          storeId: safeStoreId,
          companyId: safeCompanyId,
          quantity: newQuantity,
          minStock: 10,
          maxStock: 100,
          lastRestocked: new Date(),
          updatedAt: new Date()
        };
        await this.offlineDocService.updateDocument(collectionPath, productId, newItem as any);
        this.inventory.update(items => [...items, newItem]);
      } else {
        await this.offlineDocService.updateDocument(collectionPath, productId, updateData as any);
        this.inventory.update(items => items.map(item => item.productId === productId ? { ...item, ...updateData } : item));
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  getProductStock(productId: string): number {
    const item = this.inventory().find(i => i.productId === productId);
    return item?.quantity || 0;
  }

  isInStock(productId: string): boolean {
    return this.getProductStock(productId) > 0;
  }

  getLowStockItems() {
    return this.lowStockItems();
  }

  getOutOfStockItems() {
    return this.outOfStockItems();
  }
}
