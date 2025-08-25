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

  async getActiveCompany() {
    const user = this.authService.getCurrentUser();
    if (!user) return null;

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
      if (!user) return;

      const companiesRef = collection(this.firestore, 'companies');
      let companiesQuery = query(companiesRef);

      if (user.role !== 'admin') {
        companiesQuery = query(companiesRef, where('ownerUid', '==', user.uid));
      }

      const querySnapshot = await getDocs(companiesQuery);
      const companies: Company[] = [];

      for (const doc of querySnapshot.docs) {
        const companyData = doc.data() as Omit<Company, 'id'>;
        const company: Company = {
          ...companyData,
          id: doc.id,
          createdAt: companyData['createdAt'] as Date,
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
            branches: []
          };

          // Load branches for this store
          const branchesRef = collection(this.firestore, 'branches');
          const branchesQuery = query(branchesRef, where('storeId', '==', store.id));
          const branchesSnapshot = await getDocs(branchesQuery);
          store.branches = branchesSnapshot.docs.map(branchDoc => ({
            ...branchDoc.data(),
            id: branchDoc.id
          } as Branch));

          stores.push(store);
        }

        company.stores = stores;
        companies.push(company);
      }

      this.companiesSignal.set(companies);
    } catch (error) {
      console.error('Error loading companies:', error);
      throw error;
    }
  }

  async createCompany(companyInput: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
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
      
      // Create the new company object
      const newCompany = {
        ...companyData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(companiesRef, newCompany);
      
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
}
