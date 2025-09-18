// Enum for authentication error messages
export enum AuthError {
  EmailAlreadyInUse = 'This email is already registered.',
  InvalidEmail = 'The email address is invalid.',
  WeakPassword = 'The password is too weak.',
  UserNotFound = 'No user found with this email.',
  WrongPassword = 'Incorrect password.',
  TooManyRequests = 'Too many requests. Please try again later.',
  Default = 'An unexpected error occurred. Please try again.'
}
import { Injectable, computed, signal, inject } from '@angular/core';
import { 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc
} from '@angular/fire/firestore';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  branchId?: string;
  permissions?: {
    companyId: string;
    storeId?: string;
    roleId: string;
  }[];
  currentCompanyId?: string; // Currently selected company for users with multiple company access
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly currentUserSignal = signal<User | null>(null);
  private readonly isLoading = signal<boolean>(true);
  private readonly currentUserRoleIdSignal = signal<string | undefined>(undefined);

  // Computed properties
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  readonly userRole = computed(() => this.currentUserRoleIdSignal());
  readonly hasCompanyAccess = computed(() => !!this.getCurrentPermission()?.companyId);
  readonly currentUser = computed(() => this.currentUserSignal());

  constructor() {
    this.auth = inject(Auth);
    this.firestore = inject(Firestore);
    this.initAuthListener();
  }
  private auth: Auth;
  private firestore: Firestore;

  // Helper methods for permissions array
  getCurrentPermission(): { companyId: string; storeId?: string; roleId: string } | null {
    const user = this.currentUserSignal();
    if (!user?.permissions || user.permissions.length === 0) return null;
    
    // If user has selected a specific company, use that
    if (user.currentCompanyId) {
      const permission = user.permissions.find(p => p.companyId === user.currentCompanyId);
      if (permission) return permission;
    }
    
    // Otherwise, return the first permission
    return user.permissions[0];
  }

  getUserCompanies(): { companyId: string; roleId: string }[] {
    const user = this.currentUserSignal();
    if (!user?.permissions) return [];
    
    // Group by companyId and return unique companies
    const companies = new Map<string, string>();
    user.permissions.forEach(p => {
      if (!companies.has(p.companyId)) {
        companies.set(p.companyId, p.roleId);
      }
    });
    
    return Array.from(companies.entries()).map(([companyId, roleId]) => ({
      companyId,
      roleId
    }));
  }

  hasMultipleCompanies(): boolean {
    return this.getUserCompanies().length > 1;
  }

  async selectCompany(companyId: string): Promise<void> {
    const user = this.currentUserSignal();
    if (!user) throw new Error('No authenticated user');
    
    const hasAccess = user.permissions?.some(p => p.companyId === companyId);
    if (!hasAccess) throw new Error('User does not have access to this company');
    
    // Update the user's current company selection
    await this.updateUserData({ currentCompanyId: companyId });
  }

  private initAuthListener() {
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      this.isLoading.set(true);
      if (firebaseUser) {
        try {
          const userData = await this.getUserData(firebaseUser.uid);
          this.currentUserSignal.set(userData);
          await this.fetchAndSetUserRoleId(userData);
          // Check remember me preference
          const rememberMe = localStorage.getItem('rememberMe') === 'true';
          if (!rememberMe) {
            // If not remembering, set up session-only persistence
            // Firebase will still maintain auth state until explicit logout
            console.log('Session-only authentication active');
          } else {
            console.log('Persistent authentication active');
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          // If we can't load user data, sign them out
          await signOut(this.auth);
          this.currentUserSignal.set(null);
          this.currentUserRoleIdSignal.set(undefined);
        }
      } else {
        this.currentUserSignal.set(null);
        this.currentUserRoleIdSignal.set(undefined);
      }
      this.isLoading.set(false);
    });
  }

  async login(email: string, password: string, rememberMe: boolean = false) {
    try {
      // Store the remember me preference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      const userData = await this.getUserData(credential.user.uid);
      this.currentUserSignal.set(userData);
      await this.fetchAndSetUserRoleId(userData);
      console.log('Login successful:', userData?.email);
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  // Fetch and set the current user's roleId from userRoles collection
  private async fetchAndSetUserRoleId(user: User | null) {
    const currentPermission = this.getCurrentPermission();
    if (!user || !currentPermission?.companyId || !user.uid) {
      // Fallback to permissions array
      if (currentPermission?.roleId) {
        this.currentUserRoleIdSignal.set(currentPermission.roleId);
      } else {
        this.currentUserRoleIdSignal.set(undefined);
      }
      return;
    }
    try {
      const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
      const firestore = getFirestore();
      const userRolesRef = collection(firestore, 'userRoles');
      const userRolesQuery = query(
        userRolesRef,
        where('companyId', '==', currentPermission.companyId),
        where('userId', '==', user.uid),
        where('storeId', '==', currentPermission.storeId || '')
      );
      const userRolesSnap = await getDocs(userRolesQuery);
      console.log('[AuthService] userRolesSnap:', userRolesSnap.docs.map(doc => doc.data()));
      if (userRolesSnap.empty) {
        // Fallback to permissions array
        if (currentPermission?.roleId) {
          this.currentUserRoleIdSignal.set(currentPermission.roleId);
        } else {
          this.currentUserRoleIdSignal.set(undefined);
        }
        return;
      }
      const userRoleData = userRolesSnap.docs[0].data();
      const roleId = userRoleData['roleId'];
      console.log('[AuthService] Setting currentUserRoleIdSignal to:', roleId);
      this.currentUserRoleIdSignal.set(roleId);
    } catch (error) {
      console.error('Error fetching user roleId:', error);
      // Fallback to permissions array
      const currentPermission = this.getCurrentPermission();
      if (currentPermission?.roleId) {
        this.currentUserRoleIdSignal.set(currentPermission.roleId);
      } else {
        this.currentUserRoleIdSignal.set(undefined);
      }
    }
  }

  async registerUser(
    email: string, 
    password: string, 
    userData: Omit<User, 'uid' | 'createdAt' | 'updatedAt'>
  ) {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Initialize permissions array - for new users, start with creator role if no permissions provided
      let permissions = userData.permissions || [];
      if (permissions.length === 0) {
        // New user with no specific company access gets creator role for their own company
        permissions = [{
          companyId: '', // Will be set when they create a company
          roleId: 'creator'
        }];
      }
      
      const user: User = {
        uid: credential.user.uid,
        ...userData,
        permissions,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.setUserData(user);
      this.currentUserSignal.set(user);
      return user;
    } catch (error: any) {
      console.error('Registration error:', error);
      // Map Firebase error codes to AuthError enum
      if (error.code === 'auth/email-already-in-use') {
        throw new Error(AuthError.EmailAlreadyInUse);
      } else if (error.code === 'auth/invalid-email') {
        throw new Error(AuthError.InvalidEmail);
      } else if (error.code === 'auth/weak-password') {
        throw new Error(AuthError.WeakPassword);
      } else if (error.code === 'auth/user-not-found') {
        throw new Error(AuthError.UserNotFound);
      } else if (error.code === 'auth/wrong-password') {
        throw new Error(AuthError.WrongPassword);
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error(AuthError.TooManyRequests);
      } else {
        throw new Error(AuthError.Default);
      }
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.currentUserSignal.set(null);
      // Clear remember me preference and storage
      localStorage.removeItem('rememberMe');
      sessionStorage.clear();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  private async getUserData(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(this.firestore, `users/${uid}`));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          ...data,
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  }

  private async setUserData(user: User): Promise<void> {
    try {
      // Convert dates to Firestore Timestamps
      const userData = {
        ...user,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
      await setDoc(doc(this.firestore, `users/${user.uid}`), userData);
    } catch (error) {
      console.error('Error setting user data:', error);
      throw error;
    }
  }

  async updateUserData(updates: Partial<User>) {
    const currentUser = this.currentUser();
    if (!currentUser) throw new Error('No authenticated user');

    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await updateDoc(doc(this.firestore, `users/${currentUser.uid}`), updateData);
      this.currentUserSignal.set({ ...currentUser, ...updateData });
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }

  // Getter for current user
  getCurrentUser(): User | null {
    return this.currentUser();
  }

  // Wait for authentication to complete
  async waitForAuth(): Promise<User | null> {
    return new Promise((resolve) => {
      const checkAuth = () => {
        if (!this.isLoading()) {
          resolve(this.currentUser());
        } else {
          setTimeout(checkAuth, 100);
        }
      };
      checkAuth();
    });
  }

  // Check if user has specific permission
  async hasPermission(permission: string): Promise<boolean> {
    const user = this.getCurrentUser();
    const currentPermission = this.getCurrentPermission();
    if (!user || !currentPermission?.companyId || !user.uid) return false;

    // Fetch userRoles for current user
    const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
    const firestore = getFirestore();
    const userRolesRef = collection(firestore, 'userRoles');
    const userRolesQuery = query(
      userRolesRef,
      where('companyId', '==', currentPermission.companyId),
      where('userId', '==', user.uid),
      where('storeId', '==', currentPermission.storeId || '')
    );
    const userRolesSnap = await getDocs(userRolesQuery);
    if (userRolesSnap.empty) return false;
    const userRoleData = userRolesSnap.docs[0].data();
    const roleId = userRoleData['roleId'];
    if (!roleId) return false;

    // Fetch roleDefinition for this roleId
    const roleDefRef = collection(firestore, 'roledefinition');
    const roleDefQuery = query(
      roleDefRef,
      where('companyId', '==', currentPermission.companyId),
      where('roleId', '==', roleId)
    );
    const roleDefSnap = await getDocs(roleDefQuery);
    if (roleDefSnap.empty) return false;
    const roleDefData = roleDefSnap.docs[0].data();
    const permissions = roleDefData['permissions'] || [];
    return permissions.includes(permission);
  }
}
