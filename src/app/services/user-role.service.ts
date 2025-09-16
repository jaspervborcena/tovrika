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
import { UserRole } from '../interfaces/user-role.interface';

@Injectable({
  providedIn: 'root'
})
export class UserRoleService {
  private readonly userRolesSignal = signal<UserRole[]>([]);
  
  // Public signals
  readonly userRoles = computed(() => this.userRolesSignal());
  readonly totalUserRoles = computed(() => this.userRolesSignal().length);

  constructor(
    private firestore: Firestore, 
    private authService: AuthService
  ) {}

  async loadUserRoles() {
    try {
      const currentUser = await this.authService.waitForAuth();
      
      if (!currentUser || !currentUser.companyId) {
        console.warn('No current user or companyId found');
        this.userRolesSignal.set([]);
        return;
      }

      const userRolesRef = collection(this.firestore, 'userRoles');
      const q = query(userRolesRef, where('companyId', '==', currentUser.companyId));
      
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
      if (!currentUser || !currentUser.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      const userRolesRef = collection(this.firestore, 'userRoles');
      const docData = {
        ...userRoleData,
        companyId: currentUser.companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await addDoc(userRolesRef, docData);
      await this.loadUserRoles(); // Refresh the data
    } catch (error) {
      console.error('Error creating user role:', error);
      throw error;
    }
  }

  async updateUserRole(userRoleId: string, userRoleData: Partial<UserRole>): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuth();
      if (!currentUser || !currentUser.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Verify the user role belongs to the current user's company
      const existingUserRole = this.getUserRole(userRoleId);
      if (!existingUserRole || existingUserRole.companyId !== currentUser.companyId) {
        throw new Error('User role not found or access denied');
      }

      const userRoleDocRef = doc(this.firestore, 'userRoles', userRoleId);
      await updateDoc(userRoleDocRef, {
        ...userRoleData,
        companyId: currentUser.companyId, // Ensure companyId cannot be changed
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
      const currentUser = await this.authService.waitForAuth();
      if (!currentUser || !currentUser.companyId) {
        throw new Error('No authenticated user or company ID found');
      }

      // Verify the user role belongs to the current user's company
      const existingUserRole = this.getUserRole(userRoleId);
      if (!existingUserRole || existingUserRole.companyId !== currentUser.companyId) {
        throw new Error('User role not found or access denied');
      }

      const userRoleDocRef = doc(this.firestore, 'userRoles', userRoleId);
      await deleteDoc(userRoleDocRef);
      await this.loadUserRoles(); // Refresh the data
    } catch (error) {
      console.error('Error deleting user role:', error);
      throw error;
    }
  }

  getUserRole(userRoleId: string): UserRole | undefined {
    const currentUser = this.authService.currentUser();
    if (!currentUser || !currentUser.companyId) {
      return undefined;
    }
    
    return this.userRolesSignal().find(userRole => 
      userRole.id === userRoleId && userRole.companyId === currentUser.companyId
    );
  }

  getUserRoleByEmail(email: string): UserRole | undefined {
    const currentUser = this.authService.currentUser();
    if (!currentUser || !currentUser.companyId) {
      return undefined;
    }
    
    return this.userRolesSignal().find(userRole => 
      userRole.email === email && userRole.companyId === currentUser.companyId
    );
  }

  getUserRoleByUserId(userId: string): UserRole | undefined {
    const currentUser = this.authService.currentUser();
    if (!currentUser || !currentUser.companyId) {
      return undefined;
    }
    
    return this.userRolesSignal().find(userRole => 
      userRole.userId === userId && userRole.companyId === currentUser.companyId
    );
  }

  // Get all user roles for the current user's company
  getCompanyUserRoles(): UserRole[] {
    const currentUser = this.authService.currentUser();
    
    if (!currentUser || !currentUser.companyId) {
      return [];
    }
    
    const allUserRoles = this.userRolesSignal();
    
    const filteredUserRoles = allUserRoles.filter(userRole => {
      const matches = userRole.companyId === currentUser.companyId;
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
