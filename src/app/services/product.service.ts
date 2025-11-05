import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from '@angular/fire/firestore';
import { Product, ProductInventory } from '../interfaces/product.interface';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { IndexedDBService, OfflineProduct } from '../core/services/indexeddb.service';
import { LoggerService } from '@app/core/services/logger.service';
import { logFirestore } from '@app/core/utils/firestore-logger';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly products = signal<Product[]>([]);
  private readonly offlineDocService = inject(OfflineDocumentService);
  
  // Computed properties
  readonly totalProducts = computed(() => this.products().length);
  readonly activeProducts = computed(() => 
    this.products().filter(product => product.status === 'active')
  );
  readonly lowStockProducts = computed(() => 
    this.products().filter(product => product.totalStock <= 10)
  );
  readonly productsByCategory = computed(() => {
    const categoryMap = new Map<string, Product[]>();
    this.products().forEach(product => {
      const products = categoryMap.get(product.category) || [];
      products.push(product);
      categoryMap.set(product.category, products);
    });
    return categoryMap;
  });

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private securityService: FirestoreSecurityService,
    private logger: LoggerService,
    private http: HttpClient
    ,
    private indexedDb: IndexedDBService
  ) {}

  private transformFirestoreDoc(doc: any): Product {
    const data = doc.data();
    return {
      id: doc.id,
      uid: data['uid'] || '',  // Include UID field
      productName: data['productName'] || '',
      description: data['description'] || undefined,
      skuId: data['skuId'] || '',
      unitType: data['unitType'] || 'pieces',
      category: data['category'] || '',
      totalStock: data['totalStock'] || 0,
      sellingPrice: data['sellingPrice'] || 0,
      companyId: data['companyId'] || '',
      storeId: data['storeId'] || '',
      barcodeId: data['barcodeId'] || '',
      imageUrl: data['imageUrl'] || '',
  isFavorite: !!data['isFavorite'] || false,
      inventory: this.transformInventoryArray(data['inventory'] || []),
      
      // Tax and Discount Fields with defaults
      isVatApplicable: data['isVatApplicable'] || false,
      vatRate: data['vatRate'] || 0,
      hasDiscount: data['hasDiscount'] || false,
      discountType: data['discountType'] || 'percentage',
      discountValue: data['discountValue'] || 0,
      
  // Price and Quantity Tracking
  priceHistory: this.transformPriceHistory(data['priceHistory'] || []),
      
      status: data['status'] || 'active',
      createdAt: data['createdAt']?.toDate() || new Date(),
      updatedAt: data['updatedAt']?.toDate() || new Date(),
      lastUpdated: data['lastUpdated']?.toDate() || new Date()
    };
  }

  private transformPriceHistory(historyData: any[]): any[] {
    if (!Array.isArray(historyData)) return [];
    return historyData.map(item => ({
      oldPrice: item.oldPrice || 0,
      newPrice: item.newPrice || 0,
      changeType: item.changeType || 'initial',
      changeAmount: item.changeAmount || 0,
      changePercentage: item.changePercentage || 0,
      changedAt: item.changedAt?.toDate() || new Date(),
      changedBy: item.changedBy || '',
      changedByName: item.changedByName || '',
      reason: item.reason || '',
      batchId: item.batchId || undefined
    }));
  }

  private transformQuantityAdjustments(adjustmentsData: any[]): any[] {
    // quantityAdjustments removed from product documents. Keep method for backward compatibility but return empty.
    return [];
  }

  private transformInventoryArray(inventoryData: any[]): ProductInventory[] {
    return inventoryData.map(item => ({
      batchId: item.batchId || '',
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      costPrice: item.costPrice || 0,
      receivedAt: item.receivedAt?.toDate() || new Date(),
      expiryDate: item.expiryDate?.toDate() || undefined,
      supplier: item.supplier || undefined,
      status: item.status || 'active',
      unitType: item.unitType || 'pieces'
    }));
  }

  private async waitForAuth(): Promise<string> {
    return new Promise((resolve, reject) => {
      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      if (currentUser && currentPermission?.companyId) {
        resolve(currentPermission.companyId);
        return;
      }

      // Use effect to watch for auth changes
      let attempts = 0;
      const checkAuth = () => {
        const user = this.authService.getCurrentUser();
        const permission = this.authService.getCurrentPermission();
        if (user && permission?.companyId) {
          resolve(permission.companyId);
          return;
        }
        
        attempts++;
        if (attempts >= 50) { // 5 seconds with 100ms intervals
          reject(new Error('Authentication timeout'));
          return;
        }
        
        setTimeout(checkAuth, 100);
      };
      
      checkAuth();
    });
  }

  async loadProducts(storeId: string): Promise<void> {
    try {
      if (!storeId) {
        throw new Error('storeId is required for BigQuery products API');
      }
      // Use BigQuery API only - fallback disabled for testing
      await this.loadProductsFromBigQuery(storeId);
    } catch (error) {
      console.error('BigQuery products API failed:', error);
      // Attempt offline fallback: try to read products for the store from IndexedDB
      try {
        const offlineProducts = await this.indexedDb.getProductsByStore(storeId);
        if (offlineProducts && offlineProducts.length > 0) {
          // Map OfflineProduct to Product minimal shape
          const mapped = offlineProducts.map(p => ({
            id: p.id,
            productName: p.name,
            sellingPrice: p.price,
            category: p.category,
            totalStock: p.stock,
            barcodeId: p.barcode || '',
            imageUrl: p.image || '',
            storeId: p.storeId,
            createdAt: p.lastUpdated || new Date(),
            updatedAt: p.lastUpdated || new Date(),
            uid: '',
            status: 'active'
          } as Product));
      this.products.set(this.normalizeAndDeduplicateProducts(mapped));
          return;
        }
      } catch (fallbackError) {
        console.warn('Failed to load products from IndexedDB fallback:', fallbackError);
      }

      throw error;
    }
  }

  private async loadProductsFromBigQuery(storeId: string): Promise<void> {
    try {
      if (!storeId) {
        throw new Error('storeId is required for BigQuery products API');
      }

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      console.log('🔐 Current User:', { uid: currentUser.uid, email: currentUser.email });
      console.log('🏪 Store ID:', storeId);

      // Get Firebase ID token for authentication (same pattern as OrderService)
      const idToken = await this.authService.getFirebaseIdToken();
      console.log('🔐 Firebase ID token status:', {
        hasToken: !!idToken,
        tokenLength: idToken?.length || 0,
        tokenStart: idToken ? idToken.substring(0, 10) + '...' : 'null',
        currentUser: this.authService.getCurrentUser()?.email || 'null',
        authStatus: 'logged in: ' + !!this.authService.getCurrentUser()
      });

      // Check if user is signed in at all
      if (!currentUser) {
        console.error('❌ User is not signed in - cannot load products');
        throw new Error('User not authenticated');
      }
      
      if (!idToken) {
        console.error('❌ No Firebase ID token available for API authentication');
        console.error('❌ User is signed in but token is null - possible token refresh issue');
        
        // Try to force refresh the token (same as OrderService)
        try {
          console.log('🔄 Attempting to force refresh Firebase ID token...');
          const refreshedToken = await this.authService.getFirebaseIdToken(true);
          if (refreshedToken) {
            console.log('✅ Token refresh successful, retrying API call...');
            // Retry with refreshed token
            return await this.loadProductsFromBigQuery(storeId);
          }
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
        }
        
        throw new Error('No Firebase ID token available');
      }

      // Build query parameters
      const params = new URLSearchParams({
        storeId: storeId, // Required parameter
        limit: '100' // Default limit
      });

      // Make API call to BigQuery Cloud Function
      const url = `${environment.api.productsApi}?${params}`;
      console.log('🌐 API URL:', url);
      
      // Use same header pattern as OrderService (plain object, not HttpHeaders)
      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add Authorization header with Firebase ID token
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
        console.log('🔐 Added Firebase ID token to Authorization header');
      }

      console.log('📡 Request Headers:', {
        'Authorization': `Bearer ${idToken.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      });

      const response = await this.http.get<any>(url, { headers }).toPromise();
      
      console.log('📦 BigQuery Response:', response);
      console.log('📦 Response type:', typeof response);
      console.log('📦 Response keys:', Object.keys(response || {}));
      
      // Transform BigQuery response to Product interface
  const products: Product[] = (response?.products || response || []).map((item: any) => this.transformBigQueryProduct(item));
      
  this.products.set(this.normalizeAndDeduplicateProducts(products));

      // Persist a simplified offline copy to IndexedDB for fallback
      try {
        const offlineArr: OfflineProduct[] = products.map(p => ({
          id: p.id || '',
          name: p.productName,
          price: Number(p.sellingPrice || 0),
          category: p.category || '',
          stock: Number(p.totalStock || 0),
          barcode: p.barcodeId || undefined,
          image: p.imageUrl || undefined,
          storeId: p.storeId || storeId,
          lastUpdated: p.lastUpdated || new Date()
        }));
        await this.indexedDb.saveProducts(offlineArr);
      } catch (e) {
        console.warn('Failed to persist products snapshot to IndexedDB:', e);
      }
      console.log(`✅ Loaded ${products.length} products from BigQuery API`);
    } catch (error: any) {
      console.error('❌ Error loading products from BigQuery:', error);
      console.error('❌ Error status:', error.status);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error details:', error.error);
      
      if (error.status === 401) {
        console.error('🚫 AUTHENTICATION FAILED - Check:');
        console.error('   1. Firebase ID token is valid');
        console.error('   2. Cloud Function validates Bearer token');
        console.error('   3. Firebase Admin SDK is initialized in Cloud Function');
      }
      
      throw error;
    }
  }

  private transformBigQueryProduct(item: any): Product {
    return {
      id: item.id || item.productId || '',
      uid: item.uid || '',
      productName: item.productName || item.name || '',
      description: item.description || undefined,
      skuId: item.skuId || item.sku || '',
      unitType: item.unitType || 'pieces',
      category: item.category || '',
      totalStock: Number(item.totalStock || item.stock || 0),
      sellingPrice: Number(item.sellingPrice || item.unitPrice || 0),
      companyId: item.companyId || '',
      storeId: item.storeId || '',
      barcodeId: item.barcodeId || item.barcode || '',
      imageUrl: item.imageUrl || '',
      isFavorite: !!item.isFavorite || false,
      inventory: this.transformInventoryArray(item.inventory || []),
      
      // Tax and Discount Fields with defaults
      isVatApplicable: item.isVatApplicable || false,
      vatRate: item.vatRate || 0,
      hasDiscount: item.hasDiscount || false,
      discountType: item.discountType || 'percentage',
      discountValue: item.discountValue || 0,
      
  // Price and Quantity Tracking
  priceHistory: this.transformPriceHistory(item.priceHistory || []),
      
      status: item.status || 'active',
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      lastUpdated: item.lastUpdated ? new Date(item.lastUpdated) : new Date()
    };
  }

  private async loadProductsFromFirestore(storeId?: string): Promise<void> {
    try {
      // Only check authentication, no UID filtering needed for reading
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const companyId = await this.waitForAuth();
      // Reduced noisy console logs; rely on logger when needed

      const productsRef = collection(this.firestore, 'products');
      
      let q;
      if (storeId) {
        q = query(productsRef, 
          where('companyId', '==', companyId),
          where('storeId', '==', storeId)
        );
      } else {
        q = query(productsRef, where('companyId', '==', companyId));
      }
      
  const querySnapshot = await getDocs(q);
  const products = querySnapshot.docs.map(doc => this.transformFirestoreDoc(doc));
      
  this.products.set(this.normalizeAndDeduplicateProducts(products));
    } catch (error) {
      console.error('Error loading products from Firestore:', error);
      throw error;
    }
  }
async loadProductsByCompanyAndStore(companyId?: string, storeId?: string): Promise<void> {
    try {
      // Use BigQuery API only - fallback disabled for testing
      await this.loadProductsByCompanyAndStoreFromBigQuery(companyId, storeId);
    } catch (error) {
      console.error('BigQuery products API failed:', error);
      throw error;
    }
  }

  private async loadProductsByCompanyAndStoreFromBigQuery(companyId?: string, storeId?: string): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      console.log('🔐 Company/Store Query - Current User:', { uid: currentUser.uid, email: currentUser.email });

      // Get Firebase ID token for authentication
      const token = await this.authService.getFirebaseIdToken();
      if (!token) {
        throw new Error('No Firebase ID token available');
      }

      console.log('🎫 Company/Store Query - Token exists:', !!token);

      // Build query parameters
      const params = new URLSearchParams({
        limit: '100' // Default limit
      });
      
      if (companyId) {
        params.set('companyId', companyId);
      }
      
      if (storeId) {
        params.set('storeId', storeId);
      }

      // Make API call to BigQuery Cloud Function
      const url = `${environment.api.productsApi}?${params}`;
      console.log('🌐 Company/Store API URL:', url);
      
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      const response = await this.http.get<any>(url, { headers }).toPromise();
      
      // Transform BigQuery response to Product interface
  const products: Product[] = (response?.products || response || []).map((item: any) => this.transformBigQueryProduct(item));
      
  // Validate that we actually have products before setting
  if (products.length === 0) {
        console.warn('⚠️ No products found for BigQuery query:', { companyId, storeId });
        console.warn('⚠️ This could be due to:');
        console.warn('   1. No products exist for this company/store in BigQuery');
        console.warn('   2. Company/store IDs do not match BigQuery records');
        console.warn('   3. User needs to create products first');
      }
      
  this.products.set(this.normalizeAndDeduplicateProducts(products));
      console.log(`✅ Loaded ${products.length} products from BigQuery API`);
    } catch (error) {
      console.error('Error loading products from BigQuery:', error);
      throw error;
    }
  }

  private async loadProductsByCompanyAndStoreFromFirestore(companyId?: string, storeId?: string): Promise<void> {
    try {
      // Only check authentication, no UID filtering needed for reading
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Use provided companyId or get from auth
      const targetCompanyId = companyId || await this.waitForAuth();
      
      // Reduced noisy console logs; rely on logger when needed
      
      const productsRef = collection(this.firestore, 'products');
      
      let q;
      if (storeId) {
        // Load products for specific company and store
        q = query(productsRef, 
          where('companyId', '==', targetCompanyId),
          where('storeId', '==', storeId)
        );
        
      } else {
        // Load all products for the company
        q = query(productsRef, where('companyId', '==', targetCompanyId));
        
      }
      
      const querySnapshot = await getDocs(q);
      const products = querySnapshot.docs.map(doc => this.transformFirestoreDoc(doc));
      
      
      
      // Validate that we actually have products before setting
      if (products.length === 0) {
        console.warn('⚠️ No products found for company-based query:', { companyId: targetCompanyId, storeId });
        console.warn('⚠️ This could be due to:');
        console.warn('   1. No products exist for this company/store');
        console.warn('   2. Company/store IDs do not match database records');
        console.warn('   3. User needs to create products first');
      }
      
  this.products.set(this.normalizeAndDeduplicateProducts(products));
    } catch (error) {
      console.error('❌ Error loading products:', error);
      throw error;
    }
  }
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Get current user for UID
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const companyId = await this.waitForAuth();
      
      // Clean undefined values that Firestore doesn't accept
      const invArr = Array.isArray((productData as any).inventory) ? (productData as any).inventory : [];
      const baseData: any = this.cleanUndefinedValues({
        ...productData,
        uid: currentUser.uid,  // Add UID for security rules
        companyId,
        status: productData.status || 'active'
      });

      // Only include inventory if provided (legacy support); otherwise omit
      if (invArr.length > 0) {
        baseData.inventory = invArr.map((inv: any) => ({
          ...this.cleanUndefinedValues(inv),
          receivedAt: Timestamp.fromDate(inv.receivedAt)
        }));
      }

      const cleanedProductData = baseData;

      // 🔥 NEW APPROACH: Pre-generate documentId, then create with that ID (with structured logging)
      const documentId = await logFirestore(this.logger, {
        api: 'firestore.add',
        area: 'products',
        collectionPath: 'products',
        companyId
      }, cleanedProductData, async () => {
        return this.offlineDocService.createDocument('products', cleanedProductData);
      });

      // If the product includes initial inventory batches (legacy support) or has an initial totalStock,
      // create corresponding `productInventoryEntries` so FIFO/batch-based inventory is authoritative.
      try {
        const initialBatches = Array.isArray(invArr) && invArr.length > 0
          ? invArr
          : (cleanedProductData.totalStock && Number(cleanedProductData.totalStock) > 0)
            ? [{ batchId: undefined, quantity: Number(cleanedProductData.totalStock), unitPrice: cleanedProductData.costPrice || cleanedProductData.sellingPrice || 0, receivedAt: new Date() }]
            : [];

        for (const b of initialBatches) {
          const batchData: any = {
            productId: documentId,
            productName: cleanedProductData.productName || (productData as any).productName || '',
            companyId: companyId,
            storeId: (productData as any).storeId || cleanedProductData.storeId || '',
            batchNumber: (b.batchNumber as any) || undefined,
            quantity: Number(b.quantity || 0),
            unitPrice: Number(b.unitPrice || 0),
            costPrice: Number(b.costPrice || 0) || Number(b.unitPrice || 0),
            receivedAt: b.receivedAt instanceof Date ? b.receivedAt : new Date(b.receivedAt || new Date()),
            expiryDate: b.expiryDate ? (b.expiryDate instanceof Date ? b.expiryDate : new Date(b.expiryDate)) : null,
            supplier: b.supplier || null,
            status: 'active',
            totalDeducted: 0,
            deductionHistory: []
          };

          // Create inventory entry and then set its batchId field to the returned id so other code expecting
          // batch.batchId will match the document id.
          const createdBatchId = await this.offlineDocService.createDocument('productInventoryEntries', batchData);
          try {
            await this.offlineDocService.updateDocument('productInventoryEntries', createdBatchId, { batchId: createdBatchId });
          } catch (uErr) {
            console.warn('Failed to set batchId on created inventory entry:', createdBatchId, uErr);
          }
        }
      } catch (inventoryErr) {
        console.warn('Failed to create initial productInventoryEntries for product:', documentId, inventoryErr);
      }

      // Update the signal with the new product (works with both real and temp IDs)
      // Avoid creating duplicates in the local signal: if a product with the same SKU exists for the same store,
      // update it instead of adding a new row. This prevents the UI from showing duplicate entries when
      // temporary/local copies are reconciled with server IDs.
      const newLocalProd: Product = {
        ...productData,
        id: documentId,
        uid: currentUser.uid,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfflineCreated: documentId.startsWith('temp_')
      } as Product;

      this.products.update(products => {
        const existingIdx = products.findIndex(p => p.skuId === newLocalProd.skuId && p.storeId === newLocalProd.storeId);
        if (existingIdx >= 0) {
          const copy = products.slice();
          copy[existingIdx] = { ...copy[existingIdx], ...newLocalProd };
          return copy;
        }
        return [...products, newLocalProd];
      });
      
      return documentId;
    } catch (error) {
      this.logger.dbFailure('Create product failed', { api: 'firestore.add', area: 'products', collectionPath: 'products' }, error);
      throw error;
    }
  }

  async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    try {
      // Get current user ID
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Prepare update data with proper Timestamp conversion
      const updateData: any = { ...updates };

      // Ensure UID is maintained for security rules
      updateData.uid = currentUser.uid;

      // Handle inventory array updates
      if (updates.inventory) {
        updateData.inventory = updates.inventory.map(inv => ({
          batchId: inv.batchId,
          quantity: inv.quantity,
          unitPrice: inv.unitPrice,
          costPrice: inv.costPrice || 0,
          receivedAt: Timestamp.fromDate(inv.receivedAt instanceof Date ? inv.receivedAt : new Date(inv.receivedAt)),
          expiryDate: inv.expiryDate ? Timestamp.fromDate(inv.expiryDate instanceof Date ? inv.expiryDate : new Date(inv.expiryDate)) : null,
          supplier: inv.supplier || null,
          status: inv.status,
          unitType: inv.unitType || 'pieces'
        }));
      }

      // Clean undefined values to prevent Firestore errors
      const cleanedUpdateData = this.cleanUndefinedValues(updateData);

      // 🔥 NEW APPROACH: Use OfflineDocumentService for consistent online/offline updates (with structured logging)
      await logFirestore(this.logger, {
        api: 'firestore.update',
        area: 'products',
        collectionPath: 'products',
        docId: productId,
        companyId: updates.companyId
      }, cleanedUpdateData, async () => {
        await this.offlineDocService.updateDocument('products', productId, cleanedUpdateData);
        return true;
      });

      // Update the signal
      this.products.update(products =>
        products.map(product =>
          product.id === productId
            ? { ...product, ...updates, updatedAt: new Date() }
            : product
        )
      );

    } catch (error) {
      this.logger.dbFailure('Update product failed', { api: 'firestore.update', area: 'products', collectionPath: 'products', docId: productId }, error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      const productRef = doc(this.firestore, 'products', productId);
      await logFirestore(this.logger, {
        api: 'firestore.delete',
        area: 'products',
        collectionPath: 'products',
        docId: productId
      }, { productId }, async () => {
        await this.offlineDocService.deleteDocument('products', productId);
        return true;
      });

      // Update the signal
      this.products.update(products =>
        products.filter(product => product.id !== productId)
      );
    } catch (error) {
      this.logger.dbFailure('Delete product failed', { api: 'firestore.delete', area: 'products', collectionPath: 'products', docId: productId }, error);
      throw error;
    }
  }

  // Inventory management methods
  async updateProductStock(productId: string, newStock: number): Promise<void> {
    await this.updateProduct(productId, { totalStock: newStock });
  }

  /**
   * Adjust product totalStock by a delta (positive or negative)
   * Clamps at 0 to avoid negative stock. Updates lastUpdated timestamp.
   */
  async adjustTotalStockDelta(productId: string, delta: number): Promise<void> {
    const product = this.getProduct(productId);
    const current = product?.totalStock ?? 0;
    const newTotal = Math.max(0, current + delta);
    await this.updateProduct(productId, { totalStock: newTotal, lastUpdated: new Date() } as any);
  }

  // (Removed) Embedded inventory add/update/remove methods — replaced by InventoryDataService in separate collection

  // Getter methods
  getProducts(): Product[] {
    return this.products();
  }

  getProductsByCategory(category: string): Product[] {
    return this.products().filter(product => product.category === category);
  }

  getProduct(productId: string): Product | undefined {
    return this.products().find(product => product.id === productId);
  }

  getProductBySku(sku: string): Product | undefined {
    return this.products().find(product => product.skuId === sku);
  }

  getProductByBarcode(barcode: string): Product | undefined {
    return this.products().find(product => product.barcodeId === barcode);
  }

  searchProducts(searchTerm: string): Product[] {
    const term = searchTerm.toLowerCase();
    return this.products().filter(product => 
      product.productName.toLowerCase().includes(term) ||
      product.skuId.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term) ||
      product.barcodeId?.toLowerCase().includes(term)
    );
  }

  getCategories(): string[] {
    const categories = new Set(this.products().map(p => p.category));
    return Array.from(categories).sort();
  }

  // ============================================
  // PRICE AND QUANTITY TRACKING METHODS
  // ============================================

  /**
   * Update product price and log the change
   */
  async updateProductPrice(
    productId: string, 
    newPrice: number, 
    reason?: string, 
    batchId?: string
  ): Promise<void> {
    try {
      const product = this.getProduct(productId);
      if (!product) throw new Error('Product not found');

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');

      const oldPrice = batchId 
        ? (product.inventory?.find(inv => inv.batchId === batchId)?.unitPrice || 0)
        : product.sellingPrice;

      const changeAmount = newPrice - oldPrice;
      const changePercentage = oldPrice > 0 ? (changeAmount / oldPrice) * 100 : 0;
      const changeType = changeAmount > 0 ? 'increase' : changeAmount < 0 ? 'decrease' : 'initial';

      const priceChange = {
        oldPrice,
        newPrice,
        changeType: changeType as 'increase' | 'decrease' | 'initial',
        changeAmount,
        changePercentage,
        changedAt: new Date(),
        changedBy: currentUser.uid,
        changedByName: currentUser.displayName || currentUser.email || 'Unknown',
        reason: reason || 'Manual price update',
        batchId: batchId || undefined
      };

      const currentHistory = product.priceHistory || [];
      const updatedHistory = [...currentHistory, priceChange];

      if (batchId) {
        // Update batch price
        const updatedInventory = (product.inventory ?? []).map(inv => 
          inv.batchId === batchId ? { ...inv, unitPrice: newPrice } : inv
        );
        await this.updateProduct(productId, {
          inventory: updatedInventory,
          priceHistory: updatedHistory,
          lastUpdated: new Date()
        });
      } else {
        // Update main selling price
        await this.updateProduct(productId, {
          sellingPrice: newPrice,
          priceHistory: updatedHistory,
          lastUpdated: new Date()
        });
      }

      this.logger.dbSuccess('Product price updated', { api: 'firestore.update', area: 'products', collectionPath: 'products', docId: productId, payload: priceChange });
    } catch (error) {
      this.logger.dbFailure('Error updating product price', { api: 'firestore.update', area: 'products', collectionPath: 'products', docId: productId }, error);
      throw error;
    }
  }

  /**
   * Adjust batch quantity and log the change
   */
  async adjustBatchQuantity(
    productId: string,
    batchId: string,
    newQuantity: number,
    adjustmentType: 'manual' | 'sale' | 'return' | 'damage' | 'restock' | 'transfer',
    reason?: string,
    notes?: string
  ): Promise<void> {
    try {
      const product = this.getProduct(productId);
      if (!product) throw new Error('Product not found');

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');

  const batch = (product.inventory ?? []).find(inv => inv.batchId === batchId);
      if (!batch) throw new Error('Batch not found');

      const oldQuantity = batch.quantity;

      const quantityAdjustment = {
        batchId,
        oldQuantity,
        newQuantity,
        adjustmentType: adjustmentType as 'manual' | 'sale' | 'return' | 'damage' | 'restock' | 'transfer',
        adjustedAt: new Date(),
        adjustedBy: currentUser.uid,
        adjustedByName: currentUser.displayName || currentUser.email || 'Unknown',
        reason: reason || `${adjustmentType} adjustment`,
        notes: notes || ''
      };


      // Update batch quantity
      const updatedInventory = (product.inventory ?? []).map(inv =>
        inv.batchId === batchId ? { ...inv, quantity: newQuantity } : inv
      );

      // Recalculate total stock from active batches
      const totalStock = updatedInventory.reduce(
        (sum, inv) => sum + (inv.status === 'active' ? inv.quantity : 0), 
        0
      );

      await this.updateProduct(productId, {
        inventory: updatedInventory,
        totalStock,
        lastUpdated: new Date()
      });

      this.logger.dbSuccess('Product quantity adjusted', { api: 'firestore.update', area: 'products', collectionPath: 'products', docId: productId, payload: quantityAdjustment });
    } catch (error) {
      this.logger.dbFailure('Error adjusting product quantity', { api: 'firestore.update', area: 'products', collectionPath: 'products', docId: productId }, error);
      throw error;
    }
  }

  /**
   * Split batch: reduce quantity from existing batch and create new batch
   * Example: "Move 40 units from batch A to new batch B at new price"
   */
  async splitBatch(
    productId: string,
    sourceBatchId: string,
    quantityToMove: number,
    newBatchPrice: number,
    reason?: string
  ): Promise<void> {
    try {
      const product = this.getProduct(productId);
      if (!product) throw new Error('Product not found');

  const sourceBatch = (product.inventory ?? []).find(inv => inv.batchId === sourceBatchId);
      if (!sourceBatch) throw new Error('Source batch not found');

      if (quantityToMove > sourceBatch.quantity) {
        throw new Error('Cannot move more quantity than available in source batch');
      }

      // Step 1: Reduce quantity in source batch
      const newSourceQuantity = sourceBatch.quantity - quantityToMove;
      await this.adjustBatchQuantity(
        productId,
        sourceBatchId,
        newSourceQuantity,
        'transfer',
        reason || `Moved ${quantityToMove} units to new batch at updated price`,
        `Split from batch ${sourceBatchId}`
      );

      // Step 2: Create new batch
      const newBatchId = `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString().slice(-2)}`;
      const newBatch: ProductInventory = {
        batchId: newBatchId,
        quantity: quantityToMove,
        unitPrice: newBatchPrice,
        costPrice: sourceBatch.costPrice, // Keep same cost price
        receivedAt: new Date(),
        expiryDate: sourceBatch.expiryDate,
        supplier: sourceBatch.supplier,
        status: 'active'
      };

      // This method still references old embedded inventory - needs refactoring to use InventoryDataService
      console.warn('splitBatch method needs to be refactored to use InventoryDataService');
      throw new Error('splitBatch method is deprecated and needs refactoring for separate inventory collection');

      console.log(`✅ Batch split: ${quantityToMove} units moved from ${sourceBatchId} to ${newBatchId}`);
    } catch (error) {
      console.error('❌ Error splitting batch:', error);
      throw error;
    }
  }

  /**
   * Get price history for a product
   */
  getPriceHistory(productId: string) {
    const product = this.getProduct(productId);
    return product?.priceHistory || [];
  }

  /**
   * Get quantity adjustment history for a product
   */
  getQuantityAdjustments(productId: string) {
    // quantityAdjustments removed from product docs; return empty list for compatibility
    return [] as any[];
  }

  /**
   * Get quantity adjustments for a specific batch
   */
  getBatchAdjustments(productId: string, batchId: string) {
    // No embedded adjustments stored on products anymore
    return [] as any[];
  }

  /**
   * Clean undefined values from an object to make it Firestore-compatible
   */
  private cleanUndefinedValues<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;
    const out: any = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach((k) => {
      const v = (obj as any)[k];
      if (v === undefined) return;
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        out[k] = this.cleanUndefinedValues(v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }
  
  /**
   * Normalize and deduplicate an array of products before applying to the local signal.
   * Deduplication key prefers explicit document id when present, otherwise falls back to
   * a composite of storeId, skuId, barcodeId and productName. When duplicates are found,
   * prefer the item with an explicit id and the newest updatedAt timestamp.
   */
  private normalizeAndDeduplicateProducts(products: Product[]): Product[] {
    if (!Array.isArray(products)) return [];
    const map = new Map<string, Product>();
    for (const p of products) {
      const idKey = p?.id && String(p.id).trim() ? `id:${p.id}` : null;
      const sku = p?.skuId || '';
      const barcode = p?.barcodeId || '';
      const store = p?.storeId || '';
      const name = (p?.productName || '').trim().toLowerCase();
      const fallbackKey = `k:${store}::${sku}::${barcode}::${name}`;
      const key = idKey || fallbackKey;

      const existing = map.get(key);
      // normalize date fields to Date objects when possible
      const normalized: Product = {
        ...p,
        createdAt: p?.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p?.updatedAt ? new Date(p.updatedAt) : (p?.lastUpdated ? new Date(p.lastUpdated) : new Date()),
        lastUpdated: p?.lastUpdated ? new Date(p.lastUpdated) : (p?.updatedAt ? new Date(p.updatedAt) : new Date())
      } as Product;

      if (!existing) {
        map.set(key, normalized);
        continue;
      }

      // prefer records with real server id over temp ids
      const existingHasRealId = existing.id && !String(existing.id).startsWith('temp_');
      const incomingHasRealId = normalized.id && !String(normalized.id).startsWith('temp_');
      if (incomingHasRealId && !existingHasRealId) {
        map.set(key, { ...existing, ...normalized });
        continue;
      }

      // otherwise prefer the most recently updated record
      const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const incomingTime = normalized.updatedAt ? new Date(normalized.updatedAt).getTime() : 0;
      if (incomingTime >= existingTime) {
        map.set(key, { ...existing, ...normalized });
      }
    }
    return Array.from(map.values());
  }
  // Inventory is now managed in productInventory collection. Keep a helper for summary updates if needed by other services.
  async setInventorySummary(productId: string, totalStock: number, sellingPrice: number): Promise<void> {
    await this.updateProduct(productId, { totalStock, sellingPrice });
  }

  /**
   * Apply a local-only patch to the product signal without performing a Firestore write.
   * Useful when another transaction already updated the backend and we just need
   * to keep the UI in sync immediately.
   */
  applyLocalPatch(productId: string, updates: Partial<Product>): void {
    try {
      this.products.update(products =>
        products.map(product =>
          product.id === productId ? { ...product, ...updates } : product
        )
      );
    } catch (e) {
      console.warn('Failed to apply local product patch:', e);
    }
  }

  // Legacy no-op implementations to avoid breaking callers; will be removed after UI refactor.
  async addInventoryBatch(productId: string, _batch: ProductInventory): Promise<void> {
    console.warn('addInventoryBatch is deprecated. Use InventoryDataService.addBatch instead.');
    // No-op
  }

  async updateInventoryBatch(productId: string, _batchId: string, _updatedBatch: ProductInventory): Promise<void> {
    console.warn('updateInventoryBatch is deprecated. Use InventoryDataService.updateBatch instead.');
    // No-op
  }

  async removeInventoryBatch(productId: string, _batchId: string): Promise<void> {
    console.warn('removeInventoryBatch is deprecated. Use InventoryDataService.removeBatch instead.');
    // No-op
  }
}
