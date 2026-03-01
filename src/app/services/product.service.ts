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
  writeBatch,
  Timestamp,
  Unsubscribe,
  DocumentChange,
  QuerySnapshot,
  DocumentSnapshot 
} from '@angular/fire/firestore';
import { Product, ProductInventory, ProductStatus } from '../interfaces/product.interface';
import { AuthService } from './auth.service';
import { ProductSummaryService } from './product-summary.service';
import { LoggerService } from '../core/services/logger.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { IndexedDBService, OfflineProduct } from '../core/services/indexeddb.service';
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
  
  // Cache products per store to maintain snapshots when switching stores
  private productCacheByStore = new Map<string, Product[]>();
  private storeLoadTimestamps = new Map<string, Date>();

  // Network status tracking
  private isOnline = navigator.onLine;

  // Computed properties - reactive access to cache
  readonly products = computed(() => {
    const products = this.cacheState().products;
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
    private http: HttpClient,
    private productSummaryService: ProductSummaryService,
    private indexedDBService: IndexedDBService
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
          console.log('✅ Firestore connection test successful!');
          return true;
        } catch (error) {
          console.error('❌ Firestore connection test failed:', error);
          return false;
        }
      },
      testQuery: async (companyId: string, storeId: string) => {
        console.log('🧪 Testing specific product query...');
        try {
          const testRef = collection(this.firestore, 'products');
          const testQuery = query(
            testRef,
            where('companyId', '==', companyId),
            where('storeId', '==', storeId),
            limit(5)
          );
          const testSnapshot = await getDocs(testQuery);
          console.log('✅ Query test successful!');
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
          
          if (permission.companyId && permission.storeId) {
            await this.loadProductsDirectly(permission.companyId, permission.storeId);
          } else {
            console.error('❌ Missing companyId or storeId in permission');
          }
        } catch (error) {
          console.error('❌ Direct load test failed:', error);
        }
      }
      ,
      validateSummary: async (productId: string) => {
        try {
          console.log('🧪 Validating product summary for', productId);
          const result = await this.productSummaryService.validateProductSummary(productId);
          return result;
        } catch (err) {
          console.error('❌ validateSummary failed:', err);
          throw err;
        }
      },
      recomputeSummary: async (productId: string) => {
        try {
          console.log('🧪 Recomputing product summary for', productId);
          const result = await this.productSummaryService.recomputeProductSummary(productId);
          return result;
        } catch (err) {
          console.error('❌ recomputeSummary failed:', err);
          throw err;
        }
      }
    };
    // Provide a callback hook that other services can call after updating product summary
    // This avoids creating circular DI between ProductService and ProductSummaryService.
    try {
      (window as any).onProductSummaryUpdated = (productId: string, updates: any) => {
        try {
          // Apply a local-only patch so UI updates immediately without forcing a Firestore write
          this.applyLocalPatch(productId, updates as any);
        } catch (e) {
          console.warn('⚠️ onProductSummaryUpdated handler error:', e);
        }
      };
    } catch (e) {
      console.warn('⚠️ Failed to register onProductSummaryUpdated hook:', e);
    }
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
    this.cacheState.update(current => {
      const newState = { ...current, ...updates };
      return newState;
    });
  }

  /**
   * Fallback method to load products without real-time listener
   */
  private async loadProductsDirectly(companyId: string, storeId: string): Promise<void> {
    try {
      console.log('🔄 Loading products directly (fallback method)...');
      
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
          limit(500)
        );
      } catch (queryError) {
        console.log('🔄 Fallback to minimal query');
        q = query(
          productsRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          where('status', '==', 'active'),
          limit(500)
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
      
      // Only try IndexedDB fallback when actually offline
      if (!navigator.onLine) {
        console.log('🔄 Offline detected - attempting IndexedDB fallback after direct load failure...');
        try {
          const offlineProducts = await this.loadProductsFromIndexedDB(storeId);
          
          if (offlineProducts.length > 0) {
            console.log('✅ IndexedDB fallback successful in direct load:', offlineProducts.length);
            this.updateCacheState({
              products: offlineProducts,
              isLoading: false,
              lastUpdated: new Date(),
              error: null,
              hasInitialLoad: true
            });
            return; // Success - don't throw
          }
        } catch (indexedDBError) {
          console.error('❌ IndexedDB fallback in direct load failed:', indexedDBError);
        }
      } else {
        console.log('❌ Direct load failed while online - not falling back to IndexedDB');
      }
      
      throw error;
    }
  }

  /**
   * Main method to load products with real-time updates
   * This replaces the old loadProducts method
   */
  async loadProductsRealTime(storeId: string, forceReload = false): Promise<void> {
    try {
      
      if (!storeId) {
        throw new Error('storeId is required for loading products');
      }

      // Check if offline - load from IndexedDB instead of Firestore
      if (!navigator.onLine) {
        console.log('📴 Offline mode detected - loading products from IndexedDB...');
        this.updateCacheState({ isLoading: true, error: null });
        
        try {
          const offlineProducts = await this.loadProductsFromIndexedDB(storeId);
          
          if (offlineProducts.length > 0) {
            console.log('✅ Loaded products from IndexedDB in offline mode:', offlineProducts.length);
            this.updateCacheState({
              products: offlineProducts,
              isLoading: false,
              lastUpdated: new Date(),
              error: null,
              hasInitialLoad: true
            });
          } else {
            console.log('📭 No products found in IndexedDB for store:', storeId);
            this.updateCacheState({
              products: [],
              isLoading: false,
              error: 'No cached products available offline',
              hasInitialLoad: true
            });
          }
          
          this.currentStoreId = storeId;
          return;
        } catch (error) {
          console.error('❌ Failed to load products from IndexedDB:', error);
          this.updateCacheState({
            isLoading: false,
            error: 'Failed to load offline products: ' + String(error)
          });
          return;
        }
      }

      // Check if we already have this store loaded and don't need to reload
      if (!forceReload && this.currentStoreId === storeId && this.hasInitialLoad() && this.products().length > 0) {
        this.logger.debug('Products already loaded for store, skipping reload', { area: 'products', storeId });
        return;
      }

      // Get authentication
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        console.log('❌ User not authenticated');
        throw new Error('User not authenticated');
      }

      const companyId = await this.waitForAuth();
      
      // Save current store's products to cache before switching
      if (this.currentStoreId && this.currentStoreId !== storeId && this.products().length > 0) {
        this.productCacheByStore.set(this.currentStoreId, [...this.products()]);
        this.storeLoadTimestamps.set(this.currentStoreId, new Date());
      }
      
      // Check if we have cached products for the target store
      const cachedProducts = this.productCacheByStore.get(storeId);
      const cacheTimestamp = this.storeLoadTimestamps.get(storeId);
      const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp.getTime() : Infinity;
      const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
      
      if (!forceReload && cachedProducts && cacheAge < CACHE_MAX_AGE) {
        this.updateCacheState({
          products: cachedProducts,
          isLoading: false,
          lastUpdated: cacheTimestamp,
          error: null,
          hasInitialLoad: true
        });
        this.currentStoreId = storeId;
        this.currentCompanyId = companyId;
        
        // Still set up real-time listener for updates
        this.setupRealtimeListener(companyId, storeId).catch(err => {
          console.warn('Failed to setup real-time listener for cached store:', err);
        });
        return;
      }
      
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
          // When online, don't fallback to IndexedDB - let Firestore handle it
          if (navigator.onLine) {
            console.error('❌ Real-time listener error while online - relying on Firestore offline persistence');
            throw listenerError;
          } else {
            // Only use IndexedDB fallback when actually offline
            console.error('❌ Real-time listener error while offline, attempting IndexedDB fallback:', listenerError);
            try {
              console.log('🔄 Loading products from IndexedDB as fallback...');
              const offlineProducts = await this.loadProductsFromIndexedDB(storeId);
              
              if (offlineProducts.length > 0) {
                console.log('✅ Successfully loaded products from IndexedDB:', offlineProducts.length);
                this.updateCacheState({
                  products: offlineProducts,
                  isLoading: false,
                  lastUpdated: new Date(),
                  error: null,
                  hasInitialLoad: true
                });
                this.currentStoreId = storeId;
                return; // Success - exit the function
              } else {
                console.log('📭 No products found in IndexedDB for store:', storeId);
                throw listenerError; // Re-throw original error if no IndexedDB data
              }
            } catch (indexedDBError) {
              console.error('❌ IndexedDB fallback failed:', indexedDBError);
              throw listenerError; // Re-throw original listener error
            }
          }
        }
      }

    } catch (error) {
      this.logger.dbFailure('Failed to setup real-time product loading', { area: 'products', storeId }, error);
      
      // Only try IndexedDB fallback when actually offline
      if (!navigator.onLine) {
        console.log('❌ All Firestore methods failed while offline, attempting final IndexedDB fallback...');
        try {
          const offlineProducts = await this.loadProductsFromIndexedDB(storeId);
          
          if (offlineProducts.length > 0) {
            console.log('✅ Final IndexedDB fallback successful:', offlineProducts.length, 'products loaded');
            this.updateCacheState({
              products: offlineProducts,
              isLoading: false,
              lastUpdated: new Date(),
              error: null,
              hasInitialLoad: true
            });
            this.currentStoreId = storeId;
            return; // Success!
          }
        } catch (indexedDBError) {
          console.error('❌ Final IndexedDB fallback also failed:', indexedDBError);
        }
      } else {
        console.log('❌ Product loading failed while online - not falling back to IndexedDB, letting Firestore handle it');
      }
      
      // If we get here, everything failed
      this.updateCacheState({ 
        isLoading: false, 
        error: String(error) 
      });
      
      console.log('❌ Product loading failed completely - no data available');
    }
  }

  /**
   * Setup Firestore real-time listener with onSnapshot
   */
  private async setupRealtimeListener(companyId: string, storeId: string): Promise<void> {
    try {
      // CRITICAL: Verify auth state before creating query
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Cannot setup listener - user not authenticated');
      }
      
      // Ensure we clean up any existing listener first
      this.unsubscribeFromRealTimeUpdates();
      
      // Add a small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const productsRef = collection(this.firestore, 'products');
      
      // DEBUG: First check if there are ANY products at all
      const debugQuery = query(
        productsRef,
        where('companyId', '==', companyId),
        where('storeId', '==', storeId),
        limit(10)
      );
      const debugSnapshot = await getDocs(debugQuery);

      // Create query with proper error handling - avoid orderBy to prevent index requirements
      let q;
      try {
        // Use simple query first - we'll sort in JavaScript
        q = query(
          productsRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          where('status', '==', 'active'),
          limit(500)
        );
      } catch (queryError) {
        console.error('❌ Error creating Firestore query:', queryError);
        // Even simpler fallback - just company and store
        q = query(
          productsRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          limit(500)
        );
        console.log('🔄 Using minimal fallback query');
      }

      console.log(' Setting up onSnapshot listener...');
      
      // Set up listener with better error handling
      this.unsubscribeSnapshot = onSnapshot(
        q,
        {
          includeMetadataChanges: false // Disable metadata changes to avoid assertion failures
        },
        (snapshot: QuerySnapshot) => {
          try {
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

      // Update cache state
      this.updateCacheState({
        products: normalizedProducts,
        isLoading: false,
        lastUpdated: new Date(),
        error: null,
        hasInitialLoad: true
      });

      // Firestore snapshot with includeMetadataChanges automatically handles caching
      // No need for custom IndexedDB - Firestore manages its own cache

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
        this.unsubscribeSnapshot();
        this.unsubscribeSnapshot = null;
        this.logger.debug('Unsubscribed from real-time updates', { area: 'products' });
      } catch (error) {
        console.error('❌ Error during unsubscribe from real-time updates:', error);
        this.logger.dbFailure('Error during unsubscribe from real-time updates', { area: 'products' }, error);
        // Force clear the reference even if unsubscribe failed
        this.unsubscribeSnapshot = null;
      }
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
    const updatedProducts = currentProducts.map(product => {
      if (product.id === productId) {
        // Convert Timestamp to Date for updatedAt if present
        const normalizedUpdates = { ...updates };
        if (normalizedUpdates.updatedAt) {
          normalizedUpdates.updatedAt = this.safeToDate(normalizedUpdates.updatedAt);
        }
        const updatedProduct = { ...product, ...normalizedUpdates };
        return updatedProduct;
      }
      return product;
    });

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
        originalPrice: Number(data['originalPrice'] ?? data['unitPrice'] ?? data['sellingPrice'] ?? 0),
        costPrice: Number(data['costPrice'] ?? 0),
        companyId: data['companyId'] || '',
        storeId: data['storeId'] || '',
        barcodeId: data['barcodeId'] || '',
        imageUrl: data['imageUrl'] || '',
        isFavorite: !!data['isFavorite'] || false,
        
        // Tags
        tags: data['tags'] || undefined,
        tagLabels: data['tagLabels'] || undefined,
        
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
          console.log('✅ Auth became available');
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
      originalPrice: Number(item.originalPrice || item.unitPrice || item.sellingPrice || 0),
      costPrice: Number(item.costPrice ?? 0),
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
      
      // Clean undefined values that Firestore doesn't accept
      const invArr = Array.isArray((productData as any).inventory) ? (productData as any).inventory : [];
      console.log('📦 Initial inventory batches:', invArr.length);
      
      // Remove uid from productData since we'll add it in the transaction
      const { uid, ...productDataWithoutUid } = productData;
      
      console.log('📋 Product data received for creation:', {
        category: productData.category,
        productName: productData.productName,
        hasCategory: !!productData.category
      });
      
      const baseData: any = this.cleanUndefinedValues({
        ...productDataWithoutUid,
        companyId,
        status: productData.status || 'active'
      });
      
      console.log('📋 Base data after cleaning undefined values:', {
        category: baseData.category,
        productName: baseData.productName,
        hasCategory: !!baseData.category
      });

      // Use batch writes for all-or-nothing product + inventory creation
      const batch = writeBatch(this.firestore);
      console.log('📦 Starting batch write for product creation...');

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

      // 3. Calculate initial totals from batches (fallback to provided values if no batches)
      let totalStock = 0;
      let sellingPrice = 0;
      let originalPrice = 0;
      
      if (invArr.length > 0) {
        // Calculate total stock
        totalStock = invArr.reduce((sum: number, batch: any) => sum + Number(batch.quantity || 0), 0);
        
        // Get selling price from latest batch by receivedAt
        const sortedBatches = [...invArr].sort((a: any, b: any) => {
          const dateA = a.receivedAt instanceof Date ? a.receivedAt : new Date(a.receivedAt);
          const dateB = b.receivedAt instanceof Date ? b.receivedAt : new Date(b.receivedAt);
          return dateB.getTime() - dateA.getTime();
        });
        sellingPrice = Number((sortedBatches[0]?.sellingPrice ?? sortedBatches[0]?.unitPrice) || 0);
        originalPrice = Number(sortedBatches[0]?.unitPrice || 0);
      } else {
        totalStock = Number(baseData?.totalStock ?? baseData?.initialQuantity ?? 0);
        sellingPrice = Number(baseData?.sellingPrice || 0);
        originalPrice = Number(baseData?.originalPrice || baseData?.unitPrice || baseData?.sellingPrice || 0);
        if (sellingPrice === 0 && originalPrice > 0) {
          const isVatApplicable = !!baseData?.isVatApplicable;
          const vatRate = Number(baseData?.vatRate || 0);
          const hasDiscount = !!baseData?.hasDiscount;
          const discountType = baseData?.discountType || 'percentage';
          const discountValue = Number(baseData?.discountValue || 0);
          const withVat = originalPrice * (1 + vatRate / 100);
          let discountAmount = 0;
          if (hasDiscount && discountValue) {
            discountAmount = discountType === 'percentage'
              ? withVat * (discountValue / 100)
              : discountValue;
          }
          sellingPrice = Number(withVat - discountAmount) || 0;
        }
      }

      // Add calculated fields to product
      productPayload.totalStock = totalStock;
      productPayload.sellingPrice = sellingPrice;
      productPayload.originalPrice = originalPrice || Number(baseData?.originalPrice || 0);
      productPayload.costPrice = Number(baseData?.costPrice || 0);
      productPayload.vatRate = Number(baseData?.vatRate || 0);
      productPayload.isVatApplicable = !!baseData?.isVatApplicable;
      productPayload.hasDiscount = !!baseData?.hasDiscount;
      productPayload.discountType = baseData?.discountType || 'percentage';
      productPayload.discountValue = Number(baseData?.discountValue || 0);

      // 4. Queue product creation in batch
      console.log('💾 Final product payload being saved:', {
        id: productId,
        category: productPayload.category,
        productName: productPayload.productName,
        hasCategory: !!productPayload.category,
        fullPayload: productPayload
      });
      batch.set(productRef, productPayload);
      console.log('📝 Product creation queued in batch');

      // 5. Queue inventory batch creation in batch
      const batchRefs: string[] = [];
      for (const batchItem of invArr) {
        const batchRef = doc(collection(this.firestore, 'productInventory'));
        const batchId = batchRef.id;
        
        const batchData = {
          productId: productId,
          productName: baseData.productName || '',
          companyId: companyId,
          storeId: baseData.storeId || '',
          batchNumber: batchItem.batchNumber || undefined,
          batchId: batchId,
          quantity: Number(batchItem.quantity || 0),
          unitPrice: Number(batchItem.unitPrice || 0),
          costPrice: Number(batchItem.costPrice || 0) || Number(batchItem.unitPrice || 0),
          receivedAt: batchItem.receivedAt instanceof Date ? batchItem.receivedAt : new Date(batchItem.receivedAt || new Date()),
          expiryDate: batchItem.expiryDate ? (batchItem.expiryDate instanceof Date ? batchItem.expiryDate : new Date(batchItem.expiryDate)) : null,
          supplier: batchItem.supplier || null,
          isVatApplicable: !!(batchItem.isVatApplicable ?? baseData.isVatApplicable),
          vatRate: Number(batchItem.vatRate ?? baseData.vatRate ?? 0),
          hasDiscount: !!(batchItem.hasDiscount ?? baseData.hasDiscount),
          discountType: batchItem.discountType ?? baseData.discountType ?? 'percentage',
          discountValue: Number(batchItem.discountValue ?? baseData.discountValue ?? 0),
          sellingPrice: Number(batchItem.sellingPrice || batchItem.unitPrice || 0),
          uid: currentUser.uid,
          status: 'active',
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
          syncStatus: 'SYNCED',
          isOffline: false,
          initialQuantity: Number(batchItem.quantity || 0),
          totalDeducted: 0
        };

        batch.set(batchRef, batchData);
        batchRefs.push(batchId);
        console.log('📦 Batch creation queued in batch:', batchId);
      }

      console.log('✅ Batch prepared - will create product + ' + invArr.length + ' inventory batches');
      
      // Commit batch
      await batch.commit();
      console.log('🎉 Batch write committed successfully! Product created:', productId);
      
      // Update the local cache immediately for optimistic updates
      const newLocalProd: Product = {
        ...productData,
        id: productId,
        companyId,
        totalStock,
        sellingPrice,
        originalPrice: originalPrice || Number((productData as any)?.originalPrice || 0),
        costPrice: Number((productData as any)?.costPrice || 0),
        createdAt: new Date(),
        updatedAt: new Date(),
        vatRate: Number((productData as any)?.vatRate || 0),
        isVatApplicable: !!(productData as any)?.isVatApplicable,
        hasDiscount: !!(productData as any)?.hasDiscount,
        discountType: (productData as any)?.discountType || 'percentage',
        discountValue: Number((productData as any)?.discountValue || 0),
        isOfflineCreated: productId.startsWith('temp_')
      } as Product;

      this.addProductToCache(newLocalProd);
      
      return productId;
      
    } catch (error) {
      this.logger.dbFailure('Atomic product creation failed', { api: 'firestore.transaction', area: 'products', collectionPath: 'products' }, error);
      throw error;
    }
  }

  async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    try {
      // Prepare update data with proper Timestamp conversion
      const updateData: any = { ...updates };
      
      // Normalize VAT fields when present
      if ('vatRate' in updates) {
        updateData.vatRate = Number((updates as any).vatRate || 0);
      }
      if ('originalPrice' in updates) {
        updateData.originalPrice = Number((updates as any).originalPrice || 0);
      }
      if ('sellingPrice' in updates) {
        updateData.sellingPrice = Number((updates as any).sellingPrice || 0);
      }
      if ('costPrice' in updates) {
        updateData.costPrice = Number((updates as any).costPrice || 0);
      }
      if ('isVatApplicable' in updates) {
        updateData.isVatApplicable = !!(updates as any).isVatApplicable;
      }
      // Normalize Discount fields when present
      if ('hasDiscount' in updates) {
        updateData.hasDiscount = !!(updates as any).hasDiscount;
      }
      if ('discountType' in updates) {
        updateData.discountType = (updates as any).discountType || 'percentage';
      }
      if ('discountValue' in updates) {
        updateData.discountValue = Number((updates as any).discountValue || 0);
      }
      // Normalize totalStock when present
      if ('totalStock' in updates) {
        const stockValue = (updates as any).totalStock;
        // Handle null/undefined/empty string explicitly
        if (stockValue === null || stockValue === undefined || stockValue === '') {
          updateData.totalStock = 0;
        } else {
          updateData.totalStock = Number(stockValue);
        }
      }
      
      // Add updatedAt timestamp to track when product was last modified
      updateData.updatedAt = Timestamp.now();

      // Clean undefined values to prevent Firestore errors
      const cleanedUpdateData = this.cleanUndefinedValues(updateData);
      
      // Use Firestore updateDoc directly for automatic offline persistence
      // Firestore will queue this update if offline and update its cache automatically
      const productRef = doc(this.firestore, 'products', productId);
      await updateDoc(productRef, cleanedUpdateData);
      
      // Update the local cache optimistically with the cleaned/normalized data
      this.updateProductInCache(productId, cleanedUpdateData as Partial<Product>);

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
    try {
      const result = await this.loadProductsRealTime(storeId, forceReload);
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
    console.log('🐛 Debug product load starting...');
    
    if (!targetStoreId) {
      console.error('❌ No store ID available for debug load');
      return;
    }

    try {
      await this.initializeProducts(targetStoreId, true);
      console.log('🐛 Debug load completed:', this.products().length);
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

      const isFirestoreTimestamp = v instanceof Timestamp || (v && typeof v.toDate === 'function');
      const isFirestoreFieldValue = !!(v && typeof v === 'object' && typeof v._methodName === 'string');

      if (isFirestoreTimestamp || isFirestoreFieldValue || v instanceof Date) {
        out[k] = v;
        return;
      }

      if (v && typeof v === 'object') {
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

  /**
   * Save products to IndexedDB for offline access
   */
  private async saveProductsToIndexedDB(products: Product[]): Promise<void> {
    try {
      const offlineProducts: OfflineProduct[] = products.map(p => ({
        id: p.id || '',
        uid: p.uid,
        productName: p.productName,
        description: p.description,
        skuId: p.skuId,
        productCode: p.productCode,
        unitType: p.unitType,
        category: p.category,
        totalStock: p.totalStock,
        originalPrice: p.originalPrice,
        sellingPrice: p.sellingPrice,
        companyId: p.companyId,
        storeId: p.storeId,
        barcodeId: p.barcodeId,
        imageUrl: p.imageUrl,
        tags: p.tags,
        tagLabels: p.tagLabels,
        isFavorite: p.isFavorite,
        isVatApplicable: p.isVatApplicable,
        vatRate: p.vatRate,
        hasDiscount: p.hasDiscount,
        discountType: p.discountType,
        discountValue: p.discountValue,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        lastUpdated: p.lastUpdated || p.updatedAt || new Date()
      }));

      await this.indexedDBService.saveProducts(offlineProducts);
      console.log('✅ Saved products to IndexedDB:', offlineProducts.length);
    } catch (error) {
      console.error('❌ Error saving products to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load products from IndexedDB when offline
   */
  private async loadProductsFromIndexedDB(storeId: string): Promise<Product[]> {
    try {
      console.log('📦 Loading products from IndexedDB for store:', storeId);
      const offlineProducts = await this.indexedDBService.getProductsByStore(storeId);
      
      const products: Product[] = offlineProducts.map((p: any) => {
        // Handle both field name formats:
        // - Standard: productName, totalStock, sellingPrice
        // - Legacy/Manual: name, stock, price
        const mapped = {
          id: p.id || '',
          uid: p.uid || '',
          productName: p.productName || p.name || '',
          description: p.description || '',
          skuId: p.skuId || '',
          productCode: p.productCode || '',
          unitType: p.unitType || 'piece',
          category: p.category || '',
          totalStock: p.totalStock !== undefined ? p.totalStock : (p.stock !== undefined ? p.stock : 0),
          originalPrice: p.originalPrice !== undefined ? p.originalPrice : (p.price !== undefined ? p.price : 0),
          sellingPrice: p.sellingPrice !== undefined ? p.sellingPrice : (p.price !== undefined ? p.price : 0),
          costPrice: p.costPrice ?? 0,
          companyId: p.companyId || '',
          storeId: p.storeId || storeId,
          barcodeId: p.barcodeId || p.barcode || '',
          imageUrl: p.imageUrl || p.image || '',
          tags: p.tags || [],
          tagLabels: p.tagLabels || [],
          isFavorite: p.isFavorite || false,
          isVatApplicable: p.isVatApplicable !== undefined ? p.isVatApplicable : true,
          vatRate: p.vatRate || 12,
          hasDiscount: p.hasDiscount || false,
          discountType: p.discountType || 'percentage',
          discountValue: p.discountValue || 0,
          status: (p.status as ProductStatus) || ProductStatus.Active,
          createdAt: p.createdAt || new Date(),
          updatedAt: p.updatedAt || new Date(),
          lastUpdated: p.lastUpdated || p.updatedAt || new Date()
        };
        
        return mapped;
      });

      console.log('✅ Loaded products from IndexedDB:', products.length);
      return products;
    } catch (error) {
      console.error('❌ Error loading products from IndexedDB:', error);
      return [];
    }
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
