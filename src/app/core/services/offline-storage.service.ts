import { Injectable, inject, signal, computed } from '@angular/core';
import { User } from '../../services/auth.service';
import { SqliteStorageService, OfflineUserData, OfflineProduct, OfflineOrder } from './sqlite-storage.service';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {
  private sqliteService = inject(SqliteStorageService);
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
      await this.sqliteService.initDB();
      
      // Check SQLite status after initialization
      const status = this.sqliteService.getStatus();
      if (!status.available) {
        console.warn('⚠️ OfflineStorage: SQLite not available:', status.reason);
        console.warn('🔐 App will run in online-only mode - all data comes from Firestore');
        console.warn('👍 This is normal if browser storage is full or corrupted');
        console.warn('💡 To restore offline features: Clear browser data and refresh');
      }
      
      await this.loadOfflineData();
    } catch (error: any) {
      console.error('💾 OfflineStorage: Initialization failed:', error);
      console.warn('📱 App will continue in online-only mode');
      // Don't throw - allow app to continue without offline storage
    }
  }

  // Load offline data into signals
  async loadOfflineData(): Promise<void> {
    try {
      // Ensure database is initialized
      await this.sqliteService.initDB();
      
      // Load current user (will return null if DB is unavailable)
      const currentUser = await this.sqliteService.getCurrentUser();
      this.currentUserSignal.set(currentUser);
      
      // console.log('💾 OfflineStorage: Current user loaded:', {
      //   exists: !!currentUser,
      //   uid: currentUser?.uid,
      //   email: currentUser?.email,
      //   isLoggedIn: currentUser?.isLoggedIn,
      //   isAgreedToPolicy: currentUser?.isAgreedToPolicy
      // });

      if (currentUser?.currentStoreId) {
        // Load products for current store
        const products = await this.sqliteService.getProductsByStore(currentUser.currentStoreId);
        this.productsSignal.set(products);

        // Load pending orders
        const orders = await this.sqliteService.getPendingOrders(currentUser.currentStoreId);
        this.pendingOrdersSignal.set(orders);
        
        //console.log('💾 OfflineStorage: Store data loaded for store:', currentUser.currentStoreId);
      }
    } catch (error: any) {
      //console.error('💾 OfflineStorage: Failed to load data:', error);
      // Always gracefully handle - don't block the app
      //console.warn('⚠️ OfflineStorage: Continuing without cached data');
      // Reset signals to empty state
      this.currentUserSignal.set(null);
      this.productsSignal.set([]);
      this.pendingOrdersSignal.set([]);
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
                           
      // Normalize permissions: select a single active permission to avoid confusion
      let activePermission = null as any;
      const perms = Array.isArray(userData.permissions) ? userData.permissions : (userData.permissions ? [userData.permissions] : []);

      // 1) If currentCompanyId is set, prefer permission for that company
      if (userData.currentCompanyId) {
        activePermission = perms.find((p: any) => p.companyId === userData.currentCompanyId) || null;
      }

      // 2) Prefer first non-visitor role
      if (!activePermission) {
        activePermission = perms.find((p: any) => p.roleId && p.roleId !== 'visitor') || null;
      }

      // 3) Prefer first permission with a companyId
      if (!activePermission) {
        activePermission = perms.find((p: any) => p.companyId && String(p.companyId).trim() !== '') || null;
      }

      // 4) Fallback to first permission if exists
      if (!activePermission && perms.length > 0) {
        activePermission = perms[0];
      }

      // If still null, create a visitor permission placeholder
      if (!activePermission) {
        activePermission = { companyId: '', roleId: 'visitor' };
      }

      const offlineUserData: OfflineUserData = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        userCode: userData.userCode,
        pin: userData.pin,
        status: userData.status,
        // Prefer roleId from the active permission
        roleId: activePermission.roleId || (userData as any).roleId,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        branchId: userData.branchId,
        // Store only the deduplicated active permission to avoid ambiguity
        permissions: [
          {
            companyId: activePermission.companyId || '',
            roleId: activePermission.roleId || 'visitor',
            storeId: activePermission.storeId
          }
        ],
        currentCompanyId: userData.currentCompanyId || activePermission.companyId || undefined,
        isLoggedIn: true,
        isAgreedToPolicy: userData.isAgreedToPolicy || false,
        currentStoreId: currentStoreId || activePermission.storeId,
        lastSync: new Date()
      };
      
      // Always set the signal first (so user data is available even if SQLite fails)
      this.currentUserSignal.set(offlineUserData);
      
      // Try to save to SQLite (optional)
      try {
        await this.sqliteService.initDB();
        // Use the new method that clears all previous users and saves only the current one
        await this.sqliteService.saveUserDataAsOnlyUser(offlineUserData);
      } catch (dbError: any) {
        // Check if SQLite is permanently broken
        if (dbError.message?.includes('permanently unavailable')) {
          console.warn('⚠️ OfflineStorage: SQLite permanently unavailable - user data saved in memory only');
          console.warn('📝 To restore offline functionality: Clear browser data (Ctrl+Shift+Delete) and refresh');
          return; // Don't throw - signal already set
        }
        
        console.warn('💾 OfflineStorage: Database init failed, attempting recovery:', dbError);
        // Try one more time
        try {
          await this.sqliteService.initDB();
          await this.sqliteService.saveUserDataAsOnlyUser(offlineUserData);
        } catch (retryError: any) {
          if (retryError.message?.includes('permanently unavailable')) {
            console.warn('⚠️ OfflineStorage: SQLite permanently unavailable after retry - user data in memory only');
            return; // Don't throw - signal already set
          }
          throw retryError; // Re-throw other errors
        }
      }
    } catch (error: any) {
      console.error('💾 OfflineStorage: Failed to save user session:', error);
      // Don't throw error - allow app to continue without offline storage
      console.warn('⚠️ Continuing without offline storage capabilities');
    }
  }

  async updatePolicyAgreement(agreed: boolean): Promise<void> {
    const currentUser = this.currentUserSignal();
    console.log('💾 OfflineStorage: updatePolicyAgreement - Current user signal:', {
      exists: !!currentUser,
      uid: currentUser?.uid,
      email: currentUser?.email,
      isLoggedIn: currentUser?.isLoggedIn
    });
    
    if (!currentUser) {
      console.error('💾 OfflineStorage: No current user found for policy update');
      throw new Error('No current user found');
    }

    try {
      const updatedUser = { ...currentUser, isAgreedToPolicy: agreed, lastSync: new Date() };
      await this.sqliteService.saveUserData(updatedUser);
      this.currentUserSignal.set(updatedUser);
      
      console.log('💾 OfflineStorage: Policy agreement updated:', agreed);
      console.log('💾 OfflineStorage: Updated user data:', {
        uid: updatedUser.uid,
        email: updatedUser.email,
        isAgreedToPolicy: updatedUser.isAgreedToPolicy
      });
    } catch (error: any) {
      console.error('💾 OfflineStorage: Failed to update policy agreement:', error);
      // Check if permanently broken
      if (error.message?.includes('permanently unavailable')) {
        console.warn('⚠️ OfflineStorage: SQLite permanently unavailable - updating in-memory state only');
        // Update in-memory state even if SQLite fails
        const updatedUser = { ...currentUser, isAgreedToPolicy: agreed, lastSync: new Date() };
        this.currentUserSignal.set(updatedUser);
        console.log('✅ OfflineStorage: Policy agreement updated in memory only');
        return; // Don't throw - allow app to continue
      }
      throw error;
    }
  }

  // Force refresh user data from SQLite
  async refreshUserData(): Promise<void> {
    try {
      console.log('💾 OfflineStorage: Refreshing user data...');
      const currentUser = await this.sqliteService.getCurrentUser();
      this.currentUserSignal.set(currentUser);
      
      console.log('💾 OfflineStorage: User data refreshed:', {
        exists: !!currentUser,
        uid: currentUser?.uid,
        isAgreedToPolicy: currentUser?.isAgreedToPolicy
      });
    } catch (error: any) {
      console.error('💾 OfflineStorage: Failed to refresh user data:', error);
      // Check if permanently broken
      if (error.message?.includes('permanently unavailable')) {
        console.warn('⚠️ OfflineStorage: SQLite permanently unavailable - cannot refresh from cache');
        return; // Don't throw - allow app to continue
      }
      throw error;
    }
  }

  // Set active user by UID (useful when switching between users in the same browser)
  async setActiveUser(uid: string): Promise<void> {
    try {
      console.log('💾 OfflineStorage: Setting active user:', uid);
      
      // Set the user as active in SQLite
      await this.sqliteService.setActiveUser(uid);
      
      // Refresh user data to update the signal
      await this.refreshUserData();
      
      console.log('💾 OfflineStorage: Active user set successfully');
    } catch (error: any) {
      console.error('💾 OfflineStorage: Failed to set active user:', error);
      throw error;
    }
  }

  // Clear all user data (for switching accounts)
  async clearAllUserData(): Promise<void> {
    try {
      console.log('💾 OfflineStorage: Clearing all user data...');
      
      // Clear the signal
      this.currentUserSignal.set(null);
      
      // Clear SQLite user data
      await this.sqliteService.clearAllUserData();
      
      console.log('💾 OfflineStorage: All user data cleared successfully');
    } catch (error: any) {
      console.error('💾 OfflineStorage: Failed to clear user data:', error);
      throw error;
    }
  }

  async updateStoreId(storeId: string): Promise<void> {
    const currentUser = this.currentUserSignal();
    if (!currentUser) return;

    try {
      const updatedUser = { ...currentUser, storeId, lastSync: new Date() };
      await this.sqliteService.saveUserData(updatedUser);
      this.currentUserSignal.set(updatedUser);

      // Load products for the new store
      const products = await this.sqliteService.getProductsByStore(storeId);
      this.productsSignal.set(products);

      // Load pending orders for the new store
      const orders = await this.sqliteService.getPendingOrders(storeId);
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
      await this.sqliteService.saveUserData(updatedUser);
      
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
      await this.sqliteService.saveProducts(products);
      
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
    return this.products().find(p => p.barcodeId === barcode);
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

      await this.sqliteService.saveOrder(fullOrder);
      
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
    // This would update the order in SQLite to mark it as synced
    // Implementation depends on your backend sync logic
  }

  // Utility Methods
  async clearOfflineData(): Promise<void> {
    try {
      // Clear most offline data but preserve offline auth entries so users can still login offline
      // after signing out. This prevents accidental removal of offline credentials.
      if (typeof this.sqliteService.clearAllDataPreserveOfflineAuth === 'function') {
        await this.sqliteService.clearAllDataPreserveOfflineAuth();
      } else {
        await this.sqliteService.clearAllData();
      }
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
      const isSupported = 'sqlite' in window;
      const currentSize = await this.sqliteService.getDatabaseSize();
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