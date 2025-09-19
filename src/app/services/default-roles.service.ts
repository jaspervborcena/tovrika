import { Injectable } from '@angular/core';
import { RoleDefinition, RolePermissions } from './role-definition.service';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class DefaultRolesService {
  constructor(private firestore: Firestore) {}

  getDefaultRoles(companyId: string, storeId: string): RoleDefinition[] {
    const now = new Date();
    return [
      {
        roleId: 'creator',
        companyId,
        storeId,
        permissions: {
          canViewPOS: true,
          canAddStore: true,
          canAddProducts: true,
          canViewProducts: true,
          canViewStore: true,
          canViewInventory: true,
          canRemoveUsers: true,
          canAddUser: true,
          canMakePOS: true,
          canViewCompanyProfile: true,
          canEditCompanyProfile: true,
          canAddCompanyProfile: true,
          canViewOverview: true
        },
        createdAt: now,
        updatedAt: now
      },
      {
        roleId: 'store_manager',
        companyId,
        storeId,
        permissions: {
          canViewPOS: true,
          canAddStore: true,
          canAddProducts: true,
          canViewProducts: true,
          canViewStore: true,
          canViewInventory: true,
          canRemoveUsers: true,
          canAddUser: true,
          canMakePOS: true,
          canViewCompanyProfile: true,
          canEditCompanyProfile: true,
          canAddCompanyProfile: true,
          canViewOverview: true
        },
        createdAt: now,
        updatedAt: now
      },
      {
        roleId: 'cashier',
        companyId,
        storeId,
        permissions: {
          canViewPOS: true,
          canAddStore: false,
          canAddProducts: false,
          canViewProducts: true,
          canViewStore: false,
          canViewInventory: false,
          canRemoveUsers: false,
          canAddUser: false,
          canMakePOS: true,
          canViewCompanyProfile: true,
          canEditCompanyProfile: false,
          canAddCompanyProfile: false,
          canViewOverview: false
        },
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  async createDefaultRoles(companyId: string, storeId: string): Promise<void> {
    const roles = this.getDefaultRoles(companyId, storeId);
    const roleDefsRef = collection(this.firestore, 'roleDefinition');
    for (const role of roles) {
      await addDoc(roleDefsRef, role);
    }
  }
}
