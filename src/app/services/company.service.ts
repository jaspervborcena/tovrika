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
  addDoc,
  getDoc,
  Timestamp,
  DocumentReference
} from '@angular/fire/firestore';
import { Company, Store, Branch } from '../interfaces/company.interface';
import { AuthService } from './auth.service';

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
    private authService: AuthService
  ) {}

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

    // If user doesn't have current company access, return null
    const currentPermission = this.authService.getCurrentPermission();
    if (!currentPermission?.companyId) return null;

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
      const currentPermission = this.authService.getCurrentPermission();
      console.log("user current company:", currentPermission?.companyId);
      
      // If user has a current company selected, load only that company
      if (currentPermission?.companyId) {
        const companyDocRef = doc(this.firestore, 'companies', currentPermission.companyId);
        const companyDoc = await getDoc(companyDocRef);

        if (companyDoc.exists()) {
          const companyData = companyDoc.data() as Omit<Company, 'id'>;
          const company: Company = {
            ...companyData,
            id: companyDoc.id,
            createdAt: this.toDate(companyData['createdAt']),
            stores: []
          };

          // Load stores for this company
          const storesRef = collection(this.firestore, 'stores');
          const storesQuery = query(storesRef, where('companyId', '==', company.id));
          const storesSnapshot = await getDocs(storesQuery);
          const stores: Store[] = [];

          for (const storeDoc of storesSnapshot.docs) {
            const storeData = storeDoc.data() as Omit<Store, 'id' | 'branches'>;
            const store: Store = {
              ...storeData,
              id: storeDoc.id,
              createdAt: this.toDate(storeData['createdAt']),
              updatedAt: storeData['updatedAt'] ? this.toDate(storeData['updatedAt']) : undefined,
              branches: []
            };

            stores.push(store);
          }

          company.stores = stores;
          companies.push(company);
        }
      }
      // If user has no companyId, set empty array (they need to create a company)

      this.companiesSignal.set(companies);
    } catch (error) {
      console.error('Error loading companies:', error);
      this.companiesSignal.set([]);
      throw error;
    }
  }

  async getCompanyById(companyId: string): Promise<Company | null> {
    try {
      const companyDocRef = doc(this.firestore, 'companies', companyId);
      const companyDoc = await getDoc(companyDocRef);

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
      
      // Extract stores if they exist, otherwise use empty array
      const stores = company.stores || [];
      
      // Remove stores and clean up undefined values from company data before saving
      const { stores: _, ...rawCompanyData } = company;
      const companyData = Object.fromEntries(
        Object.entries(rawCompanyData)
          .filter(([_, value]) => value !== undefined)
      );
      
      // Create the new company object with required fields
      const newCompany = {
        ...companyData,
        ownerUid: user.uid, // Set the current user as owner
        slug: companyData['slug'] || (typeof companyData['name'] === 'string' ? companyData['name'].toLowerCase().replace(/[^a-z0-9]/g, '-') : 'company'),
        plan: companyData['plan'] || 'basic',
        onboardingStatus: companyData['onboardingStatus'] || 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(companiesRef, newCompany);
      
      // Update user's permissions - add new company permission or update existing creator permission
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        const permissions = currentUser.permissions || [];
        
        // Check if user already has a creator permission without companyId
        const creatorPermissionIndex = permissions.findIndex(p => p.roleId === 'creator' && !p.companyId);
        
        if (creatorPermissionIndex >= 0) {
          // Update existing creator permission with the new company ID
          permissions[creatorPermissionIndex].companyId = docRef.id;
        } else {
          // Add new creator permission for this company
          permissions.push({
            companyId: docRef.id,
            roleId: 'creator'
          });
        }
        
        await this.authService.updateUserData({
          permissions,
          currentCompanyId: docRef.id // Set this as the current company
        });
      }
      
      // Add stores if we have any
      if (stores.length > 0) {
        await this.addStoresAndBranches(docRef.id, stores);
      }

      await this.loadCompanies(); // Reload to get fresh data
      return docRef.id;
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
      const { branches, ...rawStoreData } = store;
      
      // Clean up undefined values from store data
      const storeData = Object.fromEntries(
        Object.entries(rawStoreData)
          .filter(([_, value]) => value !== undefined)
      );
      
      const newStore = {
        ...storeData,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const storeRef = await addDoc(storesRef, newStore);

      if (branches && branches.length > 0) {
        const branchesRef = collection(this.firestore, 'branches');
        for (const branch of branches) {
          const newBranch = {
            ...branch,
            companyId,
            storeId: storeRef.id,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await addDoc(branchesRef, newBranch);
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
      await updateDoc(companyRef, updateData);
      await this.loadCompanies(); // Reload to get fresh data
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }

  async deleteCompany(companyId: string) {
    try {
      const companyRef = doc(this.firestore, `companies/${companyId}`);
      await deleteDoc(companyRef);
      await this.loadCompanies(); // Reload to get fresh data
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  }

  // Helper method to check if user needs to create a company
  userNeedsToCreateCompany(): boolean {
    const user = this.authService.getCurrentUser();
    const currentPermission = this.authService.getCurrentPermission();
    return !currentPermission?.companyId;
  }

  // Helper method to get current company or null if user needs to create one
  async getCurrentCompanyOrNull(): Promise<Company | null> {
    const user = this.authService.getCurrentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!currentPermission?.companyId) return null;
    return this.getActiveCompany();
  }
}
