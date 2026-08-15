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
import { Injectable, computed, signal, inject, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { AccessService } from '../core/services/access.service';
import { OfflineStorageService } from '../core/services/offline-storage.service';
import { IndexedDBService } from '../core/services/indexeddb.service';
import { NetworkService } from '../core/services/network.service';
import { DataPrefetchService } from '../core/services/data-prefetch.service';
import { Injector } from '@angular/core';
import { toDateValue } from '../core/utils/date-utils';
import { LoggerService } from '../core/services/logger.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  applyActionCode,
  checkActionCode,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
} from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from '@angular/fire/firestore';
import { environment } from '../../environments/environment';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  userCode?: string; // Unique 6-character code for user identification
  pin?: string; // Optional PIN for quick access
  status: 'active' | 'inactive';
  roleId?: string; // Initial role selected during registration
  createdAt: Date;
  updatedAt: Date;
  branchId?: string;
  permissions?: {
    companyId: string;
    storeId?: string;
    roleId: string;
  }[];
  currentCompanyId?: string; // Currently selected company for users with multiple company access
  isAgreedToPolicy?: boolean; // Policy agreement status for remember me functionality
}

export interface OfflineAuthData {
  email: string;
  hashedPassword: string;
  salt: string;
  rememberMe: boolean;
  lastLogin: Date;
  sessionExpiry: Date;
  userProfile: User;
  isOfflineAuthenticated: boolean;
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

  // Injected services
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private accessService = inject(AccessService);
  private offlineStorageService = inject(OfflineStorageService);
  private indexedDBService = inject(IndexedDBService);
  private networkService = inject(NetworkService);
  private offlineDocService = inject(OfflineDocumentService);
  // Use Injector to lazily resolve DataPrefetchService at runtime to avoid circular DI
  private injector = inject(Injector);
  // Logger: register context provider so remote logs include user/company/store without circular DI
  private logger = inject(LoggerService);

  constructor() {
    // Register a context provider so LoggerService can include current user context in every log.
    // We register early (before starting the auth listener) so any logs during init include context when available.
    try {
      this.logger.setContextProvider(() => {
        const user = this.getCurrentUser();
        const perm = this.getCurrentPermission();
        return {
          userId: user?.uid,
          companyId: perm?.companyId,
          storeId: perm?.storeId
        };
      });
    } catch (e) {
      // If logger is unavailable for some reason, attempt to warn via logger, else fallback to console
      try { this.logger.warn('Logger context provider registration failed', { area: 'auth', payload: { error: String(e) } }); } catch { console.warn('Logger context provider registration failed', e); }
    }

    this.initAuthListener();
  }

