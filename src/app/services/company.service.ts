import { Injectable, computed, signal, Injector, runInInjectionContext } from '@angular/core';
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
  addDoc,
  getDoc,
  Timestamp,
  DocumentReference
} from '@angular/fire/firestore';
import { Company } from '../interfaces/company.interface';
import { Branch } from '../interfaces/branch.interface';
import { Store } from '../interfaces/store.interface';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { IndexedDBService } from '../core/services/indexeddb.service';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private readonly companiesSignal = signal<Company[]>([]);

  // Public signals and computed values
  readonly companies = computed(() => this.companiesSignal());
  readonly totalCompanies = computed(() => this.companiesSignal().length);

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private firestoreSecurityService: FirestoreSecurityService,
    private offlineDocService: OfflineDocumentService,
    private indexedDBService: IndexedDBService,
    private injector: Injector
  ) {}

  // Resolve the primary companyId from user profile or permissions.
  // Order: user.companyId (string or first non-empty in array) -> user.currentCompanyId -> permission.companyId (string or first non-empty in array)
  private getPrimaryCompanyId(): string | undefined {
    const user: any = this.authService.getCurrentUser() as any;
    const pickFirstNonEmpty = (val: any): string | undefined => {
      if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return undefined;
      }
      if (typeof val === 'string') {
        const s = val.trim();
        return s || undefined;
      }
      return undefined;
    };

    // 1) From user document (getUserData output)
    const fromUserDoc = pickFirstNonEmpty(user?.companyId);
    if (fromUserDoc) return fromUserDoc;

    // 2) From user's currentCompanyId selection
    const fromCurrentSelection = pickFirstNonEmpty(user?.currentCompanyId);
    if (fromCurrentSelection) return fromCurrentSelection;

    // 2.5) From any permission entry in the user's permissions array
    if (Array.isArray(user?.permissions)) {
      const ids = user.permissions.map((p: any) => p?.companyId).filter((x: any) => typeof x === 'string' || Array.isArray(x));
      const fromAnyPermission = pickFirstNonEmpty(ids);
      if (fromAnyPermission) return fromAnyPermission;
    }

    // 3) From permission (supports string or array)
    const permission: any = this.authService.getCurrentPermission() as any;
    const fromPermission = pickFirstNonEmpty(permission?.companyId);
    if (fromPermission) return fromPermission;

    return undefined;
  }

  // Helper function to convert Firestore Timestamp to Date
  private toDate(timestamp: any): Date {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    return new Date();
  }

  async getActiveCompany() {
    const user = this.authService.getCurrentUser();
    if (!user) return null;

    // If user doesn't have a resolvable companyId, return null
    const primaryCompanyId = this.getPrimaryCompanyId();
    if (!primaryCompanyId) return null;

    const companies = this.companies();
    if (companies.length === 0) {
      await this.loadCompanies();
      return this.companies()[0] || null;
    }
    return companies[0];
  }

  async loadCompanies() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.companiesSignal.set([]);
        return;
      }

      const companies: Company[] = [];
  const primaryCompanyId = this.getPrimaryCompanyId();
      
      // If user has a resolvable companyId, load only that company
      if (primaryCompanyId) {
        try {
            // Ensure current user's ID token is fresh before attempting Firestore read.
            try {
              await runInInjectionContext(this.injector, async () => {
                const { Auth } = await import('@angular/fire/auth');
                try {
                  const afAuth = this.injector.get(Auth as any) as any;
                  const firebaseUser = afAuth?.currentUser;
                  if (firebaseUser && typeof firebaseUser.getIdToken === 'function') {
                    // Force refresh once to avoid stale/expired token causing permission errors
                    await firebaseUser.getIdToken(true).catch(() => null);
                  }
                } catch (e) {
                  // Non-fatal: continue to attempt the read even if token refresh fails
                  console.warn('CompanyService: token refresh attempt failed', e);
                }
              });
            } catch (e) {
              console.warn('CompanyService: unable to run token refresh in injection context', e);
            }

            const companyDocRef = doc(this.firestore, 'companies', primaryCompanyId);
            const companyDoc = await runInInjectionContext(this.injector, () => getDoc(companyDocRef));

          if (companyDoc.exists()) {
            const companyData = companyDoc.data() as Omit<Company, 'id'>;
            const company: Company = {
              ...companyData,
              id: companyDoc.id,
              createdAt: this.toDate(companyData['createdAt'])
            };

            companies.push(company);

            // Persist a local snapshot for offline use into the `companies` store
            try {
              const offlineCompany = {
                id: company.id,
                name: (company as any).name,
                slug: (company as any).slug,
                ownerUid: (company as any).ownerUid || (company as any).owner || '',
                address: (company as any).address,
                email: (company as any).email,
                logoUrl: (company as any).logoUrl,
                phone: (company as any).phone,
                plan: (company as any).plan,
                taxId: (company as any).taxId,
                website: (company as any).website,
                createdAt: company.createdAt,
                updatedAt: company.updatedAt || new Date(),
                lastSync: new Date()
              } as any;
              await this.indexedDBService.saveCompanies([offlineCompany]);
              console.log('💾 CompanyService: Saved company snapshot to IndexedDB.companies for offline use:', company.id);
            } catch (saveErr) {
              console.warn('💾 CompanyService: Failed to save company snapshot to IndexedDB.companies:', saveErr);
            }
          }
        } catch (fireErr) {
          console.warn('🌐 CompanyService: Firestore unavailable or failed to load company, attempting offline snapshot...', fireErr);

          // Try to load snapshot from IndexedDB
          try {
            const snapshot = await this.indexedDBService.getSetting(`company_${primaryCompanyId}`);
            if (snapshot) {
              // Snapshot may already be a Company object
              const company: Company = {
                ...(snapshot as any),
                id: primaryCompanyId,
                createdAt: snapshot.createdAt ? new Date(snapshot.createdAt) : new Date()
              };
              companies.push(company);
              console.log('💾 CompanyService: Loaded company snapshot from IndexedDB for offline use:', primaryCompanyId);
            } else {
              console.warn('💾 CompanyService: No offline snapshot found for company:', primaryCompanyId);
            }
          } catch (snapErr) {
            console.error('💾 CompanyService: Failed to read company snapshot from IndexedDB:', snapErr);
          }
        }
      }
      // If user has no companyId, set empty array (they need to create a company)

      console.log('CompanyService.loadCompanies: loaded companies count =', companies.length, 'companies =', companies);
      this.companiesSignal.set(companies);
    } catch (error) {
      console.error('Error loading companies:', error);
      this.companiesSignal.set([]);
      throw error;
    }
  }

  async getCompanyById(companyId: string): Promise<Company | null> {
    try {
      // Force-refresh ID token before per-company read to reduce permission-denied errors.
      try {
        await runInInjectionContext(this.injector, async () => {
          const { Auth } = await import('@angular/fire/auth');
          try {
            const afAuth = this.injector.get(Auth as any) as any;
            const firebaseUser = afAuth?.currentUser;
            if (firebaseUser && typeof firebaseUser.getIdToken === 'function') {
              await firebaseUser.getIdToken(true).catch(() => null);
            }
          } catch (e) {
            console.warn('CompanyService: token refresh attempt failed', e);
          }
        });
      } catch (e) {
        console.warn('CompanyService: unable to run token refresh in injection context', e);
      }

      const companyDocRef = doc(this.firestore, 'companies', companyId);
      const companyDoc = await runInInjectionContext(this.injector, () => getDoc(companyDocRef));

      if (!companyDoc.exists()) {
        return null;
      }

      const companyData = companyDoc.data() as Omit<Company, 'id'>;
      const company: Company = {
        ...companyData,
        id: companyDoc.id,
        createdAt: this.toDate(companyData['createdAt']),
        updatedAt: companyData['updatedAt'] ? this.toDate(companyData['updatedAt']) : undefined,
        stores: [] // We don't load stores for individual company lookup
      };

      // Debug: log the fetched company data
      console.log('CompanyService.getCompanyById: fetched company:', company);

      // Persist a local snapshot for offline use into the `companies` store
      try {
        const offlineCompany = {
          id: company.id,
          name: (company as any).name,
          slug: (company as any).slug,
          ownerUid: (company as any).ownerUid || (company as any).owner || '',
          address: (company as any).address,
          email: (company as any).email,
          logoUrl: (company as any).logoUrl,
          phone: (company as any).phone,
          plan: (company as any).plan,
          taxId: (company as any).taxId,
          website: (company as any).website,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt || new Date(),
          lastSync: new Date()
        } as any;
        await this.indexedDBService.saveCompanies([offlineCompany]);
        console.log('💾 CompanyService: Saved company snapshot to IndexedDB.companies (getCompanyById):', company.id);
      } catch (saveErr) {
        console.warn('💾 CompanyService: Failed to save company snapshot to IndexedDB.companies (getCompanyById):', saveErr);
      }

      return company;
    } catch (error) {
      console.error('Error getting company by ID:', error);
      return null;
    }
  }


  async createCompany(companyInput: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const companiesRef = collection(this.firestore, 'companies');
      
      // Ensure we have a valid company object
      const company = companyInput || {};
      
      // Clean up undefined values from company data before saving
      const companyData = Object.fromEntries(
        Object.entries(company)
          .filter(([_, value]) => value !== undefined)
      );
      
      // Create the new company object with required fields
      const newCompany = {
        ...companyData,
        ownerUid: user.uid, // Set the current user as owner
        slug: companyData['slug'] || (typeof companyData['name'] === 'string' ? companyData['name'].toLowerCase().replace(/[^a-z0-9]/g, '-') : 'company'),
        plan: companyData['plan'] || 'basic',
  // onboardingStatus removed - no longer tracked here
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
      const documentId = await this.offlineDocService.createDocument('companies', newCompany);
      
      // Update user's permissions - add new company permission or update existing creator permission
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        // Remove any legacy 'visitor' entries to avoid confusion
        const permissions = (currentUser.permissions || []).filter(p => p.roleId !== 'visitor');
        
        // Check if user already has a creator permission without companyId
        const creatorPermissionIndex = permissions.findIndex(p => p.roleId === 'creator' && !p.companyId);
        
        if (creatorPermissionIndex >= 0) {
          // Update existing creator permission with the new company ID
          permissions[creatorPermissionIndex].companyId = documentId;
        } else {
          // Add new creator permission for this company
          permissions.push({
            companyId: documentId,
            roleId: 'creator'
          });
        }
        // Promote root-level role to creator and set current company
        await this.authService.updateUserData({
          permissions,
          currentCompanyId: documentId, // Set this as the current company
          roleId: 'creator'
        });
      }

  await this.loadCompanies(); // Reload to get fresh data
      return documentId;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  }

  private async addStoresAndBranches(
    companyId: string,
    stores: Store[]
  ) {
    for (const store of stores) {
      const storesRef = collection(this.firestore, 'stores');
      
      // Clean up undefined values from store data
      const storeData = Object.fromEntries(
        Object.entries(store)
          .filter(([key, value]) => value !== undefined && key !== 'id' && key !== 'branches')
      );
      
      const newStore = {
        ...storeData,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
      const storeId = await this.offlineDocService.createDocument('stores', newStore);

      // Handle branches if they exist (optional UI property)
      const branches = (store as any).branches;
      if (branches && Array.isArray(branches) && branches.length > 0) {
        for (const branch of branches) {
          const newBranch = {
            ...branch,
            companyId,
            storeId: storeId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
          await this.offlineDocService.createDocument('branches', newBranch);
        }
      }
    }
  }

  async updateCompany(
    companyId: string,
    updates: Partial<Omit<Company, 'id' | 'createdAt'>>
  ) {
    try {
      const companyRef = doc(this.firestore, `companies/${companyId}`);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      await this.offlineDocService.updateDocument('companies', companyId, updateData);
      await this.loadCompanies(); // Reload to get fresh data
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }

  async deleteCompany(companyId: string) {
    try {
  const companyRef = doc(this.firestore, `companies/${companyId}`);
  await this.offlineDocService.deleteDocument('companies', companyId);
      await this.loadCompanies(); // Reload to get fresh data
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  }

  // Helper method to check if user needs to create a company
  userNeedsToCreateCompany(): boolean {
    return !this.getPrimaryCompanyId();
  }

  // Helper method to get current company or null if user needs to create one
  async getCurrentCompanyOrNull(): Promise<Company | null> {
    const primaryCompanyId = this.getPrimaryCompanyId();
    if (!primaryCompanyId) return null;
    return this.getActiveCompany();
  }
}
