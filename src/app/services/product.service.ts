import { Injectable, computed, signal, inject, OnDestroy } from '@angular/core';
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
  onSnapshot,
  orderBy,
  limit,
  enableNetwork,
  disableNetwork,
  connectFirestoreEmulator,
  runTransaction,
  Timestamp,
  Unsubscribe,
  DocumentChange,
  QuerySnapshot,
  DocumentSnapshot 
} from '@angular/fire/firestore';
import { Product, ProductInventory, ProductStatus } from '../interfaces/product.interface';
import { AuthService } from './auth.service';
import { LoggerService } from '../core/services/logger.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

interface ProductCacheState {
  products: Product[];
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  isOnline: boolean;
  hasInitialLoad: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService implements OnDestroy {
  private readonly offlineDocService = inject(OfflineDocumentService);
  private logger = inject(LoggerService);
  
  // Signal-based reactive cache
  private readonly cacheState = signal<ProductCacheState>({
    products: [],
    isLoading: false,
    lastUpdated: null,
    error: null,
    isOnline: navigator.onLine,
    hasInitialLoad: false
  });

  // Real-time subscription management
  private unsubscribeSnapshot: Unsubscribe | null = null;
  private currentStoreId: string | null = null;
  private currentCompanyId: string | null = null;

  // Network status tracking
  private isOnline = navigator.onLine;

  // Computed properties - reactive access to cache
  readonly products = computed(() => {
    const products = this.cacheState().products;
    console.log('📊 Products signal computed:', { 
      count: products.length, 
      firstFew: products.slice(0, 3).map(p => ({ id: p.id, name: p.productName }))
    });
    return products;
  });
  readonly isLoading = computed(() => {
    const loading = this.cacheState().isLoading;
    console.log('⏳ Loading signal computed:', loading);
    return loading;
  });
  readonly lastUpdated = computed(() => this.cacheState().lastUpdated);
  readonly error = computed(() => this.cacheState().error);
  readonly hasInitialLoad = computed(() => this.cacheState().hasInitialLoad);
  readonly isOnlineStatus = computed(() => this.cacheState().isOnline);

  // Computed derived data
  readonly totalProducts = computed(() => this.products().length);
  readonly activeProducts = computed(() => 
    this.products().filter(product => product.status === ProductStatus.Active)
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
  });  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.initializeNetworkMonitoring();
    this.initializeFirestorePersistence();
    
