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
  addDoc,
  DocumentReference
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Company, Store, Branch } from '../interfaces/company.interface';

@Injectable({
  providedIn: 'root'
})
export class NewCompanyService {
  private readonly companiesSignal = signal<Company[]>([]);
  private readonly companiesCollection = 'companies';
  private readonly storesCollection = 'stores';
  private readonly branchesCollection = 'branches';

  // Public signals and computed values
  readonly companies = computed(() => this.companiesSignal());
  readonly totalCompanies = computed(() => this.companiesSignal());

  constructor(private authService: AuthService) {
    this.firestore = inject(Firestore);
  }
  private firestore: Firestore;

  async loadCompanies() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const companiesRef = collection(this.firestore, this.companiesCollection);
      let companiesQuery = query(companiesRef);

      if ((user.roleId || user.role) !== 'admin') {
        companiesQuery = query(companiesRef, where('ownerUid', '==', user.uid));
      }

      const querySnapshot = await getDocs(companiesQuery);
      const companies: Company[] = [];

      for (const doc of querySnapshot.docs) {
        const companyData = doc.data() as Omit<Company, 'id'>;
        const company: Company = {
          ...companyData,
          id: doc.id,
          createdAt: companyData.createdAt,
          stores: []
        };

        // Load stores for this company
        const storesRef = collection(this.firestore, this.storesCollection);
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
          const branchesRef = collection(this.firestore, this.branchesCollection);
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

  private removeUndefinedValues<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    ) as Partial<T>;
  }

  async createCompany(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const companiesRef = collection(this.firestore, this.companiesCollection);
      const { stores, ...companyData } = company;
      const cleanCompany = this.removeUndefinedValues(companyData);
      
      const newCompany = {
        ...cleanCompany,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(companiesRef, newCompany);
      
      // Add stores if any
      if (company.stores && company.stores.length > 0) {
        await this.addStoresAndBranches(docRef.id, company.stores);
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
      const storesRef = collection(this.firestore, this.storesCollection);
      const { branches, id, ...storeData } = store;
      const cleanStore = this.removeUndefinedValues(storeData);
      const newStore = {
        ...cleanStore,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const storeRef = await addDoc(storesRef, newStore);

      if (store.branches && store.branches.length > 0) {
        const branchesRef = collection(this.firestore, this.branchesCollection);
        for (const branch of store.branches) {
          await addDoc(branchesRef, {
            ...branch,
            companyId,
            storeId: storeRef.id,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }
  }

  async updateCompany(
    companyId: string,
    updates: Partial<Omit<Company, 'id' | 'createdAt'>>
  ) {
    try {
      const companyRef = doc(this.firestore, this.companiesCollection, companyId);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      await updateDoc(companyRef, updateData);

      // Update stores if included in updates
      if (updates.stores) {
        // Delete existing stores and branches
        const existingStores = await this.getStoresForCompany(companyId);
        for (const store of existingStores) {
          await this.deleteStoreAndBranches(store.id!);
        }

        // Add new stores and branches
        await this.addStoresAndBranches(companyId, updates.stores);
      }

      await this.loadCompanies(); // Reload to get fresh data
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }

  async deleteCompany(companyId: string) {
    try {
      // Delete all stores and branches first
      const stores = await this.getStoresForCompany(companyId);
      for (const store of stores) {
        await this.deleteStoreAndBranches(store.id!);
      }

      // Then delete the company
      const companyRef = doc(this.firestore, this.companiesCollection, companyId);
      await deleteDoc(companyRef);
      await this.loadCompanies(); // Reload to get fresh data
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  }

  private async getStoresForCompany(companyId: string): Promise<Store[]> {
    const storesRef = collection(this.firestore, this.storesCollection);
    const storesQuery = query(storesRef, where('companyId', '==', companyId));
    const storesSnapshot = await getDocs(storesQuery);
    return storesSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Store));
  }

  private async deleteStoreAndBranches(storeId: string) {
    // Delete all branches for this store first
    const branchesRef = collection(this.firestore, this.branchesCollection);
    const branchesQuery = query(branchesRef, where('storeId', '==', storeId));
    const branchesSnapshot = await getDocs(branchesQuery);
    
    for (const branchDoc of branchesSnapshot.docs) {
      await deleteDoc(doc(this.firestore, this.branchesCollection, branchDoc.id));
    }

    // Then delete the store
    await deleteDoc(doc(this.firestore, this.storesCollection, storeId));
  }

  // Public methods for store and branch creation
  async createStore(data: Omit<Store, 'id' | 'branches' | 'updatedAt'>) {
    const storesRef = collection(this.firestore, this.storesCollection);
    const cleanStore = this.removeUndefinedValues(data);
    const newStore = {
      ...cleanStore,
      updatedAt: new Date()
    };
    const storeRef = await addDoc(storesRef, newStore);
    return storeRef.id;
  }

  async createBranch(data: Omit<Branch, 'id' | 'updatedAt'>) {
    const branchesRef = collection(this.firestore, this.branchesCollection);
    const cleanBranch = this.removeUndefinedValues(data);
    const newBranch = {
      ...cleanBranch,
      updatedAt: new Date()
    };
    const branchRef = await addDoc(branchesRef, newBranch);
    return branchRef.id;
  }
}
