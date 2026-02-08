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
      // Use 'deductedAt' for inventoryDeductions, 'createdAt' for others
      const dateField = collectionName === 'inventoryDeductions' ? 'deductedAt' : 'createdAt';
      const q = query(col, ...baseFilters, orderBy(dateField, 'desc'), limit(fetchLimit));
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
   * Fetch rows from ordersSellingTracking collection (sales data)
   */
  async fetchRowsFromOrdersSellingTracking(
    baseFilters: any[] = [],
    fetchLimit: number = 1000,
    updatedAtRange?: { start?: Date | null; end?: Date | null }
  ): Promise<InventoryRow[]> {
    console.log('🟡 fetchRowsFromOrdersSellingTracking:', { filterCount: baseFilters.length, fetchLimit });
    const col = collection(this.firestore, 'ordersSellingTracking');
    const out: InventoryRow[] = [];
    try {
      // Only include completed status for sales
      const statusFilter = where('status', '==', 'completed');
      const q = query(col, statusFilter, ...baseFilters, orderBy('createdAt', 'desc'), limit(fetchLimit));
      const snaps = await getDocs(q as any);
      
      for (const s of snaps.docs) {
        const data: any = s.data() || {};
        const productId: string = data.productId;
        const quantity: number = Number(data.quantity || 0);
        const product = this.productService.getProduct(productId);

        const productCode = (product && product.productCode) ? product.productCode : (data.productCode || '');
        const sku = (product && product.skuId) ? product.skuId : (data.sku || '');

        // Use costPrice from the tracking document
        const costPrice = Number(data.costPrice || 0) || 0;
        const batchId: string | null = data.batchId ? String(data.batchId) : null;

        const sellingPrice = Number(data.sellingPrice || product?.sellingPrice || 0) || 0;
        const profitPerUnit = +(sellingPrice - costPrice);
        const totalGross = +(sellingPrice * quantity);
        const totalProfit = +(profitPerUnit * quantity);

        const outProductCode = (productCode && productCode.trim().length > 0) ? productCode : '';
        const outSku = (sku && sku.trim().length > 0) ? sku : '';
        const finalProductCode = outProductCode || outSku ? outProductCode : productId;

        // Extract date from createdAt
        let saleDate: Date | string | undefined = undefined;
        if (data.createdAt) {
          if (typeof data.createdAt === 'string') {
            saleDate = data.createdAt;
          } else if (data.createdAt instanceof Date) {
            saleDate = data.createdAt;
          } else if (typeof data.createdAt.toDate === 'function') {
            saleDate = data.createdAt.toDate();
          }
        }

        // Get user displayName from createdBy (uid)
        const performedBy = await this.getUserDisplayName(data.createdBy) || data.createdBy || '';

        out.push({
          invoiceNo: data.orderId || '',
          batchId,
          date: saleDate,
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
      console.warn('fetchRowsFromOrdersSellingTracking query failed, trying fallback:', err);
      // Fallback with simplified query
      const statusFilter = where('status', '==', 'completed');
      const fallbackQ = query(col, statusFilter, orderBy('createdAt', 'desc'), limit(fetchLimit));
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

        const costPrice = Number(data.costPrice || 0) || 0;
        const batchId: string | null = data.batchId ? String(data.batchId) : null;

        const sellingPrice = Number(data.sellingPrice || product?.sellingPrice || 0) || 0;
        const profitPerUnit = +(sellingPrice - costPrice);
        const totalGross = +(sellingPrice * quantity);
        const totalProfit = +(profitPerUnit * quantity);

        const outProductCode = (productCode && productCode.trim().length > 0) ? productCode : '';
        const outSku = (sku && sku.trim().length > 0) ? sku : '';
        const finalProductCode = outProductCode || outSku ? outProductCode : productId;

        let saleDate: Date | string | undefined = undefined;
        if (data.createdAt) {
          if (typeof data.createdAt === 'string') {
            saleDate = data.createdAt;
          } else if (data.createdAt instanceof Date) {
            saleDate = data.createdAt;
          } else if (typeof data.createdAt.toDate === 'function') {
            saleDate = data.createdAt.toDate();
          }
        }

        const performedBy = await this.getUserDisplayName(data.createdBy) || data.createdBy || '';

        out.push({
          invoiceNo: data.orderId || '',
          batchId,
          date: saleDate,
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
 * Load rows for a given period and page (fetches from both inventoryDeductions and ordersSellingTracking).
 */
async loadRowsForPeriod(period: string, page: number = 1, storeId?: string, companyId?: string): Promise<void> {
  this.isLoading.set(true);
  this.currentPage.set(page);

  try {
    const baseFilters: any[] = [];
    
    // Add store/company filters if provided
    if (storeId) {
      baseFilters.push(where('storeId', '==', storeId));
    }
    if (companyId) {
      baseFilters.push(where('companyId', '==', companyId));
    }
    const now = new Date();
    let updatedAtRange: { start?: Date | null; end?: Date | null } | undefined;

    // Handle month-based periods by calculating date range
    if (period === 'this_month' || period === 'previous_month') {
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
      updatedAtRange = { start, end };
      // Don't convert period - we'll handle it in the filter section below
    }
    
    // Note: we intentionally do not rely on a `yearMonth` field here because historical
    // tracking documents may lack it. Instead we filter by date ranges below.

    const pageSize = this.pageSize;
    const fetchLimit = Math.max(page * pageSize, pageSize);
    
    // Create separate filters for each collection since they use different date fields
    // inventoryDeductions uses 'deductedAt', ordersSellingTracking uses 'createdAt'
    const deductionFilters = [...baseFilters];
    const salesFilters = [...baseFilters];
    
    // Add date range filters with appropriate field names
    if (period === 'today' || period === 'yesterday') {
      let start: Date | null = null;
      let end: Date | null = null;
      if (period === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      }
      console.log(`📅 Filtering by ${period}:`, {
        period,
        start: start?.toISOString(),
        end: end?.toISOString(),
        startLocal: start?.toString(),
        endLocal: end?.toString()
      });
      if (start && end) {
        // inventoryDeductions uses 'deductedAt'
        deductionFilters.push(where('deductedAt', '>=', start));
        deductionFilters.push(where('deductedAt', '<=', end));
        // ordersSellingTracking uses 'createdAt'
        salesFilters.push(where('createdAt', '>=', start));
        salesFilters.push(where('createdAt', '<=', end));
        updatedAtRange = { start, end };
      }
    } else if (period === 'this_month' || period === 'previous_month') {
      // Use the date range calculated above
      if (updatedAtRange?.start && updatedAtRange?.end) {
        deductionFilters.push(where('deductedAt', '>=', updatedAtRange.start));
        deductionFilters.push(where('deductedAt', '<=', updatedAtRange.end));
        salesFilters.push(where('createdAt', '>=', updatedAtRange.start));
        salesFilters.push(where('createdAt', '<=', updatedAtRange.end));
      }
    } else if (period) {
      // For month/year periods, create date range
      let start: Date | null = null;
      let end: Date | null = null;
      
      if (period.includes('-')) {
        // Format: YYYY-MM or YYYY-MM-DD
        const [year, month] = period.split('-').map(Number);
        if (month) {
          start = new Date(year, month - 1, 1, 0, 0, 0, 0);
          end = new Date(year, month, 0, 23, 59, 59, 999);
        }
      }
      
      if (start && end) {
        deductionFilters.push(where('deductedAt', '>=', start));
        deductionFilters.push(where('deductedAt', '<=', end));
        salesFilters.push(where('createdAt', '>=', start));
        salesFilters.push(where('createdAt', '<=', end));
        updatedAtRange = { start, end };
      }
    }
    
    // Fetch from both collections with their respective filters
    const [deductionRows, salesRows] = await Promise.all([
      this.fetchRowsFromCollection('inventoryDeductions', deductionFilters, fetchLimit, updatedAtRange),
      this.fetchRowsFromOrdersSellingTracking(salesFilters, fetchLimit, updatedAtRange)
    ]);

    console.log(`📊 Query results for ${period}:`, {
      period,
      deductionRows: deductionRows.length,
      salesRows: salesRows.length,
      storeId,
      companyId
    });

    // Combine both arrays
    const allRows = [...deductionRows, ...salesRows];
    
    // Sort by date descending
    allRows.sort((a, b) => {
      const dateA = a.date ? (a.date instanceof Date ? a.date : new Date(a.date)) : new Date(0);
      const dateB = b.date ? (b.date instanceof Date ? b.date : new Date(b.date)) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    this.totalCount.set(allRows.length);

    const startIndex = Math.max(0, (page - 1) * pageSize);
    const pageItems = allRows.slice(startIndex, startIndex + pageSize);
    this.rows.set(pageItems);
  } catch (e) {
    console.error('InventoryService.loadRowsForPeriod failed:', e);
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
