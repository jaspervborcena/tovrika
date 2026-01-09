import { Injectable } from '@angular/core';
import { User } from '../../services/auth.service';

export interface UserPermission {
  companyId: string;
  roleId: string;
  storeId?: string; // Optional to match auth.service.ts format
  status?: 'active' | 'inactive'; // Optional field
}

export interface OfflineUserData extends User {
  isLoggedIn: boolean;
  isAgreedToPolicy: boolean;
  currentStoreId?: string; // Current store for offline operations
  permissions: UserPermission[]; // Array of user permissions for different companies/stores
  lastSync: Date;
}

export interface OfflineProduct {
  id: string;
  uid: string;
  productName: string;
  description?: string;
  skuId: string;
  productCode?: string;
  unitType: string;
  category: string;
  totalStock: number;
  originalPrice: number;
  sellingPrice: number;
  companyId: string;
  storeId: string;
  barcodeId?: string;
  imageUrl?: string;
  tags?: string[];
  tagLabels?: string[];
  isFavorite?: boolean;
  isVatApplicable: boolean;
  vatRate?: number;
  hasDiscount: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastUpdated: Date;
}

export interface OfflineOrder {
  id: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  timestamp: Date;
  storeId: string;
  synced: boolean;
}

// Import Company and Store interfaces
import { Company } from '../../interfaces/company.interface';
import { Store } from '../../interfaces/store.interface';

// Offline versions include lastSync timestamp
export interface OfflineCompany extends Omit<Company, 'stores'> {
  lastSync?: Date;
}

export interface OfflineStore extends Store {
  lastSync?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private dbName = 'TovrikaOfflineDB';
  private dbVersion = 3; // Increment version to add productInventory store
  private db: IDBDatabase | null = null;
  private isPermanentlyBroken = false; // Flag to stop retrying corrupted DB

  /**
   * Create all object stores in the database
   */
  private createObjectStores(db: IDBDatabase): void {
    console.log('📦 IndexedDB: Creating object stores...');

    // User data store
    if (!db.objectStoreNames.contains('userData')) {
      const userStore = db.createObjectStore('userData', { keyPath: 'uid' });
      userStore.createIndex('email', 'email', { unique: true });
      console.log('📦 IndexedDB: Created userData store');
    }

    // Products store
    if (!db.objectStoreNames.contains('products')) {
      const productStore = db.createObjectStore('products', { keyPath: 'id' });
      productStore.createIndex('storeId', 'storeId', { unique: false });
      productStore.createIndex('category', 'category', { unique: false });
      productStore.createIndex('barcode', 'barcode', { unique: false });
      console.log('📦 IndexedDB: Created products store');
    }

    // Orders store (for offline transactions)
    if (!db.objectStoreNames.contains('orders')) {
      const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
      orderStore.createIndex('storeId', 'storeId', { unique: false });
      orderStore.createIndex('timestamp', 'timestamp', { unique: false });
      orderStore.createIndex('synced', 'synced', { unique: false });
      console.log('📦 IndexedDB: Created orders store');
    }

    // Notifications store
    if (!db.objectStoreNames.contains('notifications')) {
      const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
      notifStore.createIndex('storeId', 'storeId', { unique: false });
      notifStore.createIndex('read', 'read', { unique: false });
      notifStore.createIndex('createdAt', 'createdAt', { unique: false });
      console.log('📦 IndexedDB: Created notifications store');
    }

    // App settings store
    if (!db.objectStoreNames.contains('settings')) {
      const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
      console.log('📦 IndexedDB: Created settings store');
    }

    // Companies store
    if (!db.objectStoreNames.contains('companies')) {
      const companiesStore = db.createObjectStore('companies', { keyPath: 'id' });
      console.log('📦 IndexedDB: Created companies store');
    }

    // Stores store
    if (!db.objectStoreNames.contains('stores')) {
      const storesStore = db.createObjectStore('stores', { keyPath: 'id' });
      storesStore.createIndex('companyId', 'companyId', { unique: false });
      console.log('📦 IndexedDB: Created stores store');
    }

    // Product Inventory store (for offline FIFO processing)
    if (!db.objectStoreNames.contains('productInventory')) {
      const inventoryStore = db.createObjectStore('productInventory', { keyPath: 'id' });
      inventoryStore.createIndex('productId', 'productId', { unique: false });
      inventoryStore.createIndex('storeId', 'storeId', { unique: false });
      inventoryStore.createIndex('companyId', 'companyId', { unique: false });
      inventoryStore.createIndex('status', 'status', { unique: false });
      console.log('📦 IndexedDB: Created productInventory store');
    }
  }

