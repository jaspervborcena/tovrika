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

  async initDB(): Promise<void> {
    // Check if IndexedDB is permanently broken
    if (this.isPermanentlyBroken) {
      throw new Error('IndexedDB is permanently unavailable. Please clear browser data and refresh.');
    }

    // Check if IndexedDB is available
    if (!window.indexedDB) {
      console.warn('📦 IndexedDB: Not available in this browser');
      this.isPermanentlyBroken = true;
      throw new Error('IndexedDB is not supported in this browser');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        const error = request.error;
        console.error('📦 IndexedDB: Failed to open database:', error);
        
        // Check for specific errors
        if (error?.name === 'UnknownError') {
          console.error('📦 IndexedDB: UnknownError - Database may be corrupted. Attempting to delete and recreate...');
          // Attempt to delete the corrupted database
          this.deleteDatabase()
            .then(() => {
              console.log('📦 IndexedDB: Corrupted database deleted. Please refresh the page to recreate.');
              reject(new Error('IndexedDB was corrupted and has been reset. Please refresh the page.'));
            })
            .catch((deleteError) => {
              console.error('📦 IndexedDB: Failed to delete corrupted database:', deleteError);
              // Mark as permanently broken to stop retry attempts
              this.isPermanentlyBroken = true;
              reject(new Error('IndexedDB is corrupted and cannot be reset. Please clear browser data manually (Ctrl+Shift+Delete) and refresh.'));
            });
        } else if (error?.name === 'VersionError') {
          console.error('📦 IndexedDB: Version error - attempting to recover...');
          reject(new Error('IndexedDB version mismatch. Please refresh the page.'));
        } else {
          reject(error);
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

        // App settings store
        if (!db.objectStoreNames.contains('settings')) {
          const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
          console.log('📦 IndexedDB: Created settings store');
        }
        
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
      // Close existing connection
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      
      deleteRequest.onsuccess = () => {
        console.log('📦 IndexedDB: Database deleted successfully');
        resolve();
      };
      
      deleteRequest.onerror = (event) => {
        console.error('📦 IndexedDB: Failed to delete database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
      
      deleteRequest.onblocked = () => {
        console.warn('📦 IndexedDB: Delete blocked. Please close all tabs using this app.');
        reject(new Error('Database deletion blocked by other tabs'));
      };
    });
  }

  // User Data Methods
  async saveUserData(userData: OfflineUserData): Promise<void> {
    if (!this.db) await this.initDB();
    
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
      request.onerror = () => reject(request.error);
    });
  }

  // Set all users as inactive (logged out)
  async setAllUsersInactive(): Promise<void> {
    if (!this.db) await this.initDB();

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
          updateRequest.onerror = () => reject(updateRequest.error);
        });
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  // Set a specific user as active and all others as inactive
  async setActiveUser(uid: string): Promise<void> {
    if (!this.db) await this.initDB();

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
          updateRequest.onerror = () => reject(updateRequest.error);
        });
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  // Clear all user data from IndexedDB (useful when switching accounts)
  async clearAllUserData(): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userData'], 'readwrite');
      const store = transaction.objectStore('userData');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('📦 IndexedDB: All user data cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
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
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userData'], 'readonly');
      const store = transaction.objectStore('userData');
      const request = store.get(uid);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getCurrentUser(): Promise<OfflineUserData | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userData'], 'readonly');
      const store = transaction.objectStore('userData');
      const request = store.getAll();

      request.onsuccess = () => {
        const users = request.result.filter((user: OfflineUserData) => user.isLoggedIn);
        resolve(users.length > 0 ? users[0] : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Product Methods
  async saveProducts(products: OfflineProduct[]): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['products'], 'readwrite');
      const store = transaction.objectStore('products');
      
      let completed = 0;
      const total = products.length;

      if (total === 0) {
        resolve();
        return;
      }

      products.forEach(product => {
        const request = store.put(product);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            console.log(`📦 IndexedDB: Saved ${total} products`);
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getProductsByStore(storeId: string): Promise<OfflineProduct[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['products'], 'readonly');
      const store = transaction.objectStore('products');
      const index = store.index('storeId');
      const request = index.getAll(storeId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Order Methods (for offline transactions)
  async saveOrder(order: OfflineOrder): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['orders'], 'readwrite');
      const store = transaction.objectStore('orders');
      const request = store.put(order);

      request.onsuccess = () => {
        console.log('📦 IndexedDB: Order saved successfully');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingOrders(storeId: string): Promise<OfflineOrder[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['orders'], 'readonly');
      const store = transaction.objectStore('orders');
      const request = store.getAll();

      request.onsuccess = () => {
        const orders = request.result.filter((order: OfflineOrder) => 
          order.storeId === storeId && !order.synced
        );
        resolve(orders);
      };
      request.onerror = () => reject(request.error);
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

  async getDatabaseSize(): Promise<number> {
    if (!navigator.storage?.estimate) return 0;
    
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
}