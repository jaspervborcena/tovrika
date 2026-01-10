import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

export interface Permissions {
  canViewAccess: boolean;
  canViewUserRoles: boolean;
  canAddProducts: boolean;
  canAddStore: boolean;
  canAddUser: boolean;
  canMakePOS: boolean;
  canRemoveUsers: boolean;
  canViewInventory: boolean;
  canViewPOS: boolean;
  canViewProducts: boolean;
  canViewStore: boolean;
  canViewCompanyProfile: boolean;
  canEditCompanyProfile: boolean;
  canAddCompanyProfile: boolean;
  canViewOverview: boolean;
  canViewSalesReports: boolean;
}

@Injectable({ providedIn: 'root' })
export class AccessService {
  private defaultPermissions: Permissions = {
    canViewAccess: true,
    canViewUserRoles: true,
    canAddProducts: true,
    canAddStore: true,
    canAddUser: true,
    canMakePOS: true,
    canRemoveUsers: true,
    canViewInventory: true,
    canViewPOS: true,
    canViewProducts: true,
    canViewStore: true,
    canViewCompanyProfile: true,
    canEditCompanyProfile: true,
    canAddCompanyProfile: true,
    canViewOverview: true,
    canViewSalesReports: true
  };

  private cashierPermissions: Permissions = {
  canViewAccess: false,
  canViewUserRoles: false,
  canAddProducts: false,
  canAddStore: false,
  canAddUser: false,
  canMakePOS: true,
  canRemoveUsers: false,
  canViewInventory: false,
  canViewPOS: true,
  canViewProducts: true,
  canViewStore: false,
  canViewCompanyProfile: true, // minimal view only
  canEditCompanyProfile: false,
  canAddCompanyProfile: false,
  canViewOverview: false,
  canViewSalesReports: false
  };

  private permissionsSignal = signal<Permissions>(this.defaultPermissions);

  setPermissions(permissions: Partial<Permissions>, role?: string) {
    if (role === 'admin') {
      // Admin gets all permissions - full access to everything
      const finalPermissions = { ...this.defaultPermissions, ...permissions };
      this.permissionsSignal.set(finalPermissions);
    } else if (role === 'cashier') {
      const finalPermissions = { ...this.cashierPermissions, ...permissions };
      this.permissionsSignal.set(finalPermissions);
    } else if (role === 'creator' || role === 'store_manager') {
      // Both creator and store_manager get all features for now
      const finalPermissions = { ...this.defaultPermissions, ...permissions };
      this.permissionsSignal.set(finalPermissions);
    } else {
      // Fallback to default permissions
      const finalPermissions = { ...this.defaultPermissions, ...permissions };
      this.permissionsSignal.set(finalPermissions);
    }
  }

  get permissions(): Permissions {
    return this.permissionsSignal();
  }

  canView(key: keyof Permissions): boolean {
    return !!this.permissionsSignal()[key];
  }

  canAdd(key: keyof Permissions): boolean {
    return !!this.permissionsSignal()[key];
  }

  canRemove(key: keyof Permissions): boolean {
    return !!this.permissionsSignal()[key];
  }

  reset() {
    console.log('🔍 [AccessService] Resetting permissions to default');
    this.permissionsSignal.set(this.defaultPermissions);
  }
}
