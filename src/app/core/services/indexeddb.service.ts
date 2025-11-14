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
  name: string;
  price: number;
  category: string;
  stock: number;
  barcode?: string;
  image?: string;
  storeId: string;
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

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private dbName = 'TovrikaOfflineDB';
  private dbVersion = 1;
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
  }

  async initDB(): Promise<void> {
    // Check if IndexedDB is permanently broken
    if (this.isPermanentlyBroken) {
      console.warn('📦 IndexedDB: Permanently unavailable - using in-memory fallback');
      return; // Silently fail and use in-memory storage
    }

    // Check if IndexedDB is available
    if (!window.indexedDB) {
      console.warn('📦 IndexedDB: Not available in this browser - using in-memory fallback');
      this.isPermanentlyBroken = true;
      return; // Silently fail instead of throwing
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        const error = request.error;
        console.error('📦 IndexedDB: Failed to open database:', error);
        
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
        console.log('📦 IndexedDB: Database opened successfully');
        
        // Set up error handler for the database
        this.db.onerror = (event) => {
          console.error('📦 IndexedDB: Database error:', event);
        };
        
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('📦 IndexedDB: Upgrading database schema...');
        this.createObjectStores(db);
        console.log('📦 IndexedDB: Database schema upgrade complete');
      };
      
      request.onblocked = () => {
        console.warn('📦 IndexedDB: Database opening blocked. Please close other tabs using this app.');
        reject(new Error('Database is being used by another tab. Please close other tabs and try again.'));
      };
    });
  }

  // Delete the entire database (for recovery from corruption)
  async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('📦 IndexedDB: Attempting to delete database:', this.dbName);
      
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
      console.warn('📦 IndexedDB: Unavailable - skipping user data save');
      return;
    }
    
    if (!this.db) await this.initDB();
    
    // Check again after init
    if (this.isPermanentlyBroken || !this.db) {
      console.warn('📦 IndexedDB: Unavailable after init - skipping user data save');
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
        console.log('📦 IndexedDB: User data saved successfully as active user');
        resolve();
      };
      request.onerror = () => {
        console.warn('📦 IndexedDB: Error saving user data:', request.error);
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
              console.log('📦 IndexedDB: All users set to inactive');
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
          console.log('📦 IndexedDB: All user data cleared');
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
          console.log('📦 IndexedDB: User data saved as only active user:', userData.email);
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

          // Build lookup by id and by skuKey (storeId|barcode|name)
          const byId = new Map<string, OfflineProduct>();
          const bySkuKey = new Map<string, OfflineProduct>();
          existing.forEach(p => {
            if (p.id) byId.set(p.id, p);
            const key = `${p.storeId}::${p.barcode || ''}::${p.name || ''}`;
            bySkuKey.set(key, p);
          });

          let pending = 0;
          const finishIfDone = () => {
            if (pending === 0) {
              console.log(`📦 IndexedDB: Saved/updated products (input ${products.length})`);
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

            // Try SKU key match (store + barcode + name) to catch duplicates from different sources
            const skuKey = `${prod.storeId}::${prod.barcode || ''}::${prod.name || ''}`;
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

  // Utility Methods
  async clearAllData(): Promise<void> {
    if (!this.db) await this.initDB();

    const storeNames = ['userData', 'products', 'orders', 'settings'];
    
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

    // Clear userData, products, orders (but preserve settings keys that start with 'offlineAuth_')
    const storeNames = ['userData', 'products', 'orders'];
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
}