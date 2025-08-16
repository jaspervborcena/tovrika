import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs } from '@angular/fire/firestore';

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
  providedIn: 'root'
})
export class CompanySetupService {
  private companyCollection = 'companies';

  constructor(private firestore: Firestore) {}

  async addCompanySetup(company: Company): Promise<string> {
    try {
      console.log('Starting company setup...', company);

      // 1. Get company collection reference
      const companyRef = collection(this.firestore, this.companyCollection);

      // 2. Check if company exists
      const companyQuery = query(companyRef, where('slug', '==', company.slug));
      const querySnapshot = await getDocs(companyQuery);

      if (!querySnapshot.empty) {
        console.warn('Company already exists:', company.slug);
        return 'exists';
      }

      // 3. Prepare company data with embedded stores and branches
      const companyData = {
        name: company.name,
        slug: company.slug,
        ownerUid: company.ownerUid,
        plan: company.plan,
        createdAt: company.createdAt,
        logoUrl: company.logoUrl || null,
        stores: company.stores.map(store => ({
          storeName: store.storeName,
          address: store.address || '',
          createdAt: new Date(),
          branches: store.branches.map(branch => ({
            branchName: branch.branchName,
            address: branch.address || '',
            createdAt: new Date()
          }))
        }))
      };

      // 4. Add to Firestore
      const newCompanyRef = await addDoc(companyRef, companyData);
      console.log('✅ Company added successfully with ID:', newCompanyRef.id);
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