    // Add debug methods to global window for console testing
    (window as any).debugProducts = {
      load: (storeId?: string) => this.debugProductLoad(storeId),
      getProducts: () => this.getProducts(),
      getCount: () => this.products().length,
      getState: () => ({
        isLoading: this.isLoading(),
        hasInitialLoad: this.hasInitialLoad(),
        error: this.error(),
        currentStoreId: this.currentStoreId,
        productCount: this.products().length
      }),
      forceReload: (storeId?: string) => this.initializeProducts(storeId || this.currentStoreId || '', true),
      testFirestore: async () => {
        console.log('🧪 Testing basic Firestore connection...');
        try {
          const testRef = collection(this.firestore, 'products');
          const testQuery = query(testRef, limit(1));
          const testSnapshot = await getDocs(testQuery);
          console.log('✅ Firestore connection test successful!', {
            docs: testSnapshot.size,
            empty: testSnapshot.empty
          });
          return true;
        } catch (error) {
          console.error('❌ Firestore connection test failed:', error);
          return false;
        }
      },
      testQuery: async (companyId: string, storeId: string) => {
        console.log('🧪 Testing specific product query...', { companyId, storeId });
        try {
          const testRef = collection(this.firestore, 'products');
          const testQuery = query(
            testRef,
            where('companyId', '==', companyId),
            where('storeId', '==', storeId),
            limit(5)
          );
          const testSnapshot = await getDocs(testQuery);
          console.log('✅ Query test successful!', {
            docs: testSnapshot.size,
            empty: testSnapshot.empty,
            data: testSnapshot.docs.map(d => ({ id: d.id, data: d.data() }))
          });
          return testSnapshot.docs.map(d => d.data());
        } catch (error) {
          console.error('❌ Query test failed:', error);
          return null;
        }
      },
      testDirectLoad: async () => {
        console.log('🧪 Testing direct product load...');
        try {
          const currentUser = this.authService.getCurrentUser();
          if (!currentUser) {
            console.error('❌ No current user');
            return;
          }
          
          const permission = this.authService.getCurrentPermission();
          if (!permission) {
            console.error('❌ No current permission');
            return;
          }
          
          console.log('🔍 Using permission:', permission);
          if (permission.companyId && permission.storeId) {
            await this.loadProductsDirectly(permission.companyId, permission.storeId);
          } else {
            console.error('❌ Missing companyId or storeId in permission');
          }
        } catch (error) {
          console.error('❌ Direct load test failed:', error);
        }
      }
    };
    console.log('🐛 Debug methods available at window.debugProducts');
    console.log('🐛 Available methods: load, getProducts, getCount, getState, forceReload, testFirestore, testQuery');
  }

  ngOnDestroy(): void {
    this.unsubscribeFromRealTimeUpdates();
    this.removeNetworkListeners();
  }

  /**
   * Initialize network status monitoring
   */
  private initializeNetworkMonitoring(): void {
    // Update cache state when network status changes
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateCacheState({ isOnline: true });
      this.enableFirestoreNetwork();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateCacheState({ isOnline: false });
    });
  }

  /**
   * Remove network event listeners
   */
  private removeNetworkListeners(): void {
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});
  }

  /**
   * Initialize Firestore offline persistence
   */
  private async initializeFirestorePersistence(): Promise<void> {
    try {
      // Firestore persistence is automatically enabled in v9+
      // but we can control network state manually
      this.logger.debug('Firestore persistence initialized', { area: 'products' });
    } catch (error) {
      this.logger.warn('Firestore persistence setup failed', { area: 'products', payload: { error: String(error) } });
    }
  }

  /**
   * Enable Firestore network access
   */
  private async enableFirestoreNetwork(): Promise<void> {
    try {
      await enableNetwork(this.firestore);
      this.logger.debug('Firestore network enabled', { area: 'products' });
    } catch (error) {
      this.logger.warn('Failed to enable Firestore network', { area: 'products', payload: { error: String(error) } });
    }
  }

  /**
   * Disable Firestore network access (offline mode)
   */
  private async disableFirestoreNetwork(): Promise<void> {
    try {
      await disableNetwork(this.firestore);
      this.logger.debug('Firestore network disabled', { area: 'products' });
    } catch (error) {
      this.logger.warn('Failed to disable Firestore network', { area: 'products', payload: { error: String(error) } });
    }
  }

  /**
   * Update cache state
   */
  private updateCacheState(updates: Partial<ProductCacheState>): void {
    console.log('🔄 Updating cache state:', updates);
    this.cacheState.update(current => {
      const newState = { ...current, ...updates };
      console.log('📦 New cache state:', {
        productsCount: newState.products.length,
        isLoading: newState.isLoading,
        error: newState.error,
        hasInitialLoad: newState.hasInitialLoad
      });
      return newState;
    });
  }

  /**
   * Fallback method to load products without real-time listener
   */
  private async loadProductsDirectly(companyId: string, storeId: string): Promise<void> {
    try {
      console.log('🔄 Loading products directly (fallback method)...', { companyId, storeId });
      
      const productsRef = collection(this.firestore, 'products');
      
      // Use simple query first to avoid index requirements
      console.log('🔄 Using simple query without orderBy to avoid index requirements');
      let q;
      try {
        q = query(
          productsRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          where('status', '==', 'active'),
          limit(100)
        );
      } catch (queryError) {
        console.log('🔄 Fallback to minimal query');
        q = query(
          productsRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          where('status', '==', 'active'),
          limit(100)
        );
      }
      
      const snapshot = await getDocs(q);
      console.log('📊 Direct query results:', snapshot.size, 'products');
      
      if (!snapshot.empty) {
        const products: Product[] = [];
        snapshot.docs.forEach(doc => {
          const product = this.transformFirestoreDoc(doc);
          products.push(product);
        });
        
        // Sort products by name since we removed Firestore orderBy
        products.sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));
        
        console.log('✅ Direct load successful:', products.length, 'products');
        
        // Update cache with direct results
        this.updateCacheState({
          products: products,
          isLoading: false,
          lastUpdated: new Date(),
          error: null,
          hasInitialLoad: true
        });
      } else {
        console.log('📭 No products found with direct query');
        this.updateCacheState({
          products: [],
          isLoading: false,
          error: null,
          hasInitialLoad: true
        });
      }
      
    } catch (error) {
      console.error('❌ Direct load failed:', error);
      throw error;
    }
  }

  /**
   * Main method to load products with real-time updates
   * This replaces the old loadProducts method
   */
  async loadProductsRealTime(storeId: string, forceReload = false): Promise<void> {
    try {
      console.log('🔄 ProductService.loadProductsRealTime called', { storeId, forceReload });
      console.log('🔄 Current state:', { 
        currentStoreId: this.currentStoreId, 
        currentProducts: this.products().length,
        hasInitialLoad: this.hasInitialLoad()
      });
      
      if (!storeId) {
        throw new Error('storeId is required for loading products');
      }

      // Check if we already have this store loaded and don't need to reload
      if (!forceReload && this.currentStoreId === storeId && this.hasInitialLoad() && this.products().length > 0) {
        this.logger.debug('Products already loaded for store, skipping reload', { area: 'products', storeId });
        console.log('✅ Products already loaded for store, skipping reload', { 
          storeId, 
          currentProducts: this.products().length 
        });
        return;
      }

      console.log('🔄 Loading products because:', {
        forceReload,
        currentStoreId: this.currentStoreId,
        targetStoreId: storeId,
        hasInitialLoad: this.hasInitialLoad(),
        currentProductCount: this.products().length,
        needsLoad: !this.hasInitialLoad() || this.products().length === 0 || this.currentStoreId !== storeId
      });

      // Get authentication
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        console.log('❌ User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('🔑 Getting companyId from auth...');
      const companyId = await this.waitForAuth();
      console.log('🔑 Authentication details:', { 
        currentUser: currentUser.email, 
        companyId, 
        storeId,
        currentPermission: this.authService.getCurrentPermission()
      });
      
      // Unsubscribe from previous listener if exists
      this.unsubscribeFromRealTimeUpdates();
      
      // Update current store/company
      this.currentStoreId = storeId;
      this.currentCompanyId = companyId;

      // Set loading state
      this.updateCacheState({ 
        isLoading: true, 
        error: null 
      });

      // Setup real-time listener
      try {
        await this.setupRealtimeListener(companyId, storeId);
      } catch (listenerError) {
        console.error('❌ Real-time listener failed, trying direct load:', listenerError);
        
        // If listener setup fails due to assertion error, try direct load
        if (listenerError instanceof Error && listenerError.message.includes('INTERNAL ASSERTION FAILED')) {
          console.log('🔄 Firestore assertion failure detected, using direct load fallback');
          await this.loadProductsDirectly(companyId, storeId);
        } else {
          throw listenerError;
        }
      }

    } catch (error) {
      this.logger.dbFailure('Failed to setup real-time product loading', { area: 'products', storeId }, error);
      this.updateCacheState({ 
        isLoading: false, 
        error: String(error) 
      });
      
      console.log('❌ Product loading failed completely');
    }
  }

  /**
   * Setup Firestore real-time listener with onSnapshot
   */
  private async setupRealtimeListener(companyId: string, storeId: string): Promise<void> {
    try {
      console.log('🎯 Setting up Firestore real-time listener...', { companyId, storeId });
      
      // CRITICAL: Verify auth state before creating query
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Cannot setup listener - user not authenticated');
      }
      
      console.log('✅ Auth verified for listener setup:', {
        userEmail: currentUser.email,
        uid: currentUser.uid
      });
      
      // Ensure we clean up any existing listener first
      this.unsubscribeFromRealTimeUpdates();
      
      // Add a small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const productsRef = collection(this.firestore, 'products');
      
      // Create query with proper error handling - avoid orderBy to prevent index requirements
      console.log('🔧 Building Firestore query without orderBy to avoid index requirements...');
      let q;
      try {
        // Use simple query first - we'll sort in JavaScript
        q = query(
          productsRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          where('status', '==', 'active'),
          limit(100)
        );
        console.log('✅ Simple Firestore query created successfully');
      } catch (queryError) {
        console.error('❌ Error creating Firestore query:', queryError);
        // Even simpler fallback - just company and store
        q = query(
          productsRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          limit(100)
        );
        console.log('🔄 Using minimal fallback query');
      }

      console.log('🔍 Firestore query created:', {
        collection: 'products',
        filters: {
          companyId: companyId,
          storeId: storeId,
          status: 'active'
        },
        limit: 100
      });

      console.log('🔄 Setting up onSnapshot listener...');
      
      // Set up listener with better error handling
      this.unsubscribeSnapshot = onSnapshot(
        q,
        {
          includeMetadataChanges: false // Disable metadata changes to avoid assertion failures
        },
        (snapshot: QuerySnapshot) => {
          try {
            console.log('📨 onSnapshot callback triggered!', {
              size: snapshot.size,
              empty: snapshot.empty,
              fromCache: snapshot.metadata.fromCache,
              hasPendingWrites: snapshot.metadata.hasPendingWrites
            });
            this.handleSnapshotUpdate(snapshot);
          } catch (handlerError) {
            console.error('❌ Error in snapshot handler:', handlerError);
            this.updateCacheState({ 
              isLoading: false, 
              error: String(handlerError) 
            });
          }
        },
        (error) => {
          console.error('❌ Firestore snapshot listener error:', error);
          this.logger.dbFailure('Firestore snapshot listener error', { area: 'products', companyId, storeId }, error);
          
          // Try to recover by falling back to offline cache
          this.updateCacheState({ 
            isLoading: false, 
            error: String(error) 
          });
          
          console.log('❌ Real-time listener error, no offline fallback available');
        }
      );

      console.log('✅ Real-time listener setup complete', { companyId, storeId });
      this.logger.debug('Real-time listener setup complete', { area: 'products', companyId, storeId });

    } catch (error) {
      console.error('❌ Failed to setup real-time listener:', error);
      this.logger.dbFailure('Failed to setup real-time listener', { area: 'products', companyId, storeId }, error);
      
      console.log('❌ Real-time listener setup failed, Firestore offline persistence will handle caching');
      throw error;
    }
  }

  /**
   * Handle snapshot updates from Firestore onSnapshot
   */
  private handleSnapshotUpdate(snapshot: QuerySnapshot): void {
    try {
      const isFromCache = snapshot.metadata.fromCache;
      const hasPendingWrites = snapshot.metadata.hasPendingWrites;

      console.log('📨 Firestore snapshot update received', { 
        size: snapshot.size, 
        fromCache: isFromCache, 
        hasPendingWrites,
        isEmpty: snapshot.empty,
        docChanges: snapshot.docChanges().length
      });

      this.logger.debug('Snapshot update received', { 
        area: 'products', 
        payload: { 
          size: snapshot.size, 
          fromCache: isFromCache, 
          hasPendingWrites,
          isEmpty: snapshot.empty 
        } 
      });

      // Get current products from cache
      const currentProducts = [...this.products()];
      let updatedProducts = [...currentProducts];

      // Process document changes
      snapshot.docChanges().forEach((change: DocumentChange) => {
        const product = this.transformFirestoreDoc(change.doc);

        switch (change.type) {
          case 'added':
            console.log('➕ Product added:', { productId: product.id, productName: product.productName });
            this.logger.debug('Product added', { area: 'products', payload: { productId: product.id, productName: product.productName } });
            // Add if not already exists
            if (!updatedProducts.find(p => p.id === product.id)) {
              updatedProducts.push(product);
            }
            break;

          case 'modified':
            this.logger.debug('Product modified', { area: 'products', payload: { productId: product.id, productName: product.productName } });
            // Update existing product
            const modifiedIndex = updatedProducts.findIndex(p => p.id === product.id);
            if (modifiedIndex >= 0) {
              updatedProducts[modifiedIndex] = product;
            } else {
              // Add if somehow not found
              updatedProducts.push(product);
            }
            break;

          case 'removed':
            this.logger.debug('Product removed', { area: 'products', payload: { productId: product.id, productName: product.productName } });
            // Remove from array
            updatedProducts = updatedProducts.filter(p => p.id !== product.id);
            break;
        }
      });

      // Normalize and deduplicate
      const normalizedProducts = this.normalizeAndDeduplicateProducts(updatedProducts);

      console.log('✅ Products cache updated', { 
        count: normalizedProducts.length, 
        fromCache: isFromCache,
        categories: [...new Set(normalizedProducts.map(p => p.category))].length
      });

      // Update cache state
      this.updateCacheState({
        products: normalizedProducts,
        isLoading: false,
        lastUpdated: new Date(),
        error: null,
        hasInitialLoad: true
      });

      console.log('✅ Products cache updated (Firestore offline persistence enabled)');

      this.logger.dbSuccess('Products cache updated', { 
        area: 'products', 
        payload: { 
          count: normalizedProducts.length, 
          fromCache: isFromCache,
          storeId: this.currentStoreId 
        } 
      });

    } catch (error) {
      this.logger.dbFailure('Error handling snapshot update', { area: 'products' }, error);
      this.updateCacheState({ 
        isLoading: false, 
        error: String(error) 
      });
    }
  }

  /**
   * Unsubscribe from real-time updates with improved error handling
   */
  private unsubscribeFromRealTimeUpdates(): void {
    if (this.unsubscribeSnapshot) {
      try {
        console.log('🔄 Unsubscribing from real-time updates...');
        this.unsubscribeSnapshot();
        this.unsubscribeSnapshot = null;
        console.log('✅ Successfully unsubscribed from real-time updates');
        this.logger.debug('Unsubscribed from real-time updates', { area: 'products' });
      } catch (error) {
        console.error('❌ Error during unsubscribe from real-time updates:', error);
        this.logger.dbFailure('Error during unsubscribe from real-time updates', { area: 'products' }, error);
        // Force clear the reference even if unsubscribe failed
        this.unsubscribeSnapshot = null;
      }
    } else {
      console.log('📝 No active subscription to unsubscribe from');
    }
  }

  /**
   * Add a product to the cache (optimistic update)
   */
  private addProductToCache(product: Product): void {
    const currentProducts = this.products();
    const existingIdx = currentProducts.findIndex(p => p.skuId === product.skuId && p.storeId === product.storeId);
    
    let updatedProducts: Product[];
    if (existingIdx >= 0) {
      updatedProducts = [...currentProducts];
      updatedProducts[existingIdx] = { ...updatedProducts[existingIdx], ...product };
    } else {
      updatedProducts = [...currentProducts, product];
    }

    this.updateCacheState({
      products: this.normalizeAndDeduplicateProducts(updatedProducts)
    });
  }

  /**
   * Update a product in the cache (optimistic update)
   */
  private updateProductInCache(productId: string, updates: Partial<Product>): void {
    const currentProducts = this.products();
    const updatedProducts = currentProducts.map(product =>
      product.id === productId
        ? { ...product, ...updates, updatedAt: new Date() }
        : product
    );

    this.updateCacheState({
      products: this.normalizeAndDeduplicateProducts(updatedProducts)
    });
  }

  /**
   * Remove a product from the cache (optimistic update)
   */
  private removeProductFromCache(productId: string): void {
    const currentProducts = this.products();
    const updatedProducts = currentProducts.filter(product => product.id !== productId);

    this.updateCacheState({
      products: this.normalizeAndDeduplicateProducts(updatedProducts)
    });
  }

  private transformFirestoreDoc(doc: any): Product {
    const data = doc.data();
    console.log('🔍 Transforming Firestore doc:', { id: doc.id, rawData: data });
    
    try {
      const product: Product = {
        id: doc.id,
        uid: data['uid'] || '',  // Include UID field
        productName: data['productName'] || '',
        description: data['description'] || undefined,
        skuId: data['skuId'] || '',
        productCode: data['productCode'] || undefined,
        unitType: data['unitType'] || 'pieces',
        category: data['category'] || '',
        totalStock: Number(data['totalStock'] || 0),
        sellingPrice: Number(data['sellingPrice'] || 0),
        companyId: data['companyId'] || '',
        storeId: data['storeId'] || '',
        barcodeId: data['barcodeId'] || '',
        imageUrl: data['imageUrl'] || '',
        isFavorite: !!data['isFavorite'] || false,
        
        // Tax and Discount Fields with defaults
        isVatApplicable: !!data['isVatApplicable'] || false,
        vatRate: Number(data['vatRate'] || 0),
        hasDiscount: !!data['hasDiscount'] || false,
        discountType: data['discountType'] || 'percentage',
        discountValue: Number(data['discountValue'] || 0),
        
        status: data['status'] || 'active',
        createdAt: this.safeToDate(data['createdAt']),
        updatedAt: this.safeToDate(data['updatedAt']),
        lastUpdated: this.safeToDate(data['lastUpdated'])
      };
      
      console.log('✅ Transformed product successfully:', {
        id: product.id,
        name: product.productName,
        category: product.category,
        price: product.sellingPrice,
        stock: product.totalStock,
        storeId: product.storeId,
        companyId: product.companyId
      });
      return product;
    } catch (error) {
      console.error('❌ Error transforming Firestore doc:', error, { docId: doc.id, data });
      throw error;
    }
  }

  /**
   * Safely convert Firestore timestamp to Date, handling serverTimestamp
   */
  private safeToDate(value: any): Date {
    if (!value) return new Date();
    
    // Handle serverTimestamp object
    if (value && typeof value === 'object' && value._methodName === 'serverTimestamp') {
      return new Date(); // Use current date for serverTimestamp placeholders
    }
    
    // Handle Firestore Timestamp
    if (value && typeof value.toDate === 'function') {
      return value.toDate();
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return value;
    }
    
    // Handle strings/numbers
    try {
      return new Date(value);
    } catch {
      return new Date();
    }
  }

  private transformQuantityAdjustments(adjustmentsData: any[]): any[] {
    // quantityAdjustments removed from product documents. Keep method for backward compatibility but return empty.
    return [];
  }

  private async waitForAuth(): Promise<string> {
    return new Promise((resolve, reject) => {
      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      
      console.log('🔐 waitForAuth - checking auth state:', {
        hasUser: !!currentUser,
        hasPermission: !!currentPermission,
        companyId: currentPermission?.companyId
      });

      if (currentUser && currentPermission?.companyId) {
        console.log('✅ Auth already available:', { companyId: currentPermission.companyId });
        resolve(currentPermission.companyId);
        return;
      }

      // Use effect to watch for auth changes
      let attempts = 0;
      const checkAuth = () => {
        const user = this.authService.getCurrentUser();
        const permission = this.authService.getCurrentPermission();
        
        console.log(`🔄 waitForAuth attempt ${attempts + 1}:`, {
          hasUser: !!user,
          hasPermission: !!permission,
          companyId: permission?.companyId
        });

        if (user && permission?.companyId) {
          console.log('✅ Auth became available:', { companyId: permission.companyId });
          resolve(permission.companyId);
          return;
        }
        
        attempts++;
        if (attempts >= 50) { // 5 seconds with 100ms intervals
          console.error('❌ Authentication timeout after 5 seconds');
          reject(new Error('Authentication timeout - user or permission not available'));
          return;
        }
        
        setTimeout(checkAuth, 100);
      };
      
      checkAuth();
    });
  }

  async loadProducts(storeId: string, pageSize = 50, pageNumber = 1): Promise<number> {
    // Delegate to the new real-time method
    await this.loadProductsRealTime(storeId);
    return this.products().length;
  }

  private async loadProductsFromBigQuery(storeId: string, pageSize = 50, pageNumber = 1): Promise<number> {
    // BigQuery method deprecated - redirecting to Firestore real-time
    this.logger.warn('loadProductsFromBigQuery is deprecated, using Firestore real-time instead', { area: 'products', storeId });
    await this.loadProductsRealTime(storeId);
    return this.products().length;
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
      
      // Tax and Discount Fields with defaults
      isVatApplicable: item.isVatApplicable || false,
      vatRate: item.vatRate || 0,
      hasDiscount: item.hasDiscount || false,
      discountType: item.discountType || 'percentage',
      discountValue: item.discountValue || 0,
      
      status: item.status || 'active',
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      lastUpdated: item.lastUpdated ? new Date(item.lastUpdated) : new Date()
    };
  }

  private async loadProductsFromFirestore(storeId?: string): Promise<void> {
    // Legacy method - redirecting to real-time method
    this.logger.warn('loadProductsFromFirestore is deprecated, using real-time method instead', { area: 'products', storeId });
    if (storeId) {
      await this.loadProductsRealTime(storeId);
    }
  }
