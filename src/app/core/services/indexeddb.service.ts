import { Injectable } from '@angular/core';

export interface OfflineUserData {
  uid: string;
  isLoggedIn: boolean;
  isAgreedToPolicy: boolean;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  company: {
    id: string;
    name: string;
  };
  storeId: string;
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

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('📦 IndexedDB: Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

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
      };
    });
  }

  // User Data Methods
  async saveUserData(userData: OfflineUserData): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userData'], 'readwrite');
      const store = transaction.objectStore('userData');
      const request = store.put(userData);

      request.onsuccess = () => {
        console.log('📦 IndexedDB: User data saved successfully');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
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