  /**
   * Fetch company documents for the current user and persist them into IndexedDB.
   * This is a best-effort, non-blocking helper to ensure `TovrikaOfflineDB.companies` is populated.
   */
  async saveAllCompaniesToIndexedDB(): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        this.logger.warn('No authenticated user found when saving companies to IndexedDB', { area: 'auth' });
        return;
      }

      const permissionList = this.getUserCompanies();
      const companyIds = (permissionList || []).map(p => p.companyId).filter(Boolean);
      if (!companyIds || companyIds.length === 0) {
        this.logger.debug('No company IDs found for current user; skipping saveAllCompaniesToIndexedDB', { area: 'auth' });
        return;
      }

      const companies: any[] = [];
      for (const companyId of companyIds) {
        try {
          const companyDocRef = doc(this.firestore, `companies/${companyId}`);
          const companyDoc = await runInInjectionContext(this.injector, () => getDoc(companyDocRef));
          if (!companyDoc.exists()) {
            this.logger.warn(`Company doc ${companyId} does not exist, skipping`, { area: 'auth' });
            continue;
          }
          const raw = companyDoc.data() as any;
          const companyData = raw && (raw.company ? raw.company : raw);
          companies.push({
            id: companyId,
            name: companyData?.name || companyId,
            ...companyData,
            createdAt: toDateValue(companyData?.createdAt) || new Date(),
            updatedAt: toDateValue(companyData?.updatedAt) || new Date(),
            ownerUid: companyData?.ownerUid || companyData?.uid || user.uid
          });
        } catch (err: any) {
          this.logger.warn(`Failed to fetch company ${companyId} for IndexedDB save`, { area: 'auth', payload: { error: String(err) } });
        }
      }

      if (companies.length > 0) {
        try {
          await this.indexedDBService.saveCompanies(companies);
          this.logger.info(`Saved ${companies.length} companies to IndexedDB`, { area: 'auth' });
        } catch (saveErr) {
          this.logger.warn('Failed to save companies to IndexedDB', { area: 'auth', payload: { error: String(saveErr) } });
        }
      } else {
        this.logger.debug('No companies fetched to save to IndexedDB', { area: 'auth' });
      }
    } catch (e) {
      this.logger.warn('Unexpected error in saveAllCompaniesToIndexedDB', { area: 'auth', payload: { error: String(e) } });
    }
  }

  // Network connectivity helper methods
  private async checkNetworkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      return false;
    }
    
    try {
      // Test Firebase Auth endpoint using project ID from environment
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${environment.firebase.projectId}`, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors'
      });
      
      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Helper methods for permissions array
  getCurrentPermission(): { companyId: string; storeId?: string; roleId: string } | null {
    const user = this.currentUserSignal();
    
    // Check if permissions exists and handle both old and new formats
    if (!user?.permissions) {
      return null;
    }

    // Handle old single permission format (migration fallback)
    if (!Array.isArray(user.permissions) && typeof user.permissions === 'object') {
      // Return the single permission object directly
      return user.permissions as any;
    }

    // Handle new array format
    if (!Array.isArray(user.permissions)) {
      return null;
    }

    if (user.permissions.length === 0) {
      return null;
    }

  // Priority for choosing current permission:
  // 1. If user.currentCompanyId is set, prefer the permission for that company (any role)
  // 2. Prefer the first permission that has a roleId
  // 3. Prefer the first permission that has a non-empty companyId
  // 4. Fallback to the first permission available

    // 1) Company-specific selection
    if (user.currentCompanyId) {
      const byCurrentCompany = user.permissions.find(p => p.companyId === user.currentCompanyId);
      if (byCurrentCompany) return byCurrentCompany;
    }

  // 2) First permission with a roleId
  const firstWithRole = user.permissions.find(p => p.roleId);
  if (firstWithRole) return firstWithRole;

    // 3) First permission with companyId present
    const firstWithCompany = user.permissions.find(p => p.companyId && String(p.companyId).trim() !== '');
    if (firstWithCompany) return firstWithCompany;

  // 4) Fallback to the first permission
    return user.permissions[0];
  }

  getUserCompanies(): { companyId: string; roleId: string }[] {
    const user = this.currentUserSignal();
    if (!user?.permissions) return [];
    
    // Handle both old single permission format and new array format
    if (!Array.isArray(user.permissions)) {
      // If it's a single permission object (old format)
      if (typeof user.permissions === 'object' && (user.permissions as any).companyId) {
        const singlePermission = user.permissions as any;
        return [{ companyId: singlePermission.companyId, roleId: singlePermission.roleId }];
      }
      return [];
    }
    
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
    
    // Check access with safety for both old and new permission formats
    let hasAccess = false;
    if (Array.isArray(user.permissions)) {
      hasAccess = user.permissions.some(p => p.companyId === companyId);
    } else if (typeof user.permissions === 'object' && (user.permissions as any).companyId) {
      hasAccess = (user.permissions as any).companyId === companyId;
    }
    
    if (!hasAccess) throw new Error('User does not have access to this company');
    
    // Update the user's current company selection
    await this.updateUserData({ currentCompanyId: companyId });
  }

  private initAuthListener() {
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      this.isLoading.set(true);
      if (firebaseUser) {
        try {
          // Check if we already have user data for this UID (from login)
          const existingUser = this.getCurrentUser();
          if (existingUser && existingUser.uid === firebaseUser.uid) {
            console.log('🔑 onAuthStateChanged: User already set via login, skipping refetch');
            this.isLoading.set(false);
            return;
          }
          
          const userData = await this.getUserData(firebaseUser.uid);
          this.logger.info('User data loaded from Firestore', { area: 'auth', payload: { email: userData?.email, uid: userData?.uid, permissions: userData?.permissions, roleId: userData?.roleId, currentCompanyId: userData?.currentCompanyId } });
          this.currentUserSignal.set(userData);
          await this.fetchAndSetUserRoleId(userData);
          
          // Update IndexedDB with latest user data (including updated permissions/role)
          if (userData) {
            try {
              await this.offlineStorageService.saveUserSession(userData);
              this.logger.info('IndexedDB updated with latest user permissions', { area: 'auth', payload: { roleId: userData.roleId, permissions: userData.permissions } });
            } catch (offlineErr) {
              this.logger.warn('Failed to update IndexedDB with latest user data', { area: 'auth', payload: { error: String(offlineErr) } });
            }
          }
          
          // Check remember me preference
          const rememberMe = localStorage.getItem('rememberMe') === 'true';
          if (!rememberMe) {
            // If not remembering, set up session-only persistence
            // Firebase will still maintain auth state until explicit logout
            this.logger.info('Session-only authentication active', { area: 'auth' });
          } else {
            this.logger.info('Persistent authentication active', { area: 'auth' });
          }
        } catch (error) {
          this.logger.error('Error loading user data', { area: 'auth' }, error);
          // If we can't load user data, sign them out
          await signOut(this.auth);
          this.currentUserSignal.set(null);
          this.currentUserRoleIdSignal.set(undefined);
        }
      } else {
        // User signed out - clear auth state
        // But only if we don't have an active login happening
        const existingUser = this.getCurrentUser();
        if (existingUser) {
          console.log('🔑 onAuthStateChanged: Firebase user is null but we have a user set, keeping user');
          this.isLoading.set(false);
          return;
        }
        
        this.currentUserSignal.set(null);
        this.currentUserRoleIdSignal.set(undefined);
        
        // Offline-first behaviour: preserve offline data on sign-out so the user
        // can still login offline later. Instead of deleting cached data, mark
        // the offline session as logged out in the offline store.
        try {
          const offlineUser = this.offlineStorageService.currentUser();
          if (offlineUser) {
            this.logger.info('Auth state cleared - preserving IndexedDB offline data (offline-first)', { area: 'auth' });
            // Mark user as logged out in the offline store but keep cached data
            try {
              await this.offlineStorageService.logoutUser();
              this.logger.info('Offline user marked logged out, offline data preserved', { area: 'auth' });
            } catch (logoutErr) {
              this.logger.warn('Failed to mark offline user as logged out, but preserving data', { area: 'auth', payload: { error: String(logoutErr) } });
            }
          }
        } catch (error) {
          this.logger.error('Error while handling offline data on auth state change', { area: 'auth' }, error);
        }
      }
      this.isLoading.set(false);
    });
  }

  async login(email: string, password: string, rememberMe: boolean = false): Promise<User | null> {
    try {
      this.logger.info('Starting hybrid login process', { area: 'auth', payload: { email } });
      this.logger.debug('Network status for login attempt', { area: 'auth', payload: { online: await this.networkService.isOnline() ? 'Online' : 'Offline' } });
      
      console.log('🔑 AuthService.login: Calling loginWithOfflineFallback...');
      // Use the new offline fallback login method
      const result = await this.loginWithOfflineFallback(email, password, rememberMe);
      console.log('🔑 AuthService.login: loginWithOfflineFallback result:', result);
      
      if (result.success) {
        
        // CRITICAL: Set the signal immediately to ensure it's available for navigation
        if (result.user) {
          console.log('🔑 AuthService.login: Setting currentUserSignal immediately');
          this.currentUserSignal.set(result.user);
          console.log('🔑 AuthService.login: Signal set, current value:', this.getCurrentUser()?.email);
        }
        
        this.logger.info(`Login successful ${result.isOffline ? '(offline)' : '(online)'}`, { area: 'auth', payload: { email: result.user?.email } });
        
        // Store the remember me preference
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberMe');
        }
        
        // Save user session to offline storage (if online login)
        if (!result.isOffline && result.user) {
          try {
            // Debug: Log the user data we're about to save
            this.logger.debug('Login: User data from Firestore', { area: 'auth', payload: { email: result.user.email, roleId: result.user.roleId, permissions: result.user.permissions } });
            
            // Use explicit server-provided policy flag when available. Do NOT assume existing users agreed.
            // This ensures users always see the policy-agreement page unless the server knows otherwise.
            const serverAgreed = typeof (result.user as any).isAgreedToPolicy === 'boolean' ? (result.user as any).isAgreedToPolicy : false;

            const userSessionData = {
              ...result.user,
              isAgreedToPolicy: serverAgreed,
              currentStoreId: this.getCurrentPermission()?.storeId
            };
            
            this.logger.debug('Login: User session data being saved to IndexedDB', { area: 'auth', payload: { email: userSessionData.email, roleId: userSessionData.roleId, permissions: userSessionData.permissions } });

            await this.offlineStorageService.saveUserSession(userSessionData);
            this.logger.info('User session saved to offline storage', { area: 'auth' });

            // Dev-only: seed local IndexedDB companies after a successful online login
              // Diagnostic: log Firebase ID token and claims to help debug Firestore permission errors
              try {
                const firebaseUser = this.auth.currentUser as any;
                if (firebaseUser) {
                  try {
                    const idToken = await firebaseUser.getIdToken();
                    const idTokenResult = await firebaseUser.getIdTokenResult();
                    console.log('AuthService.login: firebaseUser uid=', firebaseUser.uid, 'email=', firebaseUser.email);
                    console.log('AuthService.login: ID token length=', idToken ? idToken.length : 'null');
                    console.log('AuthService.login: ID token claims=', idTokenResult?.claims);
                    this.logger.debug('Auth token diagnostics', { area: 'auth', payload: { uid: firebaseUser.uid, claims: idTokenResult?.claims } });
                  } catch (tokenErr) {
                    console.warn('AuthService.login: Failed to read ID token or claims', tokenErr);
                    this.logger.warn('Failed to read ID token or claims', { area: 'auth', payload: { error: String(tokenErr) } });
                  }
                } else {
                  console.warn('AuthService.login: No firebase currentUser available to read ID token');
                  this.logger.warn('No firebase currentUser available to read ID token', { area: 'auth' });
                }
              } catch (diagErr) {
                console.warn('AuthService.login: Token diagnostics unexpected error', diagErr);
              }
            if (!environment.production) {
              import('../dev/seed-companies')
                .then(async (m) => {
                  const fn = (m as any)?.seedCompaniesFromFirestoreIfEmpty ?? (m as any)?.seedCompaniesIfEmpty;
                  if (typeof fn === 'function') {
                    try {
                      // Ensure Firebase currentUser has a fresh token before seeder runs
                      try {
                        const firebaseUser = this.auth.currentUser as any;
                        if (firebaseUser) {
                          try {
                            const refreshed = await firebaseUser.getIdToken(true);
                            console.log('AuthService.login: forced ID token refresh before seeder; token length=', refreshed ? refreshed.length : 'null');
                          } catch (tokenErr) {
                            console.warn('AuthService.login: failed to refresh ID token before seeder', tokenErr);
                          }
                        } else {
                          console.warn('AuthService.login: no firebase currentUser before running dev seeder');
                        }
                      } catch (diagErr) {
                        console.warn('AuthService.login: token-refresh diagnostic failed', diagErr);
                      }

                      // Run the seeder inside Angular's injection context to avoid
                      // "Firebase API called outside injection context" warnings
                      return runInInjectionContext(this.injector, () => {
                        try {
                          return (fn as any)(this.firestore, this.indexedDBService, this.injector);
                        } catch (err) {
                          // If the seeder expects no args, call without parameters
                          try { return (fn as any)(); } catch (e) { return Promise.resolve(); }
                        }
                      });
                    } catch (err) {
                      // Fallback: attempt to call without injection context
                      try { return (fn as any)(this.firestore, this.indexedDBService); } catch { try { return (fn as any)(); } catch { return Promise.resolve(); } }
                    }
                  }
                  return Promise.resolve();
                })
                .catch(err => this.logger.warn('Dev seeder failed', { area: 'auth', payload: { error: String(err) } }));
            }
          } catch (offlineError) {
            this.logger.warn('Failed to save user session offline', { area: 'auth', payload: { error: String(offlineError) } });
            // Don't throw - offline storage failure shouldn't break login
          }
        }
        
        return result.user || null;
      } else {
        console.error('🔑 AuthService.login: Login failed:', result.error);
        this.logger.error('Login failed', { area: 'auth', payload: { error: result.error } });
        // Extra resilience: if the failure looks like a network issue, but we have
        // offline credentials, attempt offline login one more time here.
        const looksLikeNetworkIssue =
          !result.user &&
          typeof result.error === 'string' &&
          (result.error.toLowerCase().includes('network') ||
           result.error.toLowerCase().includes('connection'));

        if (looksLikeNetworkIssue) {
          try {
            const canGoOffline = await this.hasOfflineAccess(email!);
            if (canGoOffline) {
              this.logger.info('Falling back to offline login due to network error', { area: 'auth' });
              const offlineRes = await this.loginOffline(email!, password!);
              if (offlineRes.success && offlineRes.user) {
                this.logger.info('Offline fallback login succeeded', { area: 'auth' });
                return offlineRes.user;
              }
            }
          } catch (fallbackErr) {
            this.logger.warn('Offline fallback attempt failed', { area: 'auth', payload: { error: String(fallbackErr) } });
          }
        }

        // Final safety net: regardless of error type, if the provided credentials match
        // the stored offline salted hash, proceed offline. This enables login when
        // Firebase rejects for transient reasons other than explicit wrong-password.
        try {
          const offlineRes = await this.loginOffline(email!, password!);
          if (offlineRes.success && offlineRes.user) {
            this.logger.info('Offline fallback login succeeded (generic error path)', { area: 'auth' });
            return offlineRes.user;
          }
        } catch (genericFallbackErr) {
          this.logger.warn('Generic offline fallback attempt failed', { area: 'auth', payload: { error: String(genericFallbackErr) } });
        }

        throw new Error(result.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('🔑 AuthService.login: Exception caught:', error);
      this.logger.error('Login error', { area: 'auth' }, error);
      throw error;
    }
  }
  // Fetch and set the current user's roleId from userRoles collection
  private async fetchAndSetUserRoleId(user: User | null) {
    const currentPermission = this.getCurrentPermission();

    this.logger.debug('fetchAndSetUserRoleId called', { area: 'auth', payload: { userEmail: user?.email, currentPermission, userUid: user?.uid } });

    // If no user or no uid, clear role
    if (!user || !user.uid) {
      this.logger.debug('No user or uid present, clearing roleId', { area: 'auth' });
      this.currentUserRoleIdSignal.set(undefined);
      return;
    }

    // If there's no currentPermission, try to pick a role from the permissions array (prefer non-visitor)
    if (!currentPermission || !currentPermission.companyId) {
      // Try to find a non-visitor role in the permissions array
        // Try to find any role in the permissions array
        const anyRole = Array.isArray(user.permissions) ? user.permissions.find(p => p.roleId) : null;
        if (anyRole?.roleId) {
          this.logger.debug('No explicit currentPermission - using permission roleId from permissions array', { area: 'auth', payload: { roleId: anyRole.roleId } });
          this.currentUserRoleIdSignal.set(anyRole.roleId);
        return;
      }

      // Otherwise, if a permission exists, use its roleId (may be visitor)
      const anyPermission = Array.isArray(user.permissions) && user.permissions.length > 0 ? user.permissions[0] : null;
      if (anyPermission?.roleId) {
        this.logger.debug('No explicit currentPermission - using first permission roleId as fallback', { area: 'auth', payload: { roleId: anyPermission.roleId } });
        this.currentUserRoleIdSignal.set(anyPermission.roleId);
        return;
      }

      this.logger.debug('No permission roleId found, setting to undefined', { area: 'auth' });
      this.currentUserRoleIdSignal.set(undefined);
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
      this.logger.debug('userRoles query results', { area: 'auth', payload: { empty: userRolesSnap.empty, size: userRolesSnap.size, docs: userRolesSnap.docs.map(doc => ({ id: doc.id, data: doc.data() })) } });
      
      if (userRolesSnap.empty) {
        // Fallback to permissions array
        if (currentPermission?.roleId) {
          this.logger.debug('No userRoles found, using permission roleId', { area: 'auth', payload: { roleId: currentPermission.roleId } });
          this.currentUserRoleIdSignal.set(currentPermission.roleId);
        } else {
          this.logger.debug('No userRoles and no permission roleId, setting undefined', { area: 'auth' });
          this.currentUserRoleIdSignal.set(undefined);
        }
        return;
      }
      const userRoleData = userRolesSnap.docs[0].data();
      const roleId = userRoleData['roleId'];
      this.logger.debug('Found userRole, setting currentUserRoleIdSignal', { area: 'auth', payload: { roleId } });
      this.currentUserRoleIdSignal.set(roleId);
    } catch (error) {
      this.logger.error('Error fetching user roleId', { area: 'auth' }, error);
      // Fallback to permissions array
      const currentPermission = this.getCurrentPermission();
      if (currentPermission?.roleId) {
        this.logger.debug('Error fallback - using permission roleId', { area: 'auth', payload: { roleId: currentPermission.roleId } });
        this.currentUserRoleIdSignal.set(currentPermission.roleId);
      } else {
        this.logger.debug('Error fallback - no roleId found, setting undefined', { area: 'auth' });
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
      
      // Generate unique user code
      let userCode: string | undefined = undefined;
      try {
        userCode = await this.generateUserCode();
        this.logger.info('Generated user code', { area: 'auth', payload: { userCode } });
      } catch (e) {
        this.logger.warn('⚠️ Failed to generate user code, continuing without it', { area: 'auth', payload: { error: String(e) } });
      }
      
      // Sanitize incoming user data: do NOT persist root-level roleId. Use permissions array only.
      const { permissions: incomingPermissions, roleId: _ignoreRoleId, ...safeUserData } = userData as any;

      // Initialize permissions array - for new users, start empty; will be populated on company creation
      let permissions = Array.isArray(incomingPermissions) ? incomingPermissions : [];
      
      const user: User = {
        uid: credential.user.uid,
        ...safeUserData,
        ...(userCode ? { userCode } : {}),
        permissions,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.setUserData(user);
      this.currentUserSignal.set(user);
      
      // Save new user session to offline storage
      try {
        await this.offlineStorageService.saveUserSession({
          ...user,
          isAgreedToPolicy: false, // New users must agree to policy
          currentStoreId: undefined
        });
        this.logger.info('New user session saved to offline storage', { area: 'auth' });
      } catch (offlineError) {
        this.logger.warn('Failed to save new user session offline', { area: 'auth', payload: { error: String(offlineError) } });
        // Don't throw - offline storage failure shouldn't break registration
      }
      
      return user;
    } catch (error: any) {
      this.logger.error('Registration error', { area: 'auth' }, error);
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
  this.logger.info('Starting logout process', { area: 'auth' });
      await signOut(this.auth);
      this.currentUserSignal.set(null);
      this.currentUserRoleIdSignal.set(undefined);
      
      // Reset access service permissions
      this.accessService.reset();
      
      // Clear offline storage
      try {
        await this.offlineStorageService.logoutUser();
        this.logger.info('Offline storage cleared', { area: 'auth' });
      } catch (offlineError) {
        this.logger.warn('Failed to clear offline storage', { area: 'auth', payload: { error: String(offlineError) } });
      }
      
  // Clear known session keys but preserve other localStorage (offline queues, logs, snapshots)
  localStorage.removeItem('rememberMe');
  // Avoid clearing entire localStorage or sessionStorage here to preserve
  // offline queues, logs, and saved snapshots required for offline login
  // and offline functionality. Clearing everything caused offline features
  // to break for previously-signed-in users.
      
  this.logger.info('User signed out, navigating to login', { area: 'auth' });
      // Always navigate to the login page after logout so user can re-authenticate.
      // Do not block navigation based on network status - allow the UI to handle
      // offline behaviour gracefully and let components use IndexedDB fallbacks.
      try {
        await this.router.navigate(['/login']);
      } catch (navError) {
        this.logger.warn('Navigation failed after logout, trying fallback reload', { area: 'auth', payload: { error: String(navError) } });
        // Fallback: if navigation fails, force a reload to the login URL
        window.location.href = '/login';
      }
      
    } catch (error) {
      this.logger.error('Logout error', { area: 'auth' }, error);
      throw error;
    }
  }

  private async getUserData(uid: string): Promise<User | null> {
    try {
      this.logger.debug('Fetching user data for UID', { area: 'auth', payload: { uid } });
      const userDoc = await getDoc(doc(this.firestore, `users/${uid}`));
      if (userDoc.exists()) {
        const data = userDoc.data();
        this.logger.info('User data loaded successfully', { area: 'auth', payload: { 
          email: data['email'],
          hasDisplayName: !!data['displayName'],
          hasPermissions: !!data['permissions'],
          hasUserCode: !!data['userCode'],
          hasPin: !!data['pin'],
          documentKeys: Object.keys(data)
        }});
        
        const userData = {
          ...data,
          createdAt: toDateValue(data['createdAt']) || new Date(),
          updatedAt: toDateValue(data['updatedAt']) || new Date()
        } as User;
        
        return userData;
      } else {
        this.logger.warn('User document does not exist in Firestore for UID', { area: 'auth', payload: { uid } });
      }
      return null;
    } catch (error) {
      this.logger.error('Error fetching user data from Firestore', { area: 'auth' }, error);
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
  await this.offlineDocService.updateDocument('users', user.uid, userData);
    } catch (error) {
      this.logger.error('Error setting user data', { area: 'auth' }, error);
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
      
      await this.offlineDocService.updateDocument('users', currentUser.uid, updateData);
      this.currentUserSignal.set({ ...currentUser, ...updateData });
      // Also update offline storage so IndexedDB stays in sync with latest user data
      try {
        const merged = { ...currentUser, ...updateData } as User & { isAgreedToPolicy?: boolean; currentStoreId?: string };
        // Pass currentStoreId if available from permissions
        const activePerm = Array.isArray(merged.permissions) && merged.permissions.length > 0 ? merged.permissions[0] : undefined;
        merged.currentStoreId = merged.currentStoreId || activePerm?.storeId;
        merged.isAgreedToPolicy = (merged as any).isAgreedToPolicy ?? false;
        await this.offlineStorageService.saveUserSession(merged);
        this.logger.info('Offline user session updated after updateUserData', { area: 'auth' });
      } catch (offlineErr) {
        this.logger.warn('Failed to update offline session after user update', { area: 'auth', payload: { error: String(offlineErr) } });
      }
    } catch (error) {
      this.logger.error('Error updating user data', { area: 'auth' }, error);
      throw error;
    }
  }

  // Getter for current user (convenience wrapper used across codebase)
  getCurrentUser(): User | null {
    return this.currentUser();
  }

  // Return Firebase ID token for current user (reuse existing pattern across codebase)
  async getFirebaseIdToken(forceRefresh: boolean = false): Promise<string | null> {
    try {
      const firebaseUser = this.auth.currentUser;
      if (!firebaseUser) {
        this.logger.warn('No authenticated user found', { area: 'auth' });
        return null;
      }
      const token = await firebaseUser.getIdToken(forceRefresh);
      return token;
    } catch (error) {
      this.logger.error('Error getting Firebase ID token', { area: 'auth' }, error);
      return null;
    }
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

  // ==================== OFFLINE AUTHENTICATION METHODS ====================

  // Generate salt for password hashing
  private generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Hash password with salt using Web Crypto API
  private async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Save offline authentication data
  private async saveOfflineAuthData(user: User, password: string, rememberMe: boolean): Promise<void> {
    try {
      const salt = this.generateSalt();
      const hashedPassword = await this.hashPassword(password, salt);
      
      const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days or 1 day
      const sessionExpiry = new Date(Date.now() + sessionDuration);

      const offlineAuthData: OfflineAuthData = {
        email: user.email,
        hashedPassword,
        salt,
        rememberMe,
        lastLogin: new Date(),
        sessionExpiry,
        userProfile: user,
        isOfflineAuthenticated: false
      };

      // Save the auth data by UID
      if (this.indexedDBService.isAvailable()) {
        await this.indexedDBService.saveSetting(`offlineAuth_${user.uid}`, offlineAuthData);

        // Save email-to-UID mapping for lookup
        await this.indexedDBService.saveSetting(`offlineAuth_email_${user.email.toLowerCase()}`, { uid: user.uid });

        // DO NOT automatically set policy flags during login
        // Policy agreement should only be set when user actually agrees in policy-agreement component
        // The policy status should come from the user document in Firestore

        this.logger.info('Offline authentication data saved successfully', { area: 'auth' });
      } else {
        this.logger.warn('IndexedDB unavailable, skipping offline auth save', { area: 'auth' });
      }
    } catch (error: any) {
      this.logger.error('Failed to save offline auth data', { area: 'auth' }, error);
      // Preserve the original error message if available
      if (error.message?.includes('permanently unavailable')) {
        throw error; // Re-throw as-is to preserve the permanent failure message
      }
      throw new Error('Failed to save offline authentication data');
    }
  }

  /**
   * Prefetch companies and stores to IndexedDB for offline use
   */
  private async prefetchCompaniesAndStores(user: User): Promise<void> {
    try {
      console.log('📥 Prefetching companies and stores for offline use...');
      console.log('📥 User object:', user);
      
      // Check if user has permissions
      if (!user.permissions || user.permissions.length === 0) {
        console.log('⚠️ No permissions found, skipping company/store prefetch');
        return;
      }
      
      // Build a robust set of company IDs to fetch from multiple sources.
      const companyIdSet = new Set<string>();
      try {
        if (Array.isArray(user.permissions)) {
          user.permissions.forEach(p => { if (p?.companyId) companyIdSet.add(p.companyId); });
        }
        // Include currentCompanyId if present
        if ((user as any).currentCompanyId) companyIdSet.add((user as any).currentCompanyId);

        // Include companies from helper that reads permissions (handles legacy formats)
        try {
          const list = this.getUserCompanies();
          list.forEach(l => { if (l?.companyId) companyIdSet.add(l.companyId); });
        } catch (e) {
          // ignore
        }

        // Also try offline storage if available
        try {
          const offlineUser = this.offlineStorageService.currentUser?.();
          if (offlineUser && offlineUser.permissions) {
            const perms = Array.isArray(offlineUser.permissions) ? offlineUser.permissions : [offlineUser.permissions as any];
            perms.forEach((p: any) => { if (p?.companyId) companyIdSet.add(p.companyId); });
          }
        } catch (e) {
          // ignore
        }
      } catch (err) {
        console.warn('⚠️ Error while building company ID list for prefetch', err);
      }

      const companyIds = [...companyIdSet];
      console.log('🏢 Company IDs to fetch:', companyIds);

      // Fetch all companies - use direct firestore with proper error handling
      const companies: any[] = [];
      for (const companyId of companyIds) {
        try {
          // Use Firestore directly - the catch-all rule should allow this
          const companyDocRef = doc(this.firestore, `companies/${companyId}`);
          const companyDoc = await runInInjectionContext(this.injector, () => getDoc(companyDocRef));
          if (companyDoc.exists()) {
            const rawCompanyData = companyDoc.data();
            // Handle documents that may nest the company under a 'company' key
            const companyData = rawCompanyData && (rawCompanyData['company'] ? rawCompanyData['company'] : rawCompanyData);
            // Save complete company data
            companies.push({
              id: companyId,
              name: companyData['name'],
              ...companyData,
              // Convert Firestore Timestamps to Date objects
              createdAt: companyData['createdAt']?.toDate ? companyData['createdAt'].toDate() : new Date(companyData['createdAt']),
              updatedAt: companyData['updatedAt']?.toDate ? companyData['updatedAt'].toDate() : companyData['updatedAt'] ? new Date(companyData['updatedAt']) : undefined,
              // Ensure required fields have fallbacks
              ownerUid: companyData['ownerUid'] || companyData['uid'] || user.uid
            });
          } else {
            console.warn(`⚠️ Company document does not exist: ${companyId}`);
          }
        } catch (error: any) {
          // Do NOT add minimal fallback company records when Firestore fetch fails.
          // Log the failure and continue; we prefer missing data over placeholder names.
          console.warn(`⚠️ Could not fetch company ${companyId} (permission denied or doesn't exist):`, error?.message || error);
        }
      }

      // No callable fallback: prefer direct Firestore reads. If reads fail due to
      // security rules, do not attempt a missing cloud function; log and continue.
      if (companies.length === 0 && companyIds.length > 0) {
        console.warn('⚠️ No companies were fetched via Firestore and no getCompaniesForUser cloud function is available; skipping callable fallback.');
      }

      // Save companies to IndexedDB
      if (companies.length > 0 && this.indexedDBService.isAvailable()) {
        console.log('💾 Saving companies to IndexedDB...');
        try {
          await this.indexedDBService.saveCompanies(companies);
        } catch (saveErr) {
          console.warn('⚠️ Error while saving companies to IndexedDB', saveErr);
        }
        
        // Verify save and log contents (helpful for debugging empty records)
        const savedCompanies = this.indexedDBService.isAvailable() ? await this.indexedDBService.getAllCompanies() : [];
        if ((savedCompanies?.length || 0) === 0) {
          try {
            const status = this.indexedDBService.getStatus();
            console.warn('⚠️ IndexedDB appears empty after save. Status:', status);
            // Attempt a normalization pass and re-read
            try { const migrated = await this.indexedDBService.normalizeExistingCompanies(); } catch (migErr) { console.warn('⚠️ normalizeExistingCompanies failed', migErr); }
            const recheck = await this.indexedDBService.getAllCompanies();
          } catch (diagErr) {
            console.warn('⚠️ Diagnostics after saveCompanies failed', diagErr);
          }
        }
        try {
          const exported = await this.indexedDBService.exportAllCompanies();
        } catch (err) {
          console.warn('⚠️ Could not export saved companies for debug', err);
        }
      } else {
        console.warn('⚠️ No companies to save');
      }

      // Fetch all stores for these companies
      const stores: any[] = [];
      for (const companyId of companyIds) {
        try {
          const storesQuery = query(
            collection(this.firestore, 'stores'),
            where('companyId', '==', companyId)
          );
          const storesSnapshot = await runInInjectionContext(this.injector, () => getDocs(storesQuery));
          
          storesSnapshot.forEach(doc => {
            const storeData = doc.data();
            // Save complete store data
            stores.push({
              id: doc.id,
              ...storeData,
              // Convert Firestore Timestamps to Date objects (safe)
              createdAt: toDateValue(storeData['createdAt']) || new Date(storeData['createdAt']),
              updatedAt: toDateValue(storeData['updatedAt']) || (storeData['updatedAt'] ? new Date(storeData['updatedAt']) : undefined),
              subscriptionEndDate: toDateValue(storeData['subscriptionEndDate']) || (storeData['subscriptionEndDate'] ? new Date(storeData['subscriptionEndDate']) : undefined),
              birDetails: storeData['birDetails'] || {
                birPermitNo: '',
                atpOrOcn: '',
                inclusiveSerialNumber: '',
                serialNumber: '',
                minNumber: '',
                invoiceType: '',
                invoiceNumber: '',
                permitDateIssued: new Date(),
                validityNotice: ''
              },
              // Ensure required fields have fallbacks
              storeName: storeData['storeName'] || doc.id,
              companyId: companyId,
              uid: storeData['uid'] || user.uid,
              status: storeData['status'] || 'inactive',
              isBirAccredited: storeData['isBirAccredited'] || false,
              subscriptionPopupShown: storeData['subscriptionPopupShown'] || false,
              storeType: storeData['storeType'] || '',
              branchName: storeData['branchName'] || '',
              address: storeData['address'] || '',
              phoneNumber: storeData['phoneNumber'] || '',
              email: storeData['email'] || '',
              tinNumber: storeData['tinNumber'] || ''
            });
          });
        } catch (error: any) {
          // Log warning but continue - permission errors are non-fatal
          console.warn(`⚠️ Could not fetch stores for company ${companyId} (permission denied or doesn't exist):`, error.message);
        }
      }

      // Save stores to IndexedDB
      if (stores.length > 0) {
        if (this.indexedDBService.isAvailable()) {
          await this.indexedDBService.saveStores(stores);
          
          // Verify save
          const savedStores = await this.indexedDBService.getAllStores();
        } else {
        }
      } else {
        console.warn('⚠️ No stores to save');
      }

      this.logger.info('Companies and stores prefetched successfully', { 
        area: 'auth', 
        payload: { companies: companies.length, stores: stores.length } 
      });
    } catch (error) {
      console.error('❌ CRITICAL ERROR in prefetchCompaniesAndStores:', error);
      this.logger.error('Failed to prefetch companies and stores', { area: 'auth' }, error);
      // Don't throw - this is optional prefetching
    }
  }

  // Get offline auth data by email (helper method)
  private async getOfflineAuthByEmail(email: string): Promise<OfflineAuthData | null> {
    try {
      // Try to get stored offline auth data by email key
      const emailKey = `offlineAuth_email_${email.toLowerCase()}`;
      const uidData = await this.indexedDBService.getSetting(emailKey);
      
      if (uidData && uidData.uid) {
        // Get the actual auth data using the UID
        const authData = await this.indexedDBService.getSetting(`offlineAuth_${uidData.uid}`);
        return authData || null;
      }
      
      return null;
    } catch (error: any) {
      // Check if IndexedDB is permanently broken
      if (error.message?.includes('permanently unavailable')) {
        this.logger.warn('IndexedDB permanently unavailable - offline login disabled', { area: 'auth' });
        return null;
      }
      this.logger.error('Error getting offline auth by email', { area: 'auth' }, error);
      return null;
    }
  }

  // Validate offline credentials
  private async validateOfflineCredentials(email: string, password: string): Promise<OfflineAuthData | null> {
    try {
      const offlineAuthData = await this.getOfflineAuthByEmail(email);
      
        if (!offlineAuthData) {
        this.logger.warn('No offline credentials found for user', { area: 'auth', payload: { email } });
        return null;
      }

      // Check if session is still valid
      if (new Date() > new Date(offlineAuthData.sessionExpiry)) {
        this.logger.info('Offline session expired for user', { area: 'auth', payload: { email } });
        await this.clearOfflineAuthData(offlineAuthData.userProfile.uid);
        return null;
      }

      // Validate password
      const hashedInputPassword = await this.hashPassword(password, offlineAuthData.salt);
      if (hashedInputPassword === offlineAuthData.hashedPassword) {
        this.logger.info('Offline credentials validated for user', { area: 'auth', payload: { email } });
        return offlineAuthData;
      }

      this.logger.warn('Invalid offline password for user', { area: 'auth', payload: { email } });
      return null;
    } catch (error) {
      this.logger.error('Error validating offline credentials', { area: 'auth' }, error);
      return null;
    }
  }

  // Perform offline login
  async loginOffline(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
  this.logger.info('Attempting offline login', { area: 'auth', payload: { email } });
      console.log('🔌 OFFLINE LOGIN: Network status:', navigator.onLine ? 'ONLINE' : 'OFFLINE');
      
      const offlineAuthData = await this.validateOfflineCredentials(email, password);
      if (!offlineAuthData) {
        // Check if user has any offline data at all
        const hasOfflineData = await this.getOfflineAuthByEmail(email);
        
        if (!hasOfflineData) {
          return {
            success: false,
            error: '📱 No offline access available. Please connect to the internet and login to enable offline mode.'
          };
        }
        
        return {
          success: false,
          error: '⏰ Offline session has expired or password is incorrect. Please login online to renew your offline access.'
        };
      }

      // Update offline auth data with new login time
      offlineAuthData.lastLogin = new Date();
      offlineAuthData.isOfflineAuthenticated = true;
      
      await this.indexedDBService.saveSetting(`offlineAuth_${offlineAuthData.userProfile.uid}`, offlineAuthData);

      // Set current user (simulating Firebase auth state)
      this.currentUserSignal.set(offlineAuthData.userProfile);
      this.isLoading.set(false);

      // Save user session in proper OfflineStorageService format
      // Check if user was created before today (existing users assumed to have agreed to policy)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const userCreatedToday = offlineAuthData.userProfile.createdAt && new Date(offlineAuthData.userProfile.createdAt).getTime() >= today.getTime();
      
      await this.offlineStorageService.saveUserSession({
        ...offlineAuthData.userProfile,
        isAgreedToPolicy: !userCreatedToday, // Existing users (created before today) are assumed to have agreed
        currentStoreId: this.getCurrentPermission()?.storeId
      });

      // Load offline data to refresh the current user signal
      await this.offlineStorageService.loadOfflineData();

      this.logger.info('Offline login successful', { area: 'auth', payload: { email } });
      return {
        success: true,
        user: offlineAuthData.userProfile
      };
    } catch (error) {
      this.logger.error('Offline login failed', { area: 'auth' }, error);
      return {
        success: false,
        error: 'Offline login failed. Please try again.'
      };
    }
  }

  // Enhanced login method with offline fallback
  async loginWithOfflineFallback(email: string, password: string, rememberMe: boolean = false): Promise<{ success: boolean; user?: User; error?: string; isOffline?: boolean }> {
    try {
      // Check network connectivity
      const isOnline = await this.networkService.isOnline();
      console.log('🌐 loginWithOfflineFallback: Network check result:', isOnline ? 'ONLINE' : 'OFFLINE');
      
      if (isOnline) {
    this.logger.info('Online - attempting Firebase authentication', { area: 'auth' });
        console.log('🔥 Taking ONLINE path - will prefetch companies/stores');
        
        // Separate try-catch for Firebase authentication vs profile loading
        let userCredential;
        try {
          // Attempt Firebase authentication
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          userCredential = await signInWithEmailAndPassword(this.auth, email, password);
          this.logger.info('Firebase authentication successful, loading user profile', { area: 'auth' });
        } catch (firebaseError: any) {
          this.logger.error('Firebase authentication failed, attempting offline fallback', { area: 'auth', payload: { message: firebaseError.message } }, firebaseError);
          
          // If Firebase fails, try offline authentication
          const offlineResult = await this.loginOffline(email, password);
          if (offlineResult.success) {
            return {
              ...offlineResult,
              isOffline: true
            };
          }
          
          // If both fail, return Firebase error
          return {
            success: false,
            error: this.getFirebaseErrorMessage(firebaseError.code),
            isOffline: false
          };
        }
        
        // Firebase authentication succeeded, now load profile
        try {
          if (userCredential.user) {
            let user = null;

            // Strategy 1: Try direct Firestore fetch immediately
            this.logger.debug('Attempting direct Firestore fetch for user profile', { area: 'auth' });
            try {
              const userDocRef = doc(this.firestore, `users/${userCredential.user.uid}`);
              const userDocSnap = await getDoc(userDocRef);
              
              if (userDocSnap.exists()) {
                user = userDocSnap.data() as User;
                this.logger.info('Direct Firestore fetch successful', { area: 'auth' });
                // Manually update the signal since we fetched directly
                this.currentUserSignal.set(user);
              } else {
                this.logger.warn('User document does not exist in Firestore', { area: 'auth' });
              }
            } catch (directFetchError: any) {
              this.logger.warn('Direct Firestore fetch failed, trying signal wait fallback', { 
                area: 'auth', 
                payload: { error: String(directFetchError) } 
              });
            }

            // Strategy 2: If direct fetch failed, wait for onAuthStateChanged signal
            if (!user) {
              this.logger.debug('Waiting for onAuthStateChanged signal...', { area: 'auth' });
              const startTime = Date.now();
              const timeout = 5000; // 5 seconds timeout for signal wait
              let retryCount = 0;
              const maxRetries = 10; // 10 * 500ms = 5 seconds
              
              while (!user && retryCount < maxRetries && (Date.now() - startTime) < timeout) {
                await this.waitForAuth();
                user = this.getCurrentUser();
                
                if (!user) {
                  retryCount++;
                  if (retryCount % 3 === 0) {  // Log every 1.5 seconds
                    this.logger.debug(`Waiting for user profile signal... (attempt ${retryCount}/${maxRetries})`, { area: 'auth' });
                  }
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
            }
            
            if (user) {
              // Try to save credentials for offline access (optional)
              try {
                await this.saveOfflineAuthData(user, password, rememberMe);
                
                // Prefetch companies and stores for offline use
                await this.prefetchCompaniesAndStores(user);
                // Ensure any pre-existing company entries in IndexedDB are normalized
                try {
                  const migrated = await this.indexedDBService.normalizeExistingCompanies();
                  console.log(`🚀 LOGIN: Normalized ${migrated} existing companies in IndexedDB`);
                } catch (migrateErr) {
                  this.logger.warn('Failed to normalize existing companies in IndexedDB (non-blocking)', { area: 'auth', payload: { error: String(migrateErr) } });
                }

                // Ensure companies are explicitly saved into TovrikaOfflineDB (best-effort)
                try {
                  await this.saveAllCompaniesToIndexedDB();
                  this.logger.debug('Ensured companies saved to IndexedDB after login', { area: 'auth' });
                } catch (err) {
                  this.logger.warn('Failed to ensure companies saved to IndexedDB (non-blocking)', { area: 'auth', payload: { error: String(err) } });
                }
                
                this.logger.info('Online login successful, offline data saved', { area: 'auth' });
                // Best-effort: lazily resolve DataPrefetchService and prefetch common datasets for offline use
                try {
                  const dp = this.injector.get(DataPrefetchService as any) as DataPrefetchService;
                  dp?.prefetchForUser(user.uid, (user as any).currentCompanyId).catch(() => {});
                } catch (prefetchErr) {
                  this.logger.warn('Prefetch scheduling failed (non-blocking)', { area: 'auth', payload: { error: String(prefetchErr) } });
                }

                // Dev-only: seed IndexedDB from Firestore after login so client token is available.
                if (!environment.production) {
                  try {
                    const mod = await import('../dev/seed-companies');
                    if (mod?.seedCompaniesFromFirestoreIfEmpty) {
                      await mod.seedCompaniesFromFirestoreIfEmpty(this.firestore, this.indexedDBService, this.injector);
                    }
                  } catch (seedErr) {
                    this.logger.warn('Dev seeder failed post-login (non-blocking)', { area: 'auth', payload: { error: String(seedErr) } });
                  }
                }

                // Best-effort: load companies into CompanySetupService so UI and offline store
                // can pick them up without relying on a cloud function. Use dynamic import
                // + injector to avoid circular DI.
                try {
                  const CompanySetupServiceClass = await import('./companySetup.service').then(m => m.CompanySetupService as any);
                  const cs = this.injector.get(CompanySetupServiceClass) as any;
                  if (cs && typeof cs.loadCompaniesForCurrentUser === 'function') {
                    await cs.loadCompaniesForCurrentUser();
                    this.logger.debug('Loaded companies for current user via CompanySetupService', { area: 'auth' });
                  }
                } catch (companyLoadErr) {
                  this.logger.warn('Company load (non-blocking) failed', { area: 'auth', payload: { error: String(companyLoadErr) } });
                }

                // Best-effort: start product sync (realtime + polling) so products are kept in IndexedDB
                try {
                  // Lazily resolve to avoid circular DI
                  const ProductsSyncService = await import('../core/services/products-sync.service').then(m => m.ProductsSyncService as any);
                  const ps = this.injector.get(ProductsSyncService) as any;
                  const companyId = (user as any).currentCompanyId || this.getCurrentPermission()?.companyId;
                  const storeId = this.getCurrentPermission()?.storeId as string | undefined;
                  ps?.startRealtime(companyId, storeId);
                  ps?.startPolling(companyId, storeId, 60000);
                } catch (syncErr) {
                  this.logger.warn('Products sync initialization failed (non-blocking)', { area: 'auth', payload: { error: String(syncErr) } });
                }
              } catch (offlineSaveError: any) {
                // Check if IndexedDB is permanently broken
                if (offlineSaveError.message?.includes('permanently unavailable')) {
                  this.logger.warn('IndexedDB unavailable - continuing without offline storage', { area: 'auth' });
                } else {
                  this.logger.warn('Failed to save offline credentials', { area: 'auth', payload: { error: String(offlineSaveError) } });
                }
                // Continue login - offline save is optional
              }
              
              return {
                success: true,
                user,
                isOffline: false
              };
            } else {
              this.logger.error('User profile not loaded after all attempts', { area: 'auth' });
              this.logger.warn('This may indicate slow network or Firestore connection issues', { area: 'auth' });
              // Even though profile didn't load, authentication succeeded
              // User data will load via onAuthStateChanged listener
              this.logger.warn('Continuing - profile will load asynchronously', { area: 'auth' });

              // Attempt offline fallback before failing - this helps when Firestore/profile
              // loading is slow or temporarily unavailable but offline credentials exist.
              try {
                this.logger.warn('Profile load timeout - attempting offline fallback', { area: 'auth' });
                const offlineResult = await this.loginOffline(email, password);
                if (offlineResult.success && offlineResult.user) {
                  this.logger.info('Offline fallback login succeeded after profile timeout', { area: 'auth' });
                  return {
                    ...offlineResult,
                    isOffline: true
                  };
                } else {
                  this.logger.warn('Offline fallback did not succeed', { area: 'auth', payload: { error: offlineResult.error } });
                }
              } catch (fallbackErr) {
                this.logger.warn('Offline fallback attempt failed', { area: 'auth', payload: { error: String(fallbackErr) } });
              }

              return {
                success: false,
                error: 'User profile is taking too long to load. Please check your connection and try again.',
                isOffline: false
              };
            }
          }
          
          return {
            success: false,
            error: 'Failed to load user profile after authentication',
            isOffline: false
          };
          } catch (profileError: any) {
          this.logger.error('Error loading user profile', { area: 'auth', payload: { message: profileError.message } }, profileError);
          // Profile loading failed, but authentication succeeded
          // Return error but don't trigger offline fallback
          return {
            success: false,
            error: 'Failed to load user profile. Please try again.',
            isOffline: false
          };
        }
      } else {
        this.logger.info('Offline - attempting offline authentication', { area: 'auth' });
        console.log('📱 Taking OFFLINE path - cannot prefetch (no network)');
        
        // Network is offline, use offline authentication
        const offlineResult = await this.loginOffline(email, password);
        return {
          ...offlineResult,
          isOffline: true
        };
      }
    } catch (error) {
      this.logger.error('Login with offline fallback failed', { area: 'auth' }, error);
      
      // Provide more specific error message
      let errorMessage = 'Login failed. Please try again.';
      
      if (error instanceof Error) {
        // Check if it's a Firebase auth error
        if (error.message.includes('auth/')) {
          const match = error.message.match(/auth\/[\w-]+/);
          if (match) {
            errorMessage = this.getFirebaseErrorMessage(match[0]);
          }
        } else if (error.message) {
          // Use the error message if available
          errorMessage = error.message;
        }
      }
      
  this.logger.error('Final error message', { area: 'auth', payload: { message: errorMessage } });
      
      return {
        success: false,
        error: errorMessage,
        isOffline: false
      };
    }
  }

  // Check if user has offline access
  async hasOfflineAccess(email?: string): Promise<boolean> {
    try {
      if (!email && !this.getCurrentUser()) {
        return false;
      }
      
      const userEmail = email || this.getCurrentUser()?.email;
      if (!userEmail) return false;

      const offlineAuthData = await this.getOfflineAuthByEmail(userEmail);
      if (!offlineAuthData) {
        return false;
      }
      
      // Check if session is still valid
      return new Date() <= new Date(offlineAuthData.sessionExpiry);
    } catch (error) {
      this.logger.error('Error checking offline access', { area: 'auth' }, error);
      return false;
    }
  }

  // Clear offline authentication data
  async clearOfflineAuthData(uid?: string): Promise<void> {
    try {
      if (uid && this.indexedDBService.isAvailable()) {
        // Clear specific user's auth data
        const authData = await this.indexedDBService.getSetting(`offlineAuth_${uid}`);
        if (authData && authData.email) {
          // Remove email mapping
          await this.indexedDBService.saveSetting(`offlineAuth_email_${authData.email.toLowerCase()}`, null);
        }
        // Remove auth data
        await this.indexedDBService.saveSetting(`offlineAuth_${uid}`, null);
        // Remove policy/terms flags (cleanup)
        try {
          await this.indexedDBService.saveSetting(`isPolicyAgree_${uid}`, null);
          await this.indexedDBService.saveSetting(`isTermsAgree_${uid}`, null);
        } catch (flagClearErr) {
          this.logger.warn('Failed to clear policy/terms flags from IndexedDB', { area: 'auth', payload: { error: String(flagClearErr) } });
        }
      } else {
        // For clearing all, we would need to implement a different approach
        // For now, just log a warning
        this.logger.warn('Clearing all offline auth data not implemented. Please clear specific user data.', { area: 'auth' });
      }
      this.logger.info('Offline authentication data cleared', { area: 'auth' });
    } catch (error) {
      this.logger.error('Failed to clear offline auth data', { area: 'auth' }, error);
    }
  }

  /**
   * Check whether policy and terms flags are accepted for a user (IndexedDB)
   * If `uid` is omitted, uses currently signed-in user if available.
   */
  async hasAcceptedPolicyAndTerms(uid?: string): Promise<boolean> {
    try {
      const theUid = uid || this.getCurrentUser()?.uid;
      if (!theUid) return false;
      const policy = await this.indexedDBService.getSetting(`isPolicyAgree_${theUid}`);
      const terms = await this.indexedDBService.getSetting(`isTermsAgree_${theUid}`);
      return !!policy && !!terms;
    } catch (error) {
      this.logger.warn('Error reading policy/terms flags from IndexedDB', { area: 'auth', payload: { error: String(error) } });
      return false;
    }
  }

  // Get Firebase error message
  private getFirebaseErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials.';
      default:
        return 'Login failed. Please try again.';
    }
  }

  // ========================
  // EMAIL VERIFICATION METHODS
  // ========================

  /**
   * Send email verification to current user
   */
  async sendEmailVerification(): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('No user is currently signed in');
      }

      if (user.emailVerified) {
        throw new Error('Email is already verified');
      }

      await sendEmailVerification(user, {
        url: `https://app.tovrika.com/verify-email`,
        handleCodeInApp: false
      });

      this.logger.info('Email verification sent', { area: 'auth', payload: { email: user.email } });
    } catch (error: any) {
      this.logger.error('Failed to send email verification', { area: 'auth' }, error);
      throw new Error(this.getEmailVerificationErrorMessage(error.code));
    }
  }

  /**
   * Verify email using action code from verification link
   */
  async verifyEmail(actionCode: string): Promise<void> {
    try {
      await applyActionCode(this.auth, actionCode);
      
      // Reload the current user to get updated emailVerified status
      if (this.auth.currentUser) {
        await this.auth.currentUser.reload();
        
        // Update the current user signal
        const updatedUser = this.auth.currentUser;
        if (updatedUser && this.currentUserSignal()) {
          const currentUserData = this.currentUserSignal()!;
          this.currentUserSignal.set({
            ...currentUserData,
            // Note: Firebase user.emailVerified is separate from our User interface
            // You might want to add an emailVerified field to your User interface
          });
        }
      }
      
      this.logger.info('Email verified successfully', { area: 'auth' });
    } catch (error: any) {
      this.logger.error('Failed to verify email', { area: 'auth' }, error);
      throw new Error(this.getEmailVerificationErrorMessage(error.code));
    }
  }

  /**
   * Check if current user's email is verified
   */
  isEmailVerified(): boolean {
    return this.auth.currentUser?.emailVerified ?? false;
  }

  /**
   * Get action code info (used to validate verification links)
   */
  async getActionCodeInfo(actionCode: string): Promise<any> {
    try {
      const info = await checkActionCode(this.auth, actionCode);
      return info;
    } catch (error: any) {
      this.logger.error('Failed to check action code', { area: 'auth' }, error);
      throw new Error(this.getEmailVerificationErrorMessage(error.code));
    }
  }

  // ========================
  // PASSWORD RESET METHODS
  // ========================

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email, {
        url: `https://app.tovrika.com/reset-password`,
        handleCodeInApp: false
      });
      
      this.logger.info('Password reset email sent', { area: 'auth', payload: { email } });
    } catch (error: any) {
      this.logger.error('Failed to send password reset email', { area: 'auth' }, error);
      throw new Error(this.getPasswordResetErrorMessage(error.code));
    }
  }

  /**
   * Verify password reset code
   */
  async verifyPasswordResetCode(actionCode: string): Promise<string> {
    try {
      const email = await verifyPasswordResetCode(this.auth, actionCode);
      return email;
    } catch (error: any) {
      this.logger.error('Failed to verify password reset code', { area: 'auth' }, error);
      throw new Error(this.getPasswordResetErrorMessage(error.code));
    }
  }

  /**
   * Confirm password reset with new password
   */
  async confirmPasswordReset(actionCode: string, newPassword: string): Promise<void> {
    try {
      await confirmPasswordReset(this.auth, actionCode, newPassword);
      this.logger.info('Password reset successfully', { area: 'auth' });
    } catch (error: any) {
      this.logger.error('Failed to reset password', { area: 'auth' }, error);
      throw new Error(this.getPasswordResetErrorMessage(error.code));
    }
  }

  // ========================
  // ERROR MESSAGE HELPERS
  // ========================

  private getEmailVerificationErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/expired-action-code':
        return 'The verification link has expired. Please request a new one.';
      case 'auth/invalid-action-code':
        return 'The verification link is invalid or has already been used.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found. The user may have been deleted.';
      case 'auth/too-many-requests':
        return 'Too many requests. Please wait before trying again.';
      default:
        return 'Email verification failed. Please try again.';
    }
  }

  private getPasswordResetErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/expired-action-code':
        return 'The password reset link has expired. Please request a new one.';
      case 'auth/invalid-action-code':
        return 'The password reset link is invalid or has already been used.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'auth/too-many-requests':
        return 'Too many requests. Please wait before trying again.';
      default:
        return 'Password reset failed. Please try again.';
    }
  }

  // ========================
  // USER CODE GENERATION
  // ========================

  /**
   * Generate a unique user code (6 characters)
   * Similar to store code generation
   */
  async generateUserCode(): Promise<string> {
    const MAX_ATTEMPTS = 5;
    let attempt = 0;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;

      // Generate a unique base using epoch time + random suffix
      const epoch = Date.now().toString(36).toUpperCase(); // e.g., 'L5Z3K8'
      const rand = Math.floor(Math.random() * 1296).toString(36).toUpperCase(); // 2-char random (36^2 = 1296)
      const candidate = (epoch + rand).slice(-6); // total length = 6

      // Ensure uniqueness in 'users' collection
      const isUnique = await this.isUserCodeUnique(candidate);
      if (isUnique) {
        return candidate;
      }

      console.warn(`🔁 Collision on userCode ${candidate}, retrying (attempt ${attempt}/${MAX_ATTEMPTS})`);
    }

    throw new Error('Unable to generate a unique user code after multiple attempts');
  }

  /**
   * Check if user code is unique
   */
  private async isUserCodeUnique(code: string): Promise<boolean> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('userCode', '==', code));
    const snap = await getDocs(q);
    return snap.empty;
  }
}
