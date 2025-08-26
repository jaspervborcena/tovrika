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
  roleId: string; // Primary role field matching your structure
  companyId: string;
  storeIds: string[]; // Array of store IDs user has access to
  status: 'active' | 'inactive';
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  // Legacy fields for backward compatibility
  role?: 'admin' | 'manager' | 'cashier';
  storeId?: string;
  branchId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly currentUserSignal = signal<User | null>(null);
  private readonly isLoading = signal<boolean>(true);

  // Computed properties
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  readonly userRole = computed(() => this.currentUserSignal()?.roleId || this.currentUserSignal()?.role);
  readonly hasCompanyAccess = computed(() => !!this.currentUserSignal()?.companyId);
  readonly currentUser = computed(() => this.currentUserSignal());

  constructor() {
    this.auth = inject(Auth);
    this.firestore = inject(Firestore);
    this.initAuthListener();
  }
  private auth: Auth;
  private firestore: Firestore;

  private initAuthListener() {
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      this.isLoading.set(true);
      if (firebaseUser) {
        const userData = await this.getUserData(firebaseUser.uid);
        this.currentUserSignal.set(userData);
        
        // Check remember me preference
        if (!localStorage.getItem('rememberMe')) {
          // If not remembering, clear auth state when tab/window closes
          window.addEventListener('beforeunload', () => {
            sessionStorage.clear();
          });
        }
      } else {
        this.currentUserSignal.set(null);
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
        // Clear any existing auth data when not remembering
        sessionStorage.clear();
      }
      
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      const userData = await this.getUserData(credential.user.uid);
      this.currentUserSignal.set(userData);
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async registerUser(
    email: string, 
    password: string, 
    userData: Omit<User, 'uid' | 'createdAt' | 'updatedAt'>
  ) {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user: User = {
        uid: credential.user.uid,
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.setUserData(user);
      this.currentUserSignal.set(user);
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
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
  hasPermission(permission: string): boolean {
    return this.currentUser()?.permissions.includes(permission) ?? false;
  }
}
