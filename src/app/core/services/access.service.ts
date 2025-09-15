import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

export interface Permissions {
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
    canAddProducts: false,
    canAddStore: false,
    canAddUser: false,
    canMakePOS: false,
    canRemoveUsers: false,
    canViewInventory: false,
    canViewPOS: true,
    canViewProducts: true,
    canViewStore: false,
    canViewCompanyProfile: true,
    canEditCompanyProfile: true,
    canAddCompanyProfile: true,
    canViewOverview: false
  };

  private permissionsSignal = signal<Permissions>(this.defaultPermissions);

  setPermissions(permissions: Partial<Permissions>) {
    this.permissionsSignal.set({ ...this.defaultPermissions, ...permissions });
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
