import { Injectable } from '@angular/core';
import { OfflineUserData, UserPermission } from '../core/services/sqlite-storage.service';

@Injectable({
  providedIn: 'root'
})
export class PosUtilsService {

  /**
   * Get the active permission for a user from their offline data
   * Prioritizes a specific store if provided, otherwise returns first permission
   */
  getActivePermission(offlineUserData: OfflineUserData, preferredStoreId?: string): UserPermission | null {
    if (!offlineUserData?.permissions || offlineUserData.permissions.length === 0) {
      return null;
    }

    // If preferredStoreId is provided, try to find a permission for that store
    if (preferredStoreId) {
      const preferredPermission = offlineUserData.permissions.find(p => p.storeId === preferredStoreId);
      if (preferredPermission) {
        return preferredPermission;
      }
    }

    // Return the first permission
    return offlineUserData.permissions[0];
  }

  /**
   * Extract store initialization logic that's common between POS and POS Mobile
   */
  async getStoreFromSQLite(
    getUserData: (uid: string) => Promise<OfflineUserData | null>,
    currentUser: any,
    availableStores: any[]
  ): Promise<{ storeId: string; companyId: string } | null> {
    try {
      const offlineUserData = await getUserData(currentUser?.uid || '');
      
      if (offlineUserData?.currentStoreId) {
        // Verify the store exists in availableStores before selecting
        const storeExists = availableStores.find(store => store.id === offlineUserData.currentStoreId);
        
        if (storeExists) {
          const permission = this.getActivePermission(offlineUserData, offlineUserData.currentStoreId);
          return {
            storeId: offlineUserData.currentStoreId,
            companyId: permission?.companyId || storeExists.companyId
          };
        }
      }
      
      // If no currentStoreId, try to get from permissions in SQLite
      if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
        const permission = this.getActivePermission(offlineUserData);
        if (permission?.storeId) {
          const storeExists = availableStores.find(store => store.id === permission.storeId);
          
          if (storeExists) {
            return {
              storeId: permission.storeId,
              companyId: permission.companyId
            };
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not retrieve userData from SQLite:', error);
    }

    return null;
  }

  /**
   * Get company ID from SQLite for a specific store
   */
  async getCompanyIdFromSQLite(
    getUserData: (uid: string) => Promise<OfflineUserData | null>,
    currentUser: any,
    storeId: string
  ): Promise<string | null> {
    try {
      const offlineUserData = await getUserData(currentUser?.uid || '');
      
      if (offlineUserData?.permissions) {
        const permission = this.getActivePermission(offlineUserData, storeId);
        return permission?.companyId || null;
      }
    } catch (error) {
      console.log('⚠️ Could not get companyId from SQLite:', error);
    }

    return null;
  }

  /**
   * Log store selection information consistently
   */
  logStoreSelection(prefix: string, storeId: string, stores: any[]): void {
    console.log(`🎯 ${prefix} selectStore called with storeId:`, storeId);
    console.log(`🏪 ${prefix} Available stores:`, stores.map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
  }

  /**
   * Log initialization information consistently  
   */
  logInitialization(prefix: string, attempt: number, maxRetries: number, storeCount: number): void {
    console.log(`🏪 ${prefix} Store initialization attempt ${attempt}/${maxRetries} - Available stores:`, storeCount);
  }
}