async loadProductsByCompanyAndStore(companyId?: string, storeId?: string): Promise<void> {
    // Legacy method - redirecting to real-time method
    this.logger.warn('loadProductsByCompanyAndStore is deprecated, using real-time method instead', { area: 'products', companyId, storeId });
    if (storeId) {
      await this.loadProductsRealTime(storeId);
    }
  }

  private async loadProductsByCompanyAndStoreFromBigQuery(companyId?: string, storeId?: string): Promise<void> {
    // Legacy method - redirecting to real-time method
    this.logger.warn('loadProductsByCompanyAndStoreFromBigQuery is deprecated, using real-time method instead', { area: 'products', companyId, storeId });
    if (storeId) {
      await this.loadProductsRealTime(storeId);
    }
  }

  async loadProductsByCompanyAndStoreFromFirestore(companyId?: string, storeId?: string): Promise<void> {
    // Legacy method - redirecting to real-time method
    this.logger.warn('loadProductsByCompanyAndStoreFromFirestore is deprecated, using real-time method instead', { area: 'products', companyId, storeId });
    if (storeId) {
      await this.loadProductsRealTime(storeId);
    }
  }
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    console.log('🚀 Starting atomic product creation with transaction...');
    
    try {
      // Get current user for UID
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const companyId = await this.waitForAuth();
      console.log('🔐 User authenticated for product creation:', { uid: currentUser.uid, companyId });
      
      // Clean undefined values that Firestore doesn't accept
      const invArr = Array.isArray((productData as any).inventory) ? (productData as any).inventory : [];
      console.log('📦 Initial inventory batches:', invArr.length);
      
      // Remove uid from productData since we'll add it in the transaction
      const { uid, ...productDataWithoutUid } = productData;
      
      const baseData: any = this.cleanUndefinedValues({
        ...productDataWithoutUid,
        companyId,
        status: productData.status || 'active'
      });

      // Use Firestore transaction for all-or-nothing product + inventory creation
      return await runTransaction(this.firestore, async (transaction) => {
        console.log('🔄 Starting atomic transaction for product creation...');

        // 1. Create product document reference
        const productRef = doc(collection(this.firestore, 'products'));
        const productId = productRef.id;
        console.log('📝 Generated product ID:', productId);

        // 2. Prepare product data with security fields
        const productPayload = {
          ...baseData,
          uid: currentUser.uid,
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUpdated: new Date()
        };

        // 3. Calculate initial totals from batches
        let totalStock = 0;
        let sellingPrice = 0;
        
        if (invArr.length > 0) {
          // Calculate total stock
          totalStock = invArr.reduce((sum: number, batch: any) => sum + Number(batch.quantity || 0), 0);
          
          // Get selling price from latest batch by receivedAt
          const sortedBatches = [...invArr].sort((a: any, b: any) => {
            const dateA = a.receivedAt instanceof Date ? a.receivedAt : new Date(a.receivedAt);
            const dateB = b.receivedAt instanceof Date ? b.receivedAt : new Date(b.receivedAt);
            return dateB.getTime() - dateA.getTime();
          });
          sellingPrice = Number(sortedBatches[0]?.unitPrice || 0);
          
          console.log('📊 Calculated totals:', { totalStock, sellingPrice, batchCount: invArr.length });
        }

        // Add calculated fields to product
        productPayload.totalStock = totalStock;
        productPayload.sellingPrice = sellingPrice;

        // 4. Queue product creation in transaction
        transaction.set(productRef, productPayload);
        console.log('📝 Product creation queued in transaction');

        // 5. Queue inventory batch creation in transaction
        const batchRefs: string[] = [];
        for (const batch of invArr) {
          const batchRef = doc(collection(this.firestore, 'productInventory'));
          const batchId = batchRef.id;
          
          const batchData = {
            productId: productId,
            productName: baseData.productName || '',
            companyId: companyId,
            storeId: baseData.storeId || '',
            batchNumber: batch.batchNumber || undefined,
            batchId: batchId, // Set batchId to document ID
            quantity: Number(batch.quantity || 0),
            unitPrice: Number(batch.unitPrice || 0),
            costPrice: Number(batch.costPrice || 0) || Number(batch.unitPrice || 0),
            receivedAt: batch.receivedAt instanceof Date ? batch.receivedAt : new Date(batch.receivedAt || new Date()),
            expiryDate: batch.expiryDate ? (batch.expiryDate instanceof Date ? batch.expiryDate : new Date(batch.expiryDate)) : null,
            supplier: batch.supplier || null,
            status: 'active',
            totalDeducted: 0,
            deductionHistory: [],
            uid: currentUser.uid,
            createdBy: currentUser.uid,
            updatedBy: currentUser.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
            syncStatus: 'SYNCED',
            isOffline: false,
            initialQuantity: Number(batch.quantity || 0)
          };

          transaction.set(batchRef, batchData);
          batchRefs.push(batchId);
          console.log('📦 Batch creation queued in transaction:', batchId);
        }

        console.log('✅ Transaction prepared - will create product + ' + invArr.length + ' inventory batches atomically');
        return productId;
      }).then((productId) => {
        console.log('🎉 Atomic transaction committed successfully! Product created:', productId);
        
        // Update the local cache immediately for optimistic updates
        const newLocalProd: Product = {
          ...productData,
          id: productId,
          companyId,
          totalStock: invArr.reduce((sum: number, batch: any) => sum + Number(batch.quantity || 0), 0),
          sellingPrice: invArr.length > 0 ? Number(invArr.sort((a: any, b: any) => {
            const dateA = a.receivedAt instanceof Date ? a.receivedAt : new Date(a.receivedAt);
            const dateB = b.receivedAt instanceof Date ? b.receivedAt : new Date(b.receivedAt);
            return dateB.getTime() - dateA.getTime();
          })[0]?.unitPrice || 0) : 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isOfflineCreated: productId.startsWith('temp_')
        } as Product;

        this.addProductToCache(newLocalProd);
        
        return productId;
      }).catch((error) => {
        console.error('❌ Atomic transaction failed - no changes made:', error);
        throw new Error(`Failed to create product atomically: ${error.message}`);
      });
      
    } catch (error) {
      this.logger.dbFailure('Atomic product creation failed', { api: 'firestore.transaction', area: 'products', collectionPath: 'products' }, error);
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

      // Clean undefined values to prevent Firestore errors
      const cleanedUpdateData = this.cleanUndefinedValues(updateData);

      // Use OfflineDocumentService for consistent online/offline updates
      await this.offlineDocService.updateDocument('products', productId, cleanedUpdateData);

      // Update the local cache optimistically
      this.updateProductInCache(productId, updates);

    } catch (error) {
      this.logger.dbFailure('Update product failed', { api: 'firestore.update', area: 'products', collectionPath: 'products', docId: productId }, error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.offlineDocService.deleteDocument('products', productId);

      // Update the local cache optimistically
      this.removeProductFromCache(productId);
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

  // ============================================
  // PUBLIC API - REACTIVE ACCESS METHODS
  // ============================================

  /**
   * Initialize products for a store with real-time updates
   * This is the main method that should be called by components
   */
  async initializeProducts(storeId: string, forceReload = false): Promise<void> {
    console.log('🚀 initializeProducts called:', {
      storeId,
      forceReload,
      currentStoreId: this.currentStoreId,
      hasInitialLoad: this.hasInitialLoad(),
      isLoading: this.isLoading(),
      currentProductCount: this.products().length
    });
    
    try {
      const result = await this.loadProductsRealTime(storeId, forceReload);
      console.log('✅ initializeProducts completed:', {
        newProductCount: this.products().length,
        isLoading: this.isLoading(),
        hasError: !!this.error()
      });
      return result;
    } catch (error) {
      console.error('❌ initializeProducts failed:', error);
      throw error;
    }
  }

  /**
   * Debug method for testing product loading from console
   */
  async debugProductLoad(storeId?: string): Promise<void> {
    const targetStoreId = storeId || this.currentStoreId;
    console.log('🐛 Debug product load starting...', { targetStoreId });
    
    if (!targetStoreId) {
      console.error('❌ No store ID available for debug load');
      return;
    }

    try {
      await this.initializeProducts(targetStoreId, true);
      console.log('🐛 Debug load completed:', {
        productCount: this.products().length,
        products: this.products().slice(0, 3).map(p => ({ id: p.id, name: p.productName }))
      });
    } catch (error) {
      console.error('🐛 Debug load failed:', error);
    }
  }

  /**
   * Force refresh products from Firestore
   */
  async refreshProducts(storeId?: string): Promise<void> {
    const targetStoreId = storeId || this.currentStoreId;
    if (targetStoreId) {
      await this.loadProductsRealTime(targetStoreId, true);
    } else {
      this.logger.warn('No storeId available for refresh', { area: 'products' });
    }
  }

  /**
   * Get reactive signal for all products
   */
  getProductsSignal() {
    const signal = this.products;
    console.log('📡 getProductsSignal() called - returning signal function');
    return signal;
  }

  /**
   * Get reactive signal for loading state
   */
  getLoadingSignal() {
    return this.isLoading;
  }

  /**
   * Get reactive signal for error state
   */
  getErrorSignal() {
    return this.error;
  }

  /**
   * Get reactive signal for online status
   */
  getOnlineStatusSignal() {
    return this.isOnlineStatus;
  }

  /**
   * Check if service has been initialized with data
   */
  isInitialized(): boolean {
    return this.hasInitialLoad();
  }

  // ============================================
  // LEGACY GETTER METHODS (for backward compatibility)
  // ============================================

  // Getter methods
  getProducts(): Product[] {
    const products = this.products();
    console.log('🔍 getProducts() called:', {
      count: products.length,
      isLoading: this.isLoading(),
      hasInitialLoad: this.hasInitialLoad(),
      currentStoreId: this.currentStoreId,
      error: this.error(),
      products: products.slice(0, 5).map(p => ({ 
        id: p.id, 
        name: p.productName, 
        store: p.storeId,
        category: p.category 
      }))
    });
    return products;
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

      // Update main selling price only (inventory functionality removed)
      await this.updateProduct(productId, {
        sellingPrice: newPrice,
        lastUpdated: new Date()
      });

      this.logger.dbSuccess('Product price updated', { api: 'firestore.update', area: 'products', collectionPath: 'products', docId: productId });
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

      // Simplified: only update total stock (inventory functionality removed)
      await this.updateProduct(productId, {
        totalStock: newQuantity,
        lastUpdated: new Date()
      });

      this.logger.dbSuccess('Product quantity updated', { api: 'firestore.update', area: 'products', collectionPath: 'products', docId: productId });
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
      // Inventory functionality removed - method disabled
      this.logger.warn('splitBatch method is deprecated (inventory functionality removed)', { area: 'products', docId: productId });
      throw new Error('splitBatch method is not available (inventory functionality removed)');
    } catch (error) {
      this.logger.dbFailure('Error splitting batch', { area: 'products', docId: productId }, error);
      throw error;
    }
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
    
    // Convert to array and sort by product name since we removed Firestore orderBy
    const sortedProducts = Array.from(map.values());
    sortedProducts.sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));
    return sortedProducts;
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
      this.updateProductInCache(productId, updates);
    } catch (e) {
      this.logger.warn('Failed to apply local product patch', { area: 'products', payload: { error: String(e) } });
    }
  }

  // Legacy no-op implementations to avoid breaking callers; will be removed after UI refactor.
  async addInventoryBatch(productId: string, _batch: ProductInventory): Promise<void> {
  this.logger.warn('addInventoryBatch is deprecated. Use InventoryDataService.addBatch instead.', { area: 'products' });
    // No-op
  }

  async updateInventoryBatch(productId: string, _batchId: string, _updatedBatch: ProductInventory): Promise<void> {
  this.logger.warn('updateInventoryBatch is deprecated. Use InventoryDataService.updateBatch instead.', { area: 'products' });
    // No-op
  }

  async removeInventoryBatch(productId: string, _batchId: string): Promise<void> {
  this.logger.warn('removeInventoryBatch is deprecated. Use InventoryDataService.removeBatch instead.', { area: 'products' });
    // No-op
  }
}
