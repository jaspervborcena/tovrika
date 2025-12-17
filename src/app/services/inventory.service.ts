import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit
} from '@angular/fire/firestore';
import { getDocs, getAggregateFromServer, count } from 'firebase/firestore';
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

  constructor() {}

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
      const q = query(col, ...baseFilters, orderBy('updatedAt', 'desc'), limit(fetchLimit));
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

      // Extract date and performedBy from deduction data
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

      const performedBy = data.deductedBy || '';

      out.push({
        invoiceNo: data.orderId || data.invoiceNumber || '',
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
      // Attempt to use the first filter (commonly status equality) and order by updatedAt
      const fallbackFilters = baseFilters && baseFilters.length > 0 ? [baseFilters[0]] : [];
      const fallbackQ = query(col, ...fallbackFilters, orderBy('updatedAt', 'desc'), limit(fetchLimit));
      const snapsFallback = await getDocs(fallbackQ as any);
      for (const s of snapsFallback.docs) {
        const data: any = s.data() || {};
          // if updatedAtRange provided, enforce it client-side
          if (updatedAtRange && (updatedAtRange.start || updatedAtRange.end)) {
            const ua = data.updatedAt;
            let updatedAtDate: Date | null = null;
            if (!ua) continue;
            if (typeof ua.toDate === 'function') updatedAtDate = ua.toDate();
            else if (ua instanceof Date) updatedAtDate = ua as Date;
            else updatedAtDate = new Date(ua);
            if (!updatedAtDate) continue;
            if (updatedAtRange.start && updatedAtDate < updatedAtRange.start) continue;
            if (updatedAtRange.end && updatedAtDate > updatedAtRange.end) continue;
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

        // Extract date and performedBy from deduction data
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

        const performedBy = data.deductedBy || '';

        out.push({
          invoiceNo: data.orderId || data.invoiceNumber || '',
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
      filters.push(where('updatedAt', '>=', start));
      filters.push(where('updatedAt', '<=', end));
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
        filters.push(where('updatedAt', '>=', start));
        filters.push(where('updatedAt', '<=', end));
        updatedAtRange = { start, end };
      }
    }
    // Note: we intentionally do not rely on a `yearMonth` field here because historical
    // tracking documents may lack it. Instead we filter by `updatedAt` ranges above.

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
