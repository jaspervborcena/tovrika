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
  getDocs 
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
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
  public readonly activeCompanies = computed(() => 
    this.companiesSignal().filter(company => company.settings?.currency)
  );

  constructor(private firestore: Firestore, private authService: AuthService, private offlineDocService: OfflineDocumentService) {
  // Only load companies if user has permissions
    this.loadCompaniesIfAuthorized();
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
      const querySnapshot = await getDocs(companiesRef);
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
