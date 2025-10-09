import { Injectable, computed, signal } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  addDoc
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';

export interface RolePermissions {
  canViewPOS: boolean;
  canAddStore: boolean;
  canAddProducts: boolean;
  canViewProducts: boolean;
  canViewStore: boolean;
  canViewInventory: boolean;
  canRemoveUsers: boolean;
  canAddUser: boolean;
  canMakePOS: boolean;
  canViewCompanyProfile: boolean;
  canEditCompanyProfile: boolean;
  canAddCompanyProfile: boolean;
  canViewOverview: boolean;
}

export interface RoleDefinition {
  id?: string;
  roleId: string;
  companyId: string;
  storeId?: string | null;
  permissions: RolePermissions;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RoleDefinitionService {
  private readonly roleDefinitionsSignal = signal<RoleDefinition[]>([]);
  
  // Public signals
  readonly roleDefinitions = computed(() => this.roleDefinitionsSignal());
  
  // Computed properties
  public readonly totalRoles = computed(() => this.roleDefinitionsSignal().length);

  constructor(
    private firestore: Firestore, 
    private authService: AuthService,
    private firestoreSecurityService: FirestoreSecurityService,
    private offlineDocService: OfflineDocumentService
  ) {
    // Don't auto-load roles in constructor, let components trigger loading
  }
  

  public async loadRoleDefinitions() {
    try {
      const currentUser = await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      
      if (!currentUser || !currentPermission?.companyId) {
        console.warn('No current user or companyId found');
        this.roleDefinitionsSignal.set([]);
        return;
      }

      const roleDefsRef = collection(this.firestore, 'roleDefinition');
      const q = query(roleDefsRef, where('companyId', '==', currentPermission.companyId));
      
      const querySnapshot = await getDocs(q);
      console.log('🔍 [RoleDefinitionService] Raw query results:', querySnapshot.size, 'documents found');
      
      const roleDefs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('🔍 [RoleDefinitionService] Processing role definition:', doc.id, data);
        return {
          id: doc.id,
          ...data,
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        };
      }) as RoleDefinition[];
      
      console.log('🔍 [RoleDefinitionService] Final role definitions array:', roleDefs);
      console.log('🔍 [RoleDefinitionService] Checking for duplicates...');
      
      // Check for duplicates by roleId + storeId combination
      const roleKeyCounts = new Map<string, number>();
      roleDefs.forEach(role => {
        const roleKey = `${role.roleId}|${role.storeId || ''}`;
        const count = roleKeyCounts.get(roleKey) || 0;
        roleKeyCounts.set(roleKey, count + 1);
      });
      
      roleKeyCounts.forEach((count, roleKey) => {
        if (count > 1) {
          const [roleId, storeId] = roleKey.split('|');
          const location = storeId ? `in store "${storeId}"` : 'at company level';
          console.warn('🔍 [RoleDefinitionService] DUPLICATE FOUND:', roleId, location, 'appears', count, 'times');
        }
      });
      
      // Remove duplicates - keep the first occurrence of each roleId + storeId combination
      const uniqueRoleDefs = roleDefs.filter((role, index, self) => 
        index === self.findIndex(r => r.roleId === role.roleId && r.storeId === role.storeId)
      );
      
      if (uniqueRoleDefs.length !== roleDefs.length) {
        console.warn('🔍 [RoleDefinitionService] Removed', roleDefs.length - uniqueRoleDefs.length, 'duplicate role definitions');
      }
      
      this.roleDefinitionsSignal.set(uniqueRoleDefs);
    } catch (error) {
      console.error('Error loading role definitions:', error);
      this.roleDefinitionsSignal.set([]);
    }
  }

  async createRoleDefinition(roleData: Omit<RoleDefinition, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentUser || !currentPermission?.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Server-side validation: Check for duplicate roleId + companyId + storeId combination
      const existingRoles = this.roleDefinitionsSignal();
      const duplicateRole = existingRoles.find(role => 
        role.roleId === roleData.roleId && 
        role.companyId === currentPermission.companyId &&
        role.storeId === (roleData.storeId || '')
      );
      
      if (duplicateRole) {
        if (roleData.storeId) {
          throw new Error(`A role with the name "${roleData.roleId}" already exists in the specified store.`);
        } else {
          throw new Error(`A role with the name "${roleData.roleId}" already exists at the company level.`);
        }
      }

      // Validate against reserved role names
      const reservedRoles = ['creator', 'cashier', 'store_manager', 'admin', 'owner'];
      if (reservedRoles.includes(roleData.roleId.toLowerCase())) {
        throw new Error(`"${roleData.roleId}" is a reserved role name. Please choose a different name.`);
      }

      // Additional validation: Check for duplicate in database to be extra sure
      const roleDefsRef = collection(this.firestore, 'roleDefinition');
      const duplicateQuery = query(
        roleDefsRef, 
        where('roleId', '==', roleData.roleId),
        where('companyId', '==', currentPermission.companyId),
        where('storeId', '==', roleData.storeId || '')
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);
      
      if (!duplicateSnapshot.empty) {
        if (roleData.storeId) {
          throw new Error(`A role with the name "${roleData.roleId}" already exists in the specified store.`);
        } else {
          throw new Error(`A role with the name "${roleData.roleId}" already exists at the company level.`);
        }
      }

      const docData = {
        ...roleData,
        companyId: currentPermission.companyId,
        storeId: roleData.storeId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('🔍 [RoleDefinitionService] Creating new role definition:', docData);
      // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
      const documentId = await this.offlineDocService.createDocument('roleDefinition', docData);
      await this.loadRoleDefinitions(); // Refresh the data
      console.log('✅ Role definition created with ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
    } catch (error) {
      console.error('Error creating role definition:', error);
      throw error;
    }
  }

  async updateRoleDefinition(roleId: string, roleData: Partial<RoleDefinition>): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentUser || !currentPermission?.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Verify the role belongs to the current user's company
      const existingRole = this.getRoleDefinition(roleId);
      if (!existingRole || existingRole.companyId !== currentPermission.companyId) {
        throw new Error('Role not found or access denied');
      }

      const roleDocRef = doc(this.firestore, 'roleDefinition', roleId);
      await updateDoc(roleDocRef, {
        ...roleData,
        companyId: currentPermission.companyId, // Ensure companyId cannot be changed
        updatedAt: new Date()
      });
      await this.loadRoleDefinitions(); // Refresh the data
    } catch (error) {
      console.error('Error updating role definition:', error);
      throw error;
    }
  }

  async deleteRoleDefinition(roleId: string): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentUser || !currentPermission?.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Verify the role belongs to the current user's company
      const existingRole = this.getRoleDefinition(roleId);
      if (!existingRole || existingRole.companyId !== currentPermission.companyId) {
        throw new Error('Role not found or access denied');
      }

      const roleDocRef = doc(this.firestore, 'roleDefinition', roleId);
      await deleteDoc(roleDocRef);
      await this.loadRoleDefinitions(); // Refresh the data
    } catch (error) {
      console.error('Error deleting role definition:', error);
      throw error;
    }
  }

  getRoleDefinition(roleId: string): RoleDefinition | undefined {
    const currentUser = this.authService.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!currentUser || !currentPermission?.companyId) {
      return undefined;
    }
    
    return this.roleDefinitionsSignal().find(role => 
      role.id === roleId && role.companyId === currentPermission.companyId
    );
  }

  getRoleDefinitionByRoleId(roleId: string): RoleDefinition | undefined {
    const currentUser = this.authService.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!currentUser || !currentPermission?.companyId) {
      return undefined;
    }
    
    return this.roleDefinitionsSignal().find(role => 
      role.roleId === roleId && role.companyId === currentPermission.companyId
    );
  }

  // Get all role definitions for the current user's company
  getCompanyRoleDefinitions(): RoleDefinition[] {
    const currentUser = this.authService.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    
    if (!currentUser || !currentPermission?.companyId) {
      return [];
    }
    
    const allRoles = this.roleDefinitionsSignal();
    
    const filteredRoles = allRoles.filter(role => {
      const matches = role.companyId === currentPermission.companyId;
      return matches;
    });
    
    return filteredRoles;
  }
}
