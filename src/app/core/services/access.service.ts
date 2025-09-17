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
    canViewOverview: true
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
  canViewOverview: false
  };

  private permissionsSignal = signal<Permissions>(this.defaultPermissions);

  setPermissions(permissions: Partial<Permissions>, role?: string) {
    if (role === 'cashier') {
      this.permissionsSignal.set({ ...this.cashierPermissions, ...permissions });
    } else if (role === 'creator' || role === 'store_manager') {
      // Both creator and store_manager get all features for now
      this.permissionsSignal.set({ ...this.defaultPermissions, ...permissions });
    } else {
      // Fallback to default permissions
      this.permissionsSignal.set({ ...this.defaultPermissions, ...permissions });
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
}
