import { Injectable, computed, signal, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  addDoc
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';

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

  constructor(private firestore: Firestore, private authService: AuthService) {
    // Don't auto-load roles in constructor, let components trigger loading
  }
  

  public async loadRoleDefinitions() {
    try {
      const currentUser = await this.authService.waitForAuth();
      
      if (!currentUser || !currentUser.companyId) {
        console.warn('No current user or companyId found');
        this.roleDefinitionsSignal.set([]);
        return;
      }

      const roleDefsRef = collection(this.firestore, 'roleDefinition');
      const q = query(roleDefsRef, where('companyId', '==', currentUser.companyId));
      
      const querySnapshot = await getDocs(q);
       console.log('roleDefinitionsSignal querySnapshot',querySnapshot);
      const roleDefs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        };
      }) as RoleDefinition[];
      
      this.roleDefinitionsSignal.set(roleDefs);
    } catch (error) {
      console.error('Error loading role definitions:', error);
      this.roleDefinitionsSignal.set([]);
    }
  }

  async createRoleDefinition(roleData: Omit<RoleDefinition, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuth();
      if (!currentUser || !currentUser.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      const roleDefsRef = collection(this.firestore, 'roleDefinition');
      const docData = {
        ...roleData,
        companyId: currentUser.companyId,
        storeId: roleData.storeId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await addDoc(roleDefsRef, docData);
      await this.loadRoleDefinitions(); // Refresh the data
    } catch (error) {
      console.error('Error creating role definition:', error);
      throw error;
    }
  }

  async updateRoleDefinition(roleId: string, roleData: Partial<RoleDefinition>): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuth();
      if (!currentUser || !currentUser.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Verify the role belongs to the current user's company
      const existingRole = this.getRoleDefinition(roleId);
      if (!existingRole || existingRole.companyId !== currentUser.companyId) {
        throw new Error('Role not found or access denied');
      }

      const roleDocRef = doc(this.firestore, 'roleDefinition', roleId);
      await updateDoc(roleDocRef, {
        ...roleData,
        companyId: currentUser.companyId, // Ensure companyId cannot be changed
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
      if (!currentUser || !currentUser.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Verify the role belongs to the current user's company
      const existingRole = this.getRoleDefinition(roleId);
      if (!existingRole || existingRole.companyId !== currentUser.companyId) {
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
    if (!currentUser || !currentUser.companyId) {
      return undefined;
    }
    
    return this.roleDefinitionsSignal().find(role => 
      role.id === roleId && role.companyId === currentUser.companyId
    );
  }

  getRoleDefinitionByRoleId(roleId: string): RoleDefinition | undefined {
    const currentUser = this.authService.currentUser();
    if (!currentUser || !currentUser.companyId) {
      return undefined;
    }
    
    return this.roleDefinitionsSignal().find(role => 
      role.roleId === roleId && role.companyId === currentUser.companyId
    );
  }

  // Get all role definitions for the current user's company
  getCompanyRoleDefinitions(): RoleDefinition[] {
    const currentUser = this.authService.currentUser();
    
    if (!currentUser || !currentUser.companyId) {
      return [];
    }
    
    const allRoles = this.roleDefinitionsSignal();
    
    const filteredRoles = allRoles.filter(role => {
      const matches = role.companyId === currentUser.companyId;
      return matches;
    });
    
    return filteredRoles;
  }
}
