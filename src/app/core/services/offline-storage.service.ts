import { Injectable, inject, signal, computed } from '@angular/core';
import { User } from '../../services/auth.service';
import { IndexedDBService, OfflineUserData, OfflineProduct, OfflineOrder } from './indexeddb.service';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {
  private indexedDBService = inject(IndexedDBService);
  private networkService = inject(NetworkService);

  // Signals for offline data
  private currentUserSignal = signal<OfflineUserData | null>(null);
  private productsSignal = signal<OfflineProduct[]>([]);
  private pendingOrdersSignal = signal<OfflineOrder[]>([]);

  // Computed properties
  readonly currentUser = computed(() => this.currentUserSignal());
  readonly products = computed(() => this.productsSignal());
  readonly pendingOrders = computed(() => this.pendingOrdersSignal());
  readonly isOfflineMode = computed(() => !this.networkService.isOnline());
  readonly hasPendingSync = computed(() => this.pendingOrders().length > 0);

  constructor() {
    this.initOfflineStorage();
  }

  private async initOfflineStorage(): Promise<void> {
    try {
      await this.indexedDBService.initDB();
      await this.loadOfflineData();
      console.log('💾 OfflineStorage: Initialization complete');
    } catch (error) {
      console.error('💾 OfflineStorage: Initialization failed:', error);
    }
  }

  // Load offline data into signals
  async loadOfflineData(): Promise<void> {
    try {
      // Load current user
      const currentUser = await this.indexedDBService.getCurrentUser();
      this.currentUserSignal.set(currentUser);

      if (currentUser?.currentStoreId) {
        // Load products for current store
        const products = await this.indexedDBService.getProductsByStore(currentUser.currentStoreId);
        this.productsSignal.set(products);

        // Load pending orders
        const orders = await this.indexedDBService.getPendingOrders(currentUser.currentStoreId);
        this.pendingOrdersSignal.set(orders);
      }

      console.log('💾 OfflineStorage: Data loaded successfully');
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to load data:', error);
    }
  }

  // User Management
  async saveUserSession(userData: User & {
    isAgreedToPolicy?: boolean;
    currentStoreId?: string;
  }): Promise<void> {
    try {
      // Get the current store ID from permissions or passed parameter
      const currentStoreId = userData.currentStoreId || 
                           userData.permissions?.[0]?.storeId || 
                           undefined;
                           
      const offlineUserData: OfflineUserData = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        status: userData.status,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        branchId: userData.branchId,
        permissions: userData.permissions || [],
        currentCompanyId: userData.currentCompanyId,
        isLoggedIn: true,
        isAgreedToPolicy: userData.isAgreedToPolicy || false,
        currentStoreId: currentStoreId,
        lastSync: new Date()
      };

      await this.indexedDBService.saveUserData(offlineUserData);
      this.currentUserSignal.set(offlineUserData);
      
      console.log('💾 OfflineStorage: User session saved');
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to save user session:', error);
      throw error;
    }
  }

  async updatePolicyAgreement(agreed: boolean): Promise<void> {
    const currentUser = this.currentUserSignal();
    if (!currentUser) return;

    try {
      const updatedUser = { ...currentUser, isAgreedToPolicy: agreed };
      await this.indexedDBService.saveUserData(updatedUser);
      this.currentUserSignal.set(updatedUser);
      
      console.log('💾 OfflineStorage: Policy agreement updated:', agreed);
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to update policy agreement:', error);
      throw error;
    }
  }

  async updateStoreId(storeId: string): Promise<void> {
    const currentUser = this.currentUserSignal();
    if (!currentUser) return;

    try {
      const updatedUser = { ...currentUser, storeId, lastSync: new Date() };
      await this.indexedDBService.saveUserData(updatedUser);
      this.currentUserSignal.set(updatedUser);

      // Load products for the new store
      const products = await this.indexedDBService.getProductsByStore(storeId);
      this.productsSignal.set(products);

      // Load pending orders for the new store
      const orders = await this.indexedDBService.getPendingOrders(storeId);
      this.pendingOrdersSignal.set(orders);

      console.log('💾 OfflineStorage: Store ID updated to:', storeId);
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to update store ID:', error);
      throw error;
    }
  }

  async logoutUser(): Promise<void> {
    const currentUser = this.currentUserSignal();
    if (!currentUser) return;

    try {
      const updatedUser = { ...currentUser, isLoggedIn: false };
      await this.indexedDBService.saveUserData(updatedUser);
      
      // Clear signals
      this.currentUserSignal.set(null);
      this.productsSignal.set([]);
      this.pendingOrdersSignal.set([]);

      console.log('💾 OfflineStorage: User logged out');
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to logout user:', error);
      throw error;
    }
  }

  // Product Management
  async syncProducts(products: OfflineProduct[]): Promise<void> {
    try {
      await this.indexedDBService.saveProducts(products);
      
      // Update signal if products are for current store
      const currentUser = this.currentUserSignal();
      if (currentUser?.currentStoreId) {
        const storeProducts = products.filter(p => p.storeId === currentUser.currentStoreId);
        if (storeProducts.length > 0) {
          this.productsSignal.set(storeProducts);
        }
      }

      console.log(`💾 OfflineStorage: Synced ${products.length} products`);
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to sync products:', error);
      throw error;
    }
  }

  getProductById(productId: string): OfflineProduct | undefined {
    return this.products().find(p => p.id === productId);
  }

  getProductByBarcode(barcode: string): OfflineProduct | undefined {
    return this.products().find(p => p.barcode === barcode);
  }

  // Order Management (for offline transactions)
  async saveOfflineOrder(order: Omit<OfflineOrder, 'id' | 'synced'>): Promise<string> {
    try {
      const orderId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fullOrder: OfflineOrder = {
        ...order,
        id: orderId,
        synced: false
      };

      await this.indexedDBService.saveOrder(fullOrder);
      
      // Update pending orders signal
      const currentOrders = this.pendingOrdersSignal();
      this.pendingOrdersSignal.set([...currentOrders, fullOrder]);

      console.log('💾 OfflineStorage: Offline order saved:', orderId);
      return orderId;
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to save offline order:', error);
      throw error;
    }
  }

  // Sync Management
  async syncPendingOrders(): Promise<{ synced: number; failed: number }> {
    if (!this.networkService.isOnline()) {
      console.log('💾 OfflineStorage: Cannot sync - offline');
      return { synced: 0, failed: 0 };
    }

    const pendingOrders = this.pendingOrders();
    let synced = 0;
    let failed = 0;

    for (const order of pendingOrders) {
      try {
        // Here you would sync with your backend API
        // For now, we'll just mark as synced
        await this.markOrderAsSynced(order.id);
        synced++;
      } catch (error) {
        console.error('💾 OfflineStorage: Failed to sync order:', order.id, error);
        failed++;
      }
    }

    // Refresh pending orders
    await this.loadOfflineData();

    console.log(`💾 OfflineStorage: Sync complete - ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  private async markOrderAsSynced(orderId: string): Promise<void> {
    // This would update the order in IndexedDB to mark it as synced
    // Implementation depends on your backend sync logic
  }

  // Utility Methods
  async clearOfflineData(): Promise<void> {
    try {
      await this.indexedDBService.clearAllData();
      this.currentUserSignal.set(null);
      this.productsSignal.set([]);
      this.pendingOrdersSignal.set([]);
      
      console.log('💾 OfflineStorage: All offline data cleared');
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to clear data:', error);
      throw error;
    }
  }

  async getStorageInfo(): Promise<{
    isSupported: boolean;
    currentSize: number;
    hasData: boolean;
  }> {
    try {
      const isSupported = 'indexedDB' in window;
      const currentSize = await this.indexedDBService.getDatabaseSize();
      const currentUser = this.currentUserSignal();
      const hasData = !!currentUser || this.products().length > 0;

      return {
        isSupported,
        currentSize,
        hasData
      };
    } catch (error) {
      console.error('💾 OfflineStorage: Failed to get storage info:', error);
      return {
        isSupported: false,
        currentSize: 0,
        hasData: false
      };
    }
  }
}