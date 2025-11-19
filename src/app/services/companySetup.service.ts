import { Injectable, computed, signal, Injector, runInInjectionContext } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs 
} from '@angular/fire/firestore';
import { DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { IndexedDBService, OfflineCompany } from '../core/services/indexeddb.service';
import { Company } from '../interfaces/company.interface';

@Injectable({
  providedIn: 'root'
})
export class CompanySetupService {
  private readonly companiesSignal = signal<Company[]>([]);
  
  // Public signals
  readonly companies = computed(() => this.companiesSignal());
  
  // Computed properties
  public readonly totalCompanies = computed(() => this.companiesSignal().length);
  // Active companies: consider those that have at least one store configured
  public readonly activeCompanies = computed(() => 
    this.companiesSignal().filter(company => (company.stores?.length ?? 0) > 0)
  );

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private offlineDocService: OfflineDocumentService,
    private indexedDBService: IndexedDBService,
    private injector: Injector
  ) {
  // Only load companies if user has permissions
    this.loadCompaniesIfAuthorized();
  }

  /**
   * Load specific companies by their IDs and update the `companies` signal.
   * Useful when you already know the list of company IDs for the current user.
   */
  async loadCompaniesByIds(companyIds: string[]) {
    try {
      if (!companyIds || companyIds.length === 0) {
        this.companiesSignal.set([]);
        return;
      }

      const docs = await Promise.all(companyIds.map(id => runInInjectionContext(this.injector, () => getDoc(doc(this.firestore, `companies/${id}`)))));
      const docsTyped = docs as DocumentSnapshot<DocumentData>[];
      const companies = docsTyped
        .filter((d: DocumentSnapshot<DocumentData>) => d.exists())
        .map((d: DocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() as any) } as Company));

      this.companiesSignal.set(companies);

      // Best-effort: persist companies to the TovrikaOfflineDB under `companies`
      try {
        const offlineCompanies: OfflineCompany[] = companies.map(c => {
          const { stores, ...rest } = c as any;
          return {
            ...rest,
            lastSync: new Date()
          } as OfflineCompany;
        });
        await this.indexedDBService.saveCompanies(offlineCompanies);
      } catch (saveErr) {
        console.warn('CompanySetupService: Failed to save companies to IndexedDB:', saveErr);
      }
    } catch (error) {
      console.error('Error loading companies by ids:', error);
      // Keep existing companies signal untouched on error
    }
  }

  /**
   * Convenience: load companies for the currently authenticated user using
   * `AuthService.getUserCompanies()` which returns an array of companyId/roleId.
   */
  async loadCompaniesForCurrentUser() {
    try {
      const list = this.authService.getUserCompanies();
      const ids = list.map(l => l.companyId).filter(Boolean);
      await this.loadCompaniesByIds(ids);
    } catch (error) {
      console.error('Error loading companies for current user:', error);
    }
  }

  private async loadCompaniesIfAuthorized() {
    // Check if user lacks company permissions
    const currentPermission = this.authService.getCurrentPermission();
    const noCompanyAccess = !currentPermission || 
                     !currentPermission.companyId || 
                     currentPermission.companyId.trim() === '';
    
    if (noCompanyAccess) {
      console.log('CompanySetupService: No company access, skipping company loading');
      return;
    }
    
    this.loadCompanies();
  }

  private async loadCompanies() {
    try {
      const companiesRef = collection(this.firestore, 'companies');
      const querySnapshot = await runInInjectionContext(this.injector, () => getDocs(companiesRef));
      const companies = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Company));
      
      this.companiesSignal.set(companies);
    } catch (error) {
      console.error('Error loading companies:', error);
      // Here you might want to implement proper error handling
    }
  }

  async createCompany(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const companiesRef = collection(this.firestore, 'companies');
      const newCompany: Company = {
        ...company,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = doc(companiesRef);
      await setDoc(docRef, newCompany);

      // Update the signal with the new company
      this.companiesSignal.update(companies => [...companies, { ...newCompany, id: docRef.id }]);
      
      // Update the current user's permissions array with the new company
      try {
        const currentUser = this.authService.getCurrentUser();
        const updatedPermissions = currentUser?.permissions || [];
        // Add or update permission for this company
        const existingPermissionIndex = updatedPermissions.findIndex(p => p.companyId === docRef.id);
        if (existingPermissionIndex >= 0) {
          updatedPermissions[existingPermissionIndex] = { companyId: docRef.id, roleId: 'creator' };
        } else {
          updatedPermissions.push({ companyId: docRef.id, roleId: 'creator' });
        }
        
        await this.authService.updateUserData({ 
          permissions: updatedPermissions,
          currentCompanyId: docRef.id // Set as current company
        });
        console.log('User permissions updated successfully');
      } catch (userUpdateError) {
        console.error('Error updating user permissions:', userUpdateError);
        // Company is created, but user update failed - this is not critical
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  }

  async updateCompany(companyId: string, updates: Partial<Company>) {
    try {
      const companyRef = doc(this.firestore, `companies/${companyId}`);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
  await this.offlineDocService.updateDocument('companies', companyId, updateData);

      // Update the signal
      this.companiesSignal.update(companies =>
        companies.map(company =>
          company.id === companyId
            ? { ...company, ...updateData }
            : company
        )
      );
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }

  async deleteCompany(companyId: string) {
    try {
  const companyRef = doc(this.firestore, `companies/${companyId}`);
  await this.offlineDocService.deleteDocument('companies', companyId);

      // Update the signal
      this.companiesSignal.update(companies =>
        companies.filter(company => company.id !== companyId)
      );
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  }

  // Getter for companies signal value
  getCompanies() {
    return this.companies();
  }

  // Get a specific company
  getCompany(companyId: string) {
    return this.companies().find(company => company.id === companyId);
  }
}
