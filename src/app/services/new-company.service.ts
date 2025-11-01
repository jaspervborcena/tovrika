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
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { Company } from '../interfaces/company.interface';
import { Branch } from '../interfaces/branch.interface';
import { Store } from '../interfaces/store.interface';

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

  constructor(
    private authService: AuthService,
    private offlineDocService: OfflineDocumentService
  ) {
    this.firestore = inject(Firestore);
  }
  private firestore: Firestore;

  async loadCompanies() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const companiesRef = collection(this.firestore, this.companiesCollection);
      let companiesQuery = query(companiesRef);

  // TODO: If you need to restrict by admin, fetch roleId from userRoles collection here and check

      const querySnapshot = await getDocs(companiesQuery);
      const companies: Company[] = [];

      for (const doc of querySnapshot.docs) {
        const companyData = doc.data() as Omit<Company, 'id'>;
        const company: Company = {
          ...companyData,
          id: doc.id,
          createdAt: companyData.createdAt
        };

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
      const cleanCompany = this.removeUndefinedValues(company);
      
      const newCompany = {
        ...cleanCompany,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
      const documentId = await this.offlineDocService.createDocument(this.companiesCollection, newCompany);

      await this.loadCompanies(); // Reload to get fresh data
      console.log('✅ Company created with ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
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
      const storesRef = collection(this.firestore, this.storesCollection);
      // Filter out id and branches (UI-only property)
      const { id, branches, ...storeData } = store as any;
      const cleanStore = this.removeUndefinedValues(storeData);
      const newStore = {
        ...cleanStore,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
      const storeId = await this.offlineDocService.createDocument(this.storesCollection, newStore);

      // Handle branches if they exist (optional UI property)
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
          await this.offlineDocService.createDocument(this.branchesCollection, newBranch);
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
      await this.offlineDocService.updateDocument(this.companiesCollection, companyId, updateData);

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
  await this.offlineDocService.deleteDocument(this.companiesCollection, companyId);
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
  await this.offlineDocService.deleteDocument(this.branchesCollection, branchDoc.id);
    }

    // Then delete the store
  await this.offlineDocService.deleteDocument(this.storesCollection, storeId);
  }

  // Public methods for store and branch creation
  async createStore(data: Omit<Store, 'id' | 'branches' | 'updatedAt'>) {
    const cleanStore = this.removeUndefinedValues(data);
    const newStore = {
      ...cleanStore,
      updatedAt: new Date()
    };
    // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
    const documentId = await this.offlineDocService.createDocument(this.storesCollection, newStore);
    console.log('✅ Store created with ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
    return documentId;
  }

  async createBranch(data: Omit<Branch, 'id' | 'updatedAt'>) {
    const cleanBranch = this.removeUndefinedValues(data);
    const newBranch = {
      ...cleanBranch,
      updatedAt: new Date()
    };
    // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
    const documentId = await this.offlineDocService.createDocument(this.branchesCollection, newBranch);
    console.log('✅ Branch created with ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
    return documentId;
  }
}
