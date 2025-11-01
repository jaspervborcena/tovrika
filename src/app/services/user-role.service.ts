import { Injectable, computed, signal } from '@angular/core';
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
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { UserRole } from '../interfaces/user-role.interface';

@Injectable({
  providedIn: 'root'
})
export class UserRoleService {
  // Ensure default roles exist for a company
  async ensureDefaultRoles(companyId: string) {
    const defaultRoles = [
      { roleId: 'creator', name: 'Creator', description: 'Full access to all features.' },
      { roleId: 'store_manager', name: 'Store Manager', description: 'Manage stores and products.' },
      { roleId: 'cashier', name: 'Cashier', description: 'Access POS and products only.' }
    ];
    const roleDefRef = collection(this.firestore, 'roledefinition');
    for (const role of defaultRoles) {
      const q = query(roleDefRef, where('companyId', '==', companyId), where('roleId', '==', role.roleId));
      const snap = await getDocs(q);
      if (snap.empty) {
        const roleData = {
          companyId,
          roleId: role.roleId,
          name: role.name,
          description: role.description,
          permissions: this.getDefaultPermissionsForRole(role.roleId),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
        await this.offlineDocService.createDocument('roledefinition', roleData);
      }
    }
  }

  // Helper: get default permissions for a role
  getDefaultPermissionsForRole(roleId: string) {
    if (roleId === 'creator') {
      return {
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
    } else if (roleId === 'store_manager') {
      return {
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
    } else if (roleId === 'cashier') {
      return {
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
        canViewCompanyProfile: true,
        canEditCompanyProfile: false,
        canAddCompanyProfile: false,
        canViewOverview: false
      };
    }
    // Custom roles: return empty or default permissions
    return {};
  }
  private readonly userRolesSignal = signal<UserRole[]>([]);
  
  // Public signals
  readonly userRoles = computed(() => this.userRolesSignal());
  readonly totalUserRoles = computed(() => this.userRolesSignal().length);

  constructor(
    private firestore: Firestore, 
    private authService: AuthService,
    private firestoreSecurityService: FirestoreSecurityService,
    private offlineDocService: OfflineDocumentService
  ) {}

  async loadUserRoles() {
    try {
      const currentUser = await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      
      if (!currentUser || !currentPermission?.companyId) {
        console.warn('No current user or companyId found');
        this.userRolesSignal.set([]);
        return;
      }

      const userRolesRef = collection(this.firestore, 'userRoles');
      const q = query(userRolesRef, where('companyId', '==', currentPermission.companyId));
      
      const querySnapshot = await getDocs(q);
      
      const userRoles = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data['userId'] || '',
          email: data['email'] || '',
          roleId: data['roleId'] || '',
          storeId: data['storeId'] || '',
          companyId: data['companyId'] || '',
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        } as UserRole;
      });
      
      this.userRolesSignal.set(userRoles);
    } catch (error) {
      console.error('Error loading user roles:', error);
      this.userRolesSignal.set([]);
    }
  }

  async createUserRole(userRoleData: Omit<UserRole, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentUser || !currentPermission?.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      const userRolesRef = collection(this.firestore, 'userRoles');
      const docData = {
        ...userRoleData,
        companyId: currentPermission.companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Add user role to userRoles collection
      // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
      await this.offlineDocService.createDocument('userRoles', docData);

      // Update user's permission field in users collection
      const userDocRef = doc(this.firestore, 'users', userRoleData.userId);
      const permissionUpdate = {
        permission: {
          companyId: currentPermission.companyId,
          storeId: userRoleData.storeId,  
          roleId: userRoleData.roleId
        },
        updatedAt: new Date()
      };
      await updateDoc(userDocRef, permissionUpdate);

      await this.loadUserRoles(); // Refresh the data
    } catch (error) {
      console.error('Error creating user role:', error);
      throw error;
    }
  }

  async updateUserRole(userRoleId: string, userRoleData: Partial<UserRole>): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentUser || !currentPermission?.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Verify the user role belongs to the current user's company
      const existingUserRole = this.getUserRole(userRoleId);
      if (!existingUserRole || existingUserRole.companyId !== currentPermission.companyId) {
        throw new Error('User role not found or access denied');
      }