  async initDB(): Promise<void> {
    // Check if IndexedDB is permanently broken
    if (this.isPermanentlyBroken) {
      //console.warn('📦 IndexedDB: Permanently unavailable - using in-memory fallback');
      return; // Silently fail and use in-memory storage
    }

    // Check if IndexedDB is available
    if (!window.indexedDB) {
      //console.warn('📦 IndexedDB: Not available in this browser - using in-memory fallback');
      this.isPermanentlyBroken = true;
      return; // Silently fail instead of throwing
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        const error = request.error;
        //console.error('📦 IndexedDB: Failed to open database:', error);
        
        // Check for specific errors
        if (error?.name === 'UnknownError') {
          console.warn('📦 IndexedDB: UnknownError - browser storage corrupted at OS level');
          console.warn('📦 IndexedDB: Cannot access or fix corrupted storage - using online-only mode');
          // Don't try to delete or recreate - it won't work with UnknownError
          // Just mark as broken and let app work without offline storage
          this.isPermanentlyBroken = true;
          resolve(); // Resolve to allow app to continue
        } else if (error?.name === 'VersionError') {
          console.error('📦 IndexedDB: Version error - attempting to recover...');
          reject(new Error('IndexedDB version mismatch. Please refresh the page.'));
        } else {
          // For other errors, mark as broken and continue
          console.warn('📦 IndexedDB: Error opening database, using online-only mode:', error);
          this.isPermanentlyBroken = true;
          resolve();
        }
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        //console.log('📦 IndexedDB: Database opened successfully');
        //console.log('📦 IndexedDB: Available object stores:', Array.from(this.db.objectStoreNames));
        
        // Set up error handler for the database
        this.db.onerror = (event) => {
          //console.error('📦 IndexedDB: Database error:', event);
        };
        
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        //console.log('📦 IndexedDB: Upgrading database schema...');
        this.createObjectStores(db);
        //console.log('📦 IndexedDB: Database schema upgrade complete');
      };
      
      request.onblocked = () => {
        //console.warn('📦 IndexedDB: Database opening blocked. Please close other tabs using this app.');
        reject(new Error('Database is being used by another tab. Please close other tabs and try again.'));
      };
    });
  }

  // Delete the entire database (for recovery from corruption)
  async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      //console.log('📦 IndexedDB: Attempting to delete database:', this.dbName);
      
      // Close existing connection
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      
      deleteRequest.onsuccess = () => {
        console.log('✅ IndexedDB: Database deleted successfully');
        resolve();
      };
      
      deleteRequest.onerror = (event) => {
        console.error('❌ IndexedDB: Failed to delete database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
      
      deleteRequest.onblocked = () => {
        console.warn('⚠️ IndexedDB: Delete blocked - other connections may be open');
        // Try to resolve anyway after a delay - deletion will complete when connections close
        setTimeout(() => {
          console.log('📦 IndexedDB: Proceeding despite blocked state');
          resolve();
        }, 1000);
      };
    });
  }

  // User Data Methods
  async saveUserData(userData: OfflineUserData): Promise<void> {
    // If IndexedDB is unavailable, silently skip
    if (this.isPermanentlyBroken) {
      //console.warn('📦 IndexedDB: Unavailable - skipping user data save');
      return;
    }
    
    if (!this.db) await this.initDB();
    
    // Check again after init
    if (this.isPermanentlyBroken || !this.db) {
      //console.warn('📦 IndexedDB: Unavailable after init - skipping user data save');
      return;
    }
    
    // First, set all other users as inactive (logged out)
    await this.setAllUsersInactive();
    
    // Then save the current user as active
    const activeUserData = { ...userData, isLoggedIn: true };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userData'], 'readwrite');
      const store = transaction.objectStore('userData');
      const request = store.put(activeUserData);

      request.onsuccess = () => {
        //console.log('📦 IndexedDB: User data saved successfully as active user');
        resolve();
      };
      request.onerror = () => {
        //console.warn('📦 IndexedDB: Error saving user data:', request.error);
        resolve(); // Resolve anyway to not block the app
      };
    });
  }

  /**
   * Check if IndexedDB is available and working
   */
  isAvailable(): boolean {
    return !this.isPermanentlyBroken && !!this.db;
  }

  /**
   * Get status information about IndexedDB
   */
  getStatus(): { available: boolean; reason?: string } {
    if (!window.indexedDB) {
      return { available: false, reason: 'IndexedDB not supported in this browser' };
    }
    if (this.isPermanentlyBroken) {
      return { available: false, reason: 'IndexedDB storage corrupted at OS level - using online-only mode' };
    }
    if (!this.db) {
      return { available: false, reason: 'IndexedDB not initialized' };
    }
    return { available: true };
  }

  // Set all users as inactive (logged out)
  async setAllUsersInactive(): Promise<void> {
    if (this.isPermanentlyBroken) {
      return; // Silently skip if unavailable
    }
    
    if (!this.db) await this.initDB();
    
    if (this.isPermanentlyBroken || !this.db) {
      return; // Silently skip if unavailable
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userData'], 'readwrite');
      const store = transaction.objectStore('userData');
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const users = getAllRequest.result;
        let completed = 0;
        const total = users.length;

        if (total === 0) {
          resolve();
          return;
        }

        users.forEach((user: OfflineUserData) => {
          const updatedUser = { ...user, isLoggedIn: false };
          const updateRequest = store.put(updatedUser);
          
          updateRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          };
          updateRequest.onerror = () => {
            console.warn('📦 IndexedDB: Error updating user:', updateRequest.error);
            resolve(); // Resolve anyway
          };
        });
      };
      getAllRequest.onerror = () => {
        console.warn('📦 IndexedDB: Error getting users:', getAllRequest.error);
        resolve(); // Resolve anyway
      };
    });
  }

  // Set a specific user as active and all others as inactive
  async setActiveUser(uid: string): Promise<void> {
    // Check if database is permanently broken
    if (this.isPermanentlyBroken) {
      console.warn('⚠️ IndexedDB: Cannot set active user - database permanently unavailable');
      return;
    }

    if (!this.db) await this.initDB();
    
    // Check again after init attempt
    if (this.isPermanentlyBroken || !this.db) {
      console.warn('⚠️ IndexedDB: Cannot set active user - database still unavailable after init');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['userData'], 'readwrite');
        const store = transaction.objectStore('userData');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const users = getAllRequest.result;
          let completed = 0;
          const total = users.length;

          if (total === 0) {
            resolve();
            return;
          }

          users.forEach((user: OfflineUserData) => {
            const updatedUser = { 
              ...user, 
              isLoggedIn: user.uid === uid 
            };
            const updateRequest = store.put(updatedUser);
            
            updateRequest.onsuccess = () => {
              completed++;
              if (completed === total) {
                console.log(`📦 IndexedDB: User ${uid} set as active, others set inactive`);
                resolve();
              }
            };
            updateRequest.onerror = () => {
              console.error('📦 IndexedDB: Error updating user:', updateRequest.error);
              resolve(); // Resolve anyway
            };
          });
        };
        getAllRequest.onerror = () => {
          console.error('📦 IndexedDB: Error getting users:', getAllRequest.error);
          resolve(); // Resolve anyway
        };
      } catch (error) {
        console.error('📦 IndexedDB: Exception setting active user:', error);
        resolve(); // Resolve anyway
      }
    });
  }

  // Clear all user data from IndexedDB (useful when switching accounts)
  async clearAllUserData(): Promise<void> {
    // Check if database is permanently broken
    if (this.isPermanentlyBroken) {
      console.warn('⚠️ IndexedDB: Cannot clear user data - database permanently unavailable');
      return;
    }

    if (!this.db) await this.initDB();
    
    // Check again after init attempt
    if (this.isPermanentlyBroken || !this.db) {
      console.warn('⚠️ IndexedDB: Cannot clear user data - database still unavailable after init');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['userData'], 'readwrite');
        const store = transaction.objectStore('userData');
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          console.error('📦 IndexedDB: Error clearing user data:', request.error);
          resolve(); // Resolve anyway
        };
      } catch (error) {
        console.error('📦 IndexedDB: Exception clearing user data:', error);
        resolve(); // Resolve anyway
      }
    });
  }

  // Save user data as the only active user (removes all other users)
  async saveUserDataAsOnlyUser(userData: OfflineUserData): Promise<void> {
    if (!this.db) await this.initDB();
    
    try {
      // First, clear all existing user data
      await this.clearAllUserData();
      
      // Then save the new user as the only active user
      const activeUserData = { ...userData, isLoggedIn: true };
      
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['userData'], 'readwrite');
        const store = transaction.objectStore('userData');
        const request = store.put(activeUserData);

        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('📦 IndexedDB: Failed to save user as only user:', error);
      throw error;
    }
  }

  async getUserData(uid: string): Promise<OfflineUserData | null> {
    if (this.isPermanentlyBroken) {
      return null; // Return null if unavailable
    }
    
    if (!this.db) await this.initDB();
    
    if (this.isPermanentlyBroken || !this.db) {
      return null; // Return null if unavailable
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userData'], 'readonly');
      const store = transaction.objectStore('userData');
      const request = store.get(uid);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.warn('📦 IndexedDB: Error getting user data:', request.error);
        resolve(null); // Resolve with null instead of rejecting
      };
    });
  }

  async getCurrentUser(): Promise<OfflineUserData | null> {
    if (this.isPermanentlyBroken) {
      return null; // Return null if unavailable
    }
    
    if (!this.db) await this.initDB();
    
    if (this.isPermanentlyBroken || !this.db) {
      return null; // Return null if unavailable
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userData'], 'readonly');
      const store = transaction.objectStore('userData');
      const request = store.getAll();

      request.onsuccess = () => {
        const users = request.result.filter((user: OfflineUserData) => user.isLoggedIn);
        resolve(users.length > 0 ? users[0] : null);
      };
      request.onerror = () => {
        console.warn('📦 IndexedDB: Error getting current user:', request.error);
        resolve(null); // Resolve with null instead of rejecting
      };
    });
  }

  // Product Methods
  async saveProducts(products: OfflineProduct[]): Promise<void> {
    // Check if database is permanently broken
    if (this.isPermanentlyBroken) {
      console.warn('⚠️ IndexedDB: Cannot save products - database permanently unavailable');
      return;
    }

    if (!this.db) await this.initDB();
    
    // Check again after init attempt
    if (this.isPermanentlyBroken || !this.db) {
      console.warn('⚠️ IndexedDB: Cannot save products - database still unavailable after init');
      return;
    }

    // Improved save: deduplicate by id and by (storeId + barcode or name) to avoid duplicate entries
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['products'], 'readwrite');
        const store = transaction.objectStore('products');

        // Load existing products to compare and dedupe
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          const existing: OfflineProduct[] = getAllReq.result || [];

          // Build lookup by id and by skuKey (storeId|barcode|productName)
          const byId = new Map<string, OfflineProduct>();
          const bySkuKey = new Map<string, OfflineProduct>();
          existing.forEach(p => {
            if (p.id) byId.set(p.id, p);
            const key = `${p.storeId}::${p.barcodeId || ''}::${p.productName || ''}`;
            bySkuKey.set(key, p);
          });

          let pending = 0;
          const finishIfDone = () => {
            if (pending === 0) {
              console.log(`📦 IndexedDB: Saved/updated ${products.length} products`);
              resolve();
            }
          };

          if (!products || products.length === 0) {
            resolve();
            return;
          }

        products.forEach(prod => {
          try {
            // Normalize incoming dates
            const incomingUpdated = prod.lastUpdated instanceof Date ? prod.lastUpdated : new Date(prod.lastUpdated as any);

            // Prefer exact id match
            const existingById = prod.id ? byId.get(prod.id) : undefined;
            if (existingById) {
              const existingUpdated = existingById.lastUpdated instanceof Date ? existingById.lastUpdated : new Date(existingById.lastUpdated as any);
              // Only update if incoming is newer
              if (incomingUpdated.getTime() > existingUpdated.getTime()) {
                pending++;
                const req = store.put(prod);
                req.onsuccess = () => { pending--; finishIfDone(); };
                req.onerror = () => { pending--; reject(req.error); };
              }
              return;
            }

            // Try SKU key match (store + barcode + productName) to catch duplicates from different sources
            const skuKey = `${prod.storeId}::${prod.barcodeId || ''}::${prod.productName || ''}`;
            const existingBySku = bySkuKey.get(skuKey);
            if (existingBySku) {
              // Merge into existing record (keep existing id)
              const merged = { ...existingBySku, ...prod, id: existingBySku.id } as OfflineProduct;
              pending++;
              const req = store.put(merged);
              req.onsuccess = () => { pending--; finishIfDone(); };
              req.onerror = () => { pending--; reject(req.error); };
              return;
            }

            // Otherwise, insert new product
            pending++;
            const putReq = store.put(prod);
            putReq.onsuccess = () => { pending--; finishIfDone(); };
            putReq.onerror = () => { pending--; reject(putReq.error); };
          } catch (err) {
            reject(err);
          }
        });
      };
      getAllReq.onerror = () => {
        console.error('📦 IndexedDB: Error getting products for deduplication:', getAllReq.error);
        resolve(); // Resolve anyway
      };
      } catch (error) {
        console.error('📦 IndexedDB: Exception saving products:', error);
        resolve(); // Resolve anyway
      }
    });
  }

  async getProductsByStore(storeId: string): Promise<OfflineProduct[]> {
    // Check if database is permanently broken
    if (this.isPermanentlyBroken) {
      console.warn('⚠️ IndexedDB: Cannot get products - database permanently unavailable');
      return [];
    }

    if (!this.db) await this.initDB();
    
    // Check again after init attempt
    if (this.isPermanentlyBroken || !this.db) {
      console.warn('⚠️ IndexedDB: Cannot get products - database still unavailable after init');
      return [];
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['products'], 'readonly');
        const store = transaction.objectStore('products');
        const index = store.index('storeId');
        const request = index.getAll(storeId);

        request.onsuccess = () => {
          resolve(request.result || []);
        };
        request.onerror = () => {
          console.error('📦 IndexedDB: Error getting products:', request.error);
          resolve([]); // Return empty array instead of rejecting
        };
      } catch (error) {
        console.error('📦 IndexedDB: Exception getting products:', error);
        resolve([]); // Return empty array instead of rejecting
      }
    });
  }

  /**
   * Update a single product in IndexedDB (for stock updates)
   */
  async updateProduct(productId: string, updates: Partial<any>): Promise<void> {
    await this.initDB();
    if (!this.db) {
      console.error('❌ IndexedDB: Database not initialized for updateProduct');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['products'], 'readwrite');
      const store = transaction.objectStore('products');
      const getRequest = store.get(productId);

      getRequest.onsuccess = () => {
        const product = getRequest.result;
        if (!product) {
          console.warn(`⚠️ IndexedDB: Product ${productId} not found in cache`);
          resolve();
          return;
        }

        const updatedProduct = { ...product, ...updates };
        const putRequest = store.put(updatedProduct);

        putRequest.onsuccess = () => {
          console.log(`✅ IndexedDB: Updated product ${productId} in cache`);
          resolve();
        };

        putRequest.onerror = () => {
          console.error('❌ IndexedDB: Error updating product:', putRequest.error);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        console.error('❌ IndexedDB: Error getting product:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  // ---------------------------
  // Notifications methods
  // ---------------------------
  async saveNotification(notification: any): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      const request = store.put(notification);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getUnreadNotificationsCount(storeId?: string): Promise<number> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notifications'], 'readonly');
      const store = transaction.objectStore('notifications');
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result || [];
        results = results.filter((r: any) => r.read === false);
        if (storeId) {
          results = results.filter((r: any) => r.storeId === storeId);
        }
        resolve(results.length);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      const getReq = store.get(notificationId);

      getReq.onsuccess = () => {
        const rec = getReq.result;
        if (!rec) return resolve();
        rec.read = true;
        rec.readAt = new Date();
        const putReq = store.put(rec);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async getNotificationsByStore(storeId: string): Promise<any[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notifications'], 'readonly');
      const store = transaction.objectStore('notifications');
      const index = store.index('storeId');
      const request = index.getAll(storeId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Order Methods (for offline transactions)
  async saveOrder(order: OfflineOrder): Promise<void> {
    // Check if database is permanently broken
    if (this.isPermanentlyBroken) {
      console.warn('⚠️ IndexedDB: Cannot save order - database permanently unavailable');
      return;
    }

    if (!this.db) await this.initDB();
    
    // Check again after init attempt
    if (this.isPermanentlyBroken || !this.db) {
      console.warn('⚠️ IndexedDB: Cannot save order - database still unavailable after init');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['orders'], 'readwrite');
        const store = transaction.objectStore('orders');
        const request = store.put(order);

      request.onsuccess = () => {
        console.log('📦 IndexedDB: Order saved successfully');
        resolve();
      };
      request.onerror = () => {
        console.error('📦 IndexedDB: Error saving order:', request.error);
        resolve(); // Resolve anyway
      };
      } catch (error) {
        console.error('📦 IndexedDB: Exception saving order:', error);
        resolve(); // Resolve anyway
      }
    });
  }

  async getPendingOrders(storeId: string): Promise<OfflineOrder[]> {
    // Check if database is permanently broken
    if (this.isPermanentlyBroken) {
      console.warn('⚠️ IndexedDB: Cannot get pending orders - database permanently unavailable');
      return [];
    }

    if (!this.db) await this.initDB();
    
    // Check again after init attempt
    if (this.isPermanentlyBroken || !this.db) {
      console.warn('⚠️ IndexedDB: Cannot get pending orders - database still unavailable after init');
      return [];
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['orders'], 'readonly');
        const store = transaction.objectStore('orders');
        const request = store.getAll();

        request.onsuccess = () => {
          const orders = request.result.filter((order: OfflineOrder) => 
            order.storeId === storeId && !order.synced
          );
          resolve(orders);
        };
        request.onerror = () => {
          console.error('📦 IndexedDB: Error getting pending orders:', request.error);
          resolve([]); // Return empty array instead of rejecting
        };
      } catch (error) {
        console.error('📦 IndexedDB: Exception getting pending orders:', error);
        resolve([]); // Return empty array instead of rejecting
      }
    });
  }

  // Settings Methods
  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key: string): Promise<any> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Last-sync helpers (store ISO string)
  async saveLastSync(key: string, isoTimestamp: string): Promise<void> {
    try {
      await this.saveSetting(key, isoTimestamp);
    } catch (e) {
      console.warn('IndexedDB: saveLastSync failed', e);
      throw e;
    }
  }

  async getLastSync(key: string): Promise<string | null> {
    try {
      const val = await this.getSetting(key);
      return val || null;
    } catch (e) {
      console.warn('IndexedDB: getLastSync failed', e);
      return null;
    }
  }

  // Companies and Stores Methods
  async saveCompanies(companies: OfflineCompany[]): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) {
      console.error('📦 IndexedDB: Database not initialized, cannot save companies');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['companies'], 'readwrite');
      const store = transaction.objectStore('companies');

      transaction.oncomplete = () => {
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('📦 IndexedDB: Transaction error saving companies:', transaction.error);
        reject(transaction.error);
      };

      for (const company of companies) {
        // Normalize company shape to match Firestore document structure
        // Helper to convert various timestamp shapes into a JS Date or undefined
        const toDateValue = (val: any): Date | undefined => {
          if (!val && val !== 0) return undefined;
          if (val instanceof Date) return val;
          if (val && typeof val.toDate === 'function') {
            try { return val.toDate(); } catch (e) { /* fallthrough */ }
          }
          if (typeof val === 'string') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? undefined : d;
          }
          // Firestore may serialize timestamps to { seconds, nanoseconds }
          if (val && typeof val.seconds === 'number') {
            return new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
          }
          // Fallback: try to coerce number-like values
          if (typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? undefined : d;
          }
          return undefined;
        };

        // Prefer several possible name fields (company.name, company.company?.name,
        // companyName, displayName) before falling back to the document id.
        // Resolve name but do NOT fall back to the document id.
        const resolvedName = (company as any).name ?? (company as any).company?.name ?? (company as any).companyName ?? (company as any).displayName ?? undefined;
        const resolvedSlug = (company as any).slug ?? (resolvedName ? String(resolvedName).toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined);

        if (!resolvedName) {
          console.warn('💾 IndexedDB: company missing a name field; storing without name for id:', company.id);
        }

        const normalized = {
          id: company.id,
          name: resolvedName,
          slug: resolvedSlug,
          ownerUid: (company as any).ownerUid || (company as any).owner || '',
          address: (company as any).address || undefined,
          email: (company as any).email || undefined,
          logoUrl: (company as any).logoUrl || undefined,
          phone: (company as any).phone || undefined,
          plan: (company as any).plan || undefined,
          taxId: (company as any).taxId || undefined,
          website: (company as any).website || undefined,
          createdAt: toDateValue(company.createdAt) || new Date(),
          updatedAt: toDateValue(company.updatedAt) || new Date(),
          lastSync: new Date()
        } as OfflineCompany;
        const request = store.put(normalized);
        request.onerror = () => {
          console.error('❌ Error saving company:', company.id, request.error);
        };
      }
    });
  }

  // Deprecated: company reads should come from `CompanyService.getCompanyById` so
  // that the application can centralize fetch + offline persistence logic.
  // The explicit IndexedDB-level getter was removed to avoid duplicate logic.

  async getAllCompanies(): Promise<OfflineCompany[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['companies'], 'readonly');
      const store = transaction.objectStore('companies');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export companies as JSON-serializable objects (dates converted to ISO strings).
   * Useful for debugging or diagnostics.
   */
  async exportAllCompanies(): Promise<any[]> {
    const companies = await this.getAllCompanies();
    const toISOStringSafe = (val: any) => {
      if (!val && val !== 0) return val;
      if (val instanceof Date) return val.toISOString();
      if (val && typeof val.toDate === 'function') {
        try { return val.toDate().toISOString(); } catch (e) { /* fallthrough */ }
      }
      if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d.toISOString();
      }
      if (val && typeof val.seconds === 'number') {
        const d = new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
        return d.toISOString();
      }
      if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d.toISOString();
      }
      return val;
    };

    return companies.map(c => ({
      id: c.id,
      name: (c as any).name,
      slug: (c as any).slug,
      ownerUid: (c as any).ownerUid,
      address: (c as any).address,
      email: (c as any).email,
      logoUrl: (c as any).logoUrl,
      phone: (c as any).phone,
      plan: (c as any).plan,
      taxId: (c as any).taxId,
      website: (c as any).website,
      createdAt: toISOStringSafe((c as any).createdAt),
      updatedAt: toISOStringSafe((c as any).updatedAt),
      lastSync: toISOStringSafe((c as any).lastSync)
    }));
  }

  /**
   * Normalize existing companies in IndexedDB to match the latest Company schema.
   * This will update each record to include missing fields (address, plan, taxId, etc.),
   * normalize timestamps to Date, and set a fresh lastSync.
   * Returns the number of records updated.
   */
  async normalizeExistingCompanies(): Promise<number> {
    if (!this.db) await this.initDB();
    if (!this.db) {
      console.warn('📦 IndexedDB: Database not initialized, cannot migrate companies');
      return 0;
    }

    const companies = await this.getAllCompanies();
    if (!companies || companies.length === 0) return 0;

    return new Promise<number>((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['companies'], 'readwrite');
        const store = transaction.objectStore('companies');
        let updated = 0;

        transaction.oncomplete = () => {
          console.log(`📦 IndexedDB: normalizeExistingCompanies complete - updated ${updated} companies`);
          resolve(updated);
        };

        transaction.onerror = () => {
          console.error('📦 IndexedDB: Transaction error during normalizeExistingCompanies', transaction.error);
          reject(transaction.error);
        };

        for (const c of companies) {
          try {
            const normalized = {
              id: c.id,
              name: (c as any).name || c.id,
              slug: (c as any).slug || ((c as any).name ? String((c as any).name).toLowerCase().replace(/[^a-z0-9]+/g, '-') : c.id),
              ownerUid: (c as any).ownerUid || (c as any).owner || '',
              address: (c as any).address || undefined,
              email: (c as any).email || undefined,
              logoUrl: (c as any).logoUrl || undefined,
              phone: (c as any).phone || undefined,
              plan: (c as any).plan || undefined,
              taxId: (c as any).taxId || undefined,
              website: (c as any).website || undefined,
              createdAt: c.createdAt instanceof Date ? c.createdAt : new Date((c as any).createdAt as any),
              updatedAt: c.updatedAt ? (c.updatedAt instanceof Date ? c.updatedAt : new Date((c as any).updatedAt as any)) : new Date(),
              lastSync: new Date()
            } as OfflineCompany;

            const req = store.put(normalized);
            req.onsuccess = () => { updated++; };
            req.onerror = () => { console.error('📦 IndexedDB: Error normalizing company', c.id, req.error); };
          } catch (err) {
            console.error('📦 IndexedDB: Exception normalizing company', c.id, err);
          }
        }
      } catch (err) {
        console.error('📦 IndexedDB: Exception starting normalizeExistingCompanies transaction', err);
        reject(err);
      }
    });
  }

  async saveStores(stores: OfflineStore[]): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) {
      console.error('📦 IndexedDB: Database not initialized, cannot save stores');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['stores'], 'readwrite');
      const store = transaction.objectStore('stores');

      transaction.oncomplete = () => {
        console.log(`📦 IndexedDB: Transaction complete - saved ${stores.length} stores`);
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('📦 IndexedDB: Transaction error saving stores:', transaction.error);
        reject(transaction.error);
      };

      for (const storeData of stores) {
        const request = store.put({ ...storeData, lastSync: new Date() });
        request.onerror = () => {
          console.error('📦 IndexedDB: Error saving store:', storeData.id, request.error);
        };
      }
    });
  }

  async getStoreById(id: string): Promise<OfflineStore | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['stores'], 'readonly');
      const store = transaction.objectStore('stores');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllStores(): Promise<OfflineStore[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['stores'], 'readonly');
      const store = transaction.objectStore('stores');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getStoresByCompanyId(companyId: string): Promise<OfflineStore[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['stores'], 'readonly');
      const store = transaction.objectStore('stores');
      const index = store.index('companyId');
      const request = index.getAll(companyId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Utility Methods
  async clearAllData(): Promise<void> {
    if (!this.db) await this.initDB();

    const storeNames = ['userData', 'products', 'orders', 'settings', 'companies', 'stores'];
    
    for (const storeName of storeNames) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    console.log('📦 IndexedDB: All data cleared');
  }

  /**
   * Clear most offline data but preserve offline authentication entries stored in `settings`.
   * This allows users to sign out and still be able to login offline later.
   */
  async clearAllDataPreserveOfflineAuth(): Promise<void> {
    if (!this.db) await this.initDB();

    // Clear userData, products, orders, companies, stores (but preserve settings keys that start with 'offlineAuth_')
    const storeNames = ['userData', 'products', 'orders', 'companies', 'stores'];
    for (const storeName of storeNames) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // For settings, delete everything except keys starting with 'offlineAuth_'
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = async () => {
        const entries = getAllRequest.result || [];
        try {
          for (const entry of entries) {
            const key = entry?.key;
            if (!key) continue;
            if (!String(key).startsWith('offlineAuth_')) {
              await new Promise<void>((res, rej) => {
                const delReq = store.delete(key);
                delReq.onsuccess = () => res();
                delReq.onerror = () => rej(delReq.error);
              });
            }
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
    });

    console.log('📦 IndexedDB: Data cleared but offline auth preserved');
  }

  async getDatabaseSize(): Promise<number> {
    if (!navigator.storage?.estimate) return 0;
    
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }

  /**
   * Save multiple productInventory batches to IndexedDB
   */
  async saveProductInventoryBatches(batches: any[]): Promise<void> {
    await this.initDB();
    if (!this.db) {
      console.error('❌ IndexedDB: Database not initialized for saveProductInventoryBatches');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['productInventory'], 'readwrite');
      const store = transaction.objectStore('productInventory');

      let completed = 0;
      const total = batches.length;

      if (total === 0) {
        resolve();
        return;
      }

      batches.forEach(batch => {
        const request = store.put(batch);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            console.log(`✅ IndexedDB: Saved ${total} productInventory batches`);
            resolve();
          }
        };

        request.onerror = () => {
          console.error('❌ IndexedDB: Error saving batch:', request.error);
          reject(request.error);
        };
      });
    });
  }

  /**
   * Get productInventory batches for a specific product and store
   * Filters by active status and sorts by createdAt
   */
  async getProductInventoryBatches(
    productId: string,
    storeId: string,
    companyId: string
  ): Promise<any[]> {
    await this.initDB();
    if (!this.db) {
      console.error('❌ IndexedDB: Database not initialized for getProductInventoryBatches');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['productInventory'], 'readonly');
      const store = transaction.objectStore('productInventory');
      const index = store.index('productId');
      const request = index.getAll(productId);

      request.onsuccess = () => {
        const allBatches = request.result || [];
        
        // Filter by storeId, companyId, and status
        const filteredBatches = allBatches.filter((batch: any) => 
          batch.storeId === storeId &&
          batch.companyId === companyId &&
          batch.status === 'active' &&
          batch.quantity > 0
        );

        // Sort by createdAt for FIFO
        filteredBatches.sort((a: any, b: any) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateA - dateB;
        });

        console.log(`📦 IndexedDB: Found ${filteredBatches.length} active batches for product ${productId}`);
        resolve(filteredBatches);
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: Error querying productInventory:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update a productInventory batch quantity
   */
  async updateProductInventoryBatch(batchId: string, updates: Partial<any>): Promise<void> {
    await this.initDB();
    if (!this.db) {
      console.error('❌ IndexedDB: Database not initialized for updateProductInventoryBatch');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['productInventory'], 'readwrite');
      const store = transaction.objectStore('productInventory');
      const getRequest = store.get(batchId);

      getRequest.onsuccess = () => {
        const batch = getRequest.result;
        if (!batch) {
          console.warn(`⚠️ IndexedDB: Batch ${batchId} not found`);
          resolve();
          return;
        }

        const updatedBatch = { ...batch, ...updates };
        const putRequest = store.put(updatedBatch);

        putRequest.onsuccess = () => {
          console.log(`✅ IndexedDB: Updated batch ${batchId}`);
          resolve();
        };

        putRequest.onerror = () => {
          console.error('❌ IndexedDB: Error updating batch:', putRequest.error);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        console.error('❌ IndexedDB: Error getting batch:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * Clear all productInventory data
   */
  async clearProductInventory(): Promise<void> {
    await this.initDB();
    if (!this.db) {
      console.error('❌ IndexedDB: Database not initialized for clearProductInventory');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['productInventory'], 'readwrite');
      const store = transaction.objectStore('productInventory');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('✅ IndexedDB: Cleared productInventory store');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: Error clearing productInventory:', request.error);
        reject(request.error);
      };
    });
  }
}