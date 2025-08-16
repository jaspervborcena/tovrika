import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, doc, updateDoc } from '@angular/fire/firestore';

export interface Branch {
  branchName: string;
  address?: string;
}

export interface Store {
  storeName: string;
  address?: string;
  branches: Branch[];
}

export interface Company {
  name: string;
  slug: string;
  ownerUid: string;
  plan: string;
  createdAt: Date;
  logoUrl?: string;
  stores: Store[];
}

@Injectable({
  providedIn: 'root',
})
export class CompanySetupService {
  private companyCollection = 'companies';

  constructor(private firestore: Firestore) {
    console.log('CompanySetupService initialized');
  }

  /**
   * Adds a company, its stores, and branches in Firestore
   */
  async addCompanySetup(company: Company): Promise<string> {
    try {
      console.log('Starting company setup...', company);
      
      // 1. Check if company already exists
      const companyRef = collection(this.firestore, 'companies');
      const companyQuery = query(companyRef, where('slug', '==', company.slug));
      const querySnapshot = await getDocs(companyQuery);

      if (!querySnapshot.empty) {
        console.warn('Company already exists:', company.slug);
        return 'exists';
      }

      // 2. Add company document
      const companyData = {
        name: company.name,
        slug: company.slug,
        ownerUid: company.ownerUid,
        plan: company.plan,
        createdAt: company.createdAt,
        logoUrl: company.logoUrl || 'https://storage.googleapis.com/pos/company/logo.png'
      };

      const newCompanyRef = await addDoc(companyRef, companyData);
      const companyId = newCompanyRef.id;
      console.log('✅ Company added with ID:', companyId);

      // 3. Add stores
      const storesRef = collection(this.firestore, 'stores');
      for (const store of company.stores) {
        const storeData = {
          companyId: companyId,
          storeName: store.storeName,
          address: store.address || '',
          createdAt: new Date()
        };

        const newStoreRef = await addDoc(storesRef, storeData);
        const storeId = newStoreRef.id;
        console.log('✅ Store added with ID:', storeId);

        // 4. Add branches for this store
        const branchesRef = collection(this.firestore, 'branches');
        for (const branch of store.branches) {
          const branchData = {
            companyId: companyId,
            storeId: storeId,
            branchName: branch.branchName,
            address: branch.address || '',
            createdAt: new Date()
          };

          const newBranchRef = await addDoc(branchesRef, branchData);
          console.log('✅ Branch added with ID:', newBranchRef.id);
        }
      }

      return 'success';
      
    } catch (error: any) {
      console.error('❌ Error adding company setup:', error);
      if (error.code === 'permission-denied') {
        return 'permission-denied';
      }
      return `error: ${error.message || 'unknown error'}`;
    }
  }
}