      const userRoleDocRef = doc(this.firestore, 'userRoles', userRoleId);
      await updateDoc(userRoleDocRef, {
        ...userRoleData,
        companyId: currentPermission.companyId, // Ensure companyId cannot be changed
        updatedAt: new Date()
      });
      await this.loadUserRoles(); // Refresh the data
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  async deleteUserRole(userRoleId: string): Promise<void> {
    try {
      console.log('🔍 [UserRoleService] Starting deletion for userRoleId:', userRoleId);
      
      const currentUser = await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      console.log('🔍 [UserRoleService] Current user:', currentUser?.email);
      console.log('🔍 [UserRoleService] Current permission:', currentPermission);
      
      if (!currentUser || !currentPermission?.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Verify the user role belongs to the current user's company
      const existingUserRole = this.getUserRole(userRoleId);
      console.log('🔍 [UserRoleService] Found existing user role:', existingUserRole);
      
      if (!existingUserRole || existingUserRole.companyId !== currentPermission.companyId) {
        console.error('🔍 [UserRoleService] User role not found or access denied');
        console.error('🔍 [UserRoleService] existingUserRole:', existingUserRole);
        console.error('🔍 [UserRoleService] currentPermission.companyId:', currentPermission.companyId);
        throw new Error('User role not found or access denied');
      }

      console.log('🔍 [UserRoleService] Proceeding with deletion...');
  const userRoleDocRef = doc(this.firestore, 'userRoles', userRoleId);
  await this.offlineDocService.deleteDocument('userRoles', userRoleId);
      console.log('🔍 [UserRoleService] Document deleted successfully');
      await this.loadUserRoles(); // Refresh the data
      console.log('🔍 [UserRoleService] Data reloaded');
    } catch (error) {
      console.error('Error deleting user role:', error);
      throw error;
    }
  }

  getUserRole(userRoleId: string): UserRole | undefined {
    const currentUser = this.authService.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    console.log('🔍 [UserRoleService] getUserRole called with ID:', userRoleId);
    console.log('🔍 [UserRoleService] Current user:', currentUser?.email);
    console.log('🔍 [UserRoleService] Current permission:', currentPermission);
    
    if (!currentUser || !currentPermission?.companyId) {
      console.log('🔍 [UserRoleService] No current user or companyId, returning undefined');
      return undefined;
    }
    
    const allUserRoles = this.userRolesSignal();
    console.log('🔍 [UserRoleService] All user roles count:', allUserRoles.length);
    console.log('🔍 [UserRoleService] Looking for userRoleId:', userRoleId, 'in companyId:', currentPermission.companyId);
    
    const foundRole = allUserRoles.find(userRole => {
      console.log('🔍 [UserRoleService] Checking role:', userRole.id, 'companyId:', userRole.companyId);
      return userRole.id === userRoleId && userRole.companyId === currentPermission.companyId;
    });
    
    console.log('🔍 [UserRoleService] Found role:', foundRole);
    return foundRole;
  }

  getUserRoleByEmail(email: string): UserRole | undefined {
    const currentUser = this.authService.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!currentUser || !currentPermission?.companyId) {
      return undefined;
    }
    
    return this.userRolesSignal().find(userRole => 
      userRole.email === email && userRole.companyId === currentPermission.companyId
    );
  }

  getUserRoleByUserId(userId: string): UserRole | undefined {
    const currentUser = this.authService.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!currentUser || !currentPermission?.companyId) {
      return undefined;
    }
    
    return this.userRolesSignal().find(userRole => 
      userRole.userId === userId && userRole.companyId === currentPermission.companyId
    );
  }

  // Get all user roles for the current user's company
  getCompanyUserRoles(): UserRole[] {
    const currentUser = this.authService.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    
    if (!currentUser || !currentPermission?.companyId) {
      return [];
    }
    
    const allUserRoles = this.userRolesSignal();
    
    const filteredUserRoles = allUserRoles.filter(userRole => {
      const matches = userRole.companyId === currentPermission.companyId;
      return matches;
    });
    
    return filteredUserRoles;
  }

  // Search user roles by email
  searchUserRolesByEmail(emailQuery: string): UserRole[] {
    const companyUserRoles = this.getCompanyUserRoles();
    if (!emailQuery.trim()) {
      return companyUserRoles;
    }
    
    return companyUserRoles.filter(userRole => 
      userRole.email.toLowerCase().includes(emailQuery.toLowerCase()) ||
      userRole.userId.toLowerCase().includes(emailQuery.toLowerCase())
    );
  }
}
