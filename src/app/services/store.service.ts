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
  collectionGroup,
  documentId
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';

export interface Store {
  id?: string;
  companyId: string;
  storeName: string;
  storeCode: string;
  storeType: string;
  branchName?: string;
  address: string;
  phoneNumber?: string;
  email?: string;
  managerName?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt?: Date;
  taxId?: string;
  tinNumber?: string;
  invoiceNumber?: string;
  invoiceType?: string;
  logoUrl?: string;
  atpOrOcn?: string;
  birPermitNo?: string;
  inclusiveSerialNumber?: string;
  serialNumber?: string;
  minNumber?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  private readonly storesSignal = signal<Store[]>([]);
  private isLoading = false;
  private loadTimestamp = 0;
  
  // Public signals and computed values
  readonly stores = computed(() => {
    const currentStores = this.storesSignal();
    // Log when stores change
    if (currentStores.length === 0 && this.loadTimestamp > 0) {
      console.warn('🚨 STORES SIGNAL IS EMPTY! Last loaded:', new Date(this.loadTimestamp).toLocaleTimeString());
      console.trace('Store signal empty trace');
    }
    return currentStores;
  });
  
  readonly totalStores = computed(() => this.storesSignal().length);
  readonly storesByCompany = computed(() => {
    const storeMap = new Map<string, Store[]>();
    this.stores().forEach(store => {
      const stores = storeMap.get(store.companyId) || [];
      stores.push(store);
      storeMap.set(store.companyId, stores);
    });
    return storeMap;
  });

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  async loadStores(storeIds: string[]) {
    if (this.isLoading) {
      console.log('⏳ Store loading already in progress, skipping...');
      return;
    }
    
    try {
      this.isLoading = true;
      console.log('🏪 StoreService.loadStores called with storeIds:', storeIds);
      
      if (!storeIds || storeIds.length === 0) {
        console.log('📋 No store IDs provided, clearing stores');
        this.storesSignal.set([]);
        return;
      }

      const storesRef = collection(this.firestore, 'stores');
      const storesQuery = query(storesRef, where(documentId(), 'in', storeIds));

      console.log('🔍 Executing Firestore query for stores...');
      const querySnapshot = await getDocs(storesQuery);
      console.log('📊 Firestore query returned', querySnapshot.docs.length, 'documents');
      
      const stores = querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        const store = {
          id: doc.id,
          companyId: data.companyId || '',
          storeName: data.storeName || '',
          storeCode: data.storeCode || '',
          storeType: data.storeType || '',
          branchName: data.branchName || '',
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          managerName: data.managerName || '',
          status: data.status || 'inactive',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          taxId: data.taxId || '',
          tinNumber: data.tinNumber || '',
          invoiceNumber: data.invoiceNumber || '',
          invoiceType: data.invoiceType || '',
          logoUrl: data.logoUrl || '',
          atpOrOcn: data.atpOrOcn || '',
          birPermitNo: data.birPermitNo || '',
          inclusiveSerialNumber: data.inclusiveSerialNumber || '',
          serialNumber: data.serialNumber || '',
          minNumber: data.minNumber || '',
          message: data.message || ''
        } as Store;
        
        console.log('🏪 Mapped store:', store.storeName, 'ID:', store.id, 'CompanyId:', store.companyId);
        return store;
      });
      
      console.log('💾 Setting stores signal with', stores.length, 'stores');
      this.storesSignal.set(stores);
      this.loadTimestamp = Date.now();
      console.log('✅ Stores loaded and signal updated. Current stores:', this.getStores().length);
      
      // Verify stores are still there after a delay
      setTimeout(() => {
        const currentCount = this.getStores().length;
        console.log('🔍 Store count verification after 1s:', currentCount);
        if (currentCount === 0) {
          console.error('🚨 CRITICAL: Stores disappeared after loading!');
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error loading stores:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async loadStoresByCompany(companyId: string) {
    if (this.isLoading) {
      console.log('⏳ Store loading already in progress, skipping...');
      return;
    }
    
    try {
      this.isLoading = true;
      console.log('🏪 StoreService.loadStoresByCompany called with companyId:', companyId);
      
      const storesRef = collection(this.firestore, 'stores');
      const storesQuery = query(storesRef, where('companyId', '==', companyId));

      console.log('🔍 Executing Firestore query for stores by company...');
      const querySnapshot = await getDocs(storesQuery);
      console.log('📊 Firestore query returned', querySnapshot.docs.length, 'documents');
      
      const stores = querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        const store = {
          id: doc.id,
          companyId: data.companyId || '',
          storeName: data.storeName || '',
          storeCode: data.storeCode || '',
          storeType: data.storeType || '',
          branchName: data.branchName || '',
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          managerName: data.managerName || '',
          status: data.status || 'inactive',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          taxId: data.taxId || '',
          tinNumber: data.tinNumber || '',
          invoiceNumber: data.invoiceNumber || '',
          invoiceType: data.invoiceType || '',
          logoUrl: data.logoUrl || '',
          atpOrOcn: data.atpOrOcn || '',
          birPermitNo: data.birPermitNo || '',
          inclusiveSerialNumber: data.inclusiveSerialNumber || '',
          serialNumber: data.serialNumber || '',
          minNumber: data.minNumber || '',
          message: data.message || ''
        } as Store;
        
        console.log('🏪 Mapped store:', store.storeName, 'ID:', store.id, 'CompanyId:', store.companyId);
        return store;
      });
      
      console.log('💾 Setting stores signal with', stores.length, 'stores');
      this.storesSignal.set(stores);
      this.loadTimestamp = Date.now();
      console.log('✅ Stores loaded and signal updated. Current stores:', this.getStores().length);
      
    } catch (error) {
      console.error('❌ Error loading stores by company:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async createStore(store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const storesRef = collection(this.firestore, 'stores');
      
      const newStore: Omit<Store, 'id'> = {
        ...store,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(storesRef, newStore);
      const createdStore: Store = {
        id: docRef.id,
        ...newStore
      };

      // Update the signal
      this.storesSignal.update(stores => [...stores, createdStore]);
      
      // Update the current user's storeIds array
      try {
        const currentUser = this.authService.getCurrentUser();
        if (currentUser) {
          const currentStoreIds = (currentUser as any).storeIds || [];
          const updatedStoreIds = [...currentStoreIds, docRef.id];
          
          await this.authService.updateUserData({ 
            storeIds: updatedStoreIds
          } as any);
          console.log('User storeIds updated successfully');
        }
      } catch (userUpdateError) {
        console.error('Error updating user storeIds:', userUpdateError);
        // Store is created, but user update failed - this is not critical
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating store:', error);
      throw error;
    }
  }

  async updateStore(storeId: string, updates: Partial<Store>) {
    try {
      const storeRef = doc(this.firestore, 'stores', storeId);
      
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await updateDoc(storeRef, updateData);

      // Update the signal
      this.storesSignal.update(stores =>
        stores.map(store =>
          store.id === storeId
            ? { ...store, ...updateData }
            : store
        )
      );
    } catch (error) {
      console.error('Error updating store:', error);
      throw error;
    }
  }

  async deleteStore(storeId: string) {
    try {
      const storeRef = doc(this.firestore, 'stores', storeId);
      await deleteDoc(storeRef);

      // Update the signal
      this.storesSignal.update(stores =>
        stores.filter(store => store.id !== storeId)
      );
    } catch (error) {
      console.error('Error deleting store:', error);
      throw error;
    }
  }

  // Getter for stores
  getStores() {
    return this.stores();
  }

  // Get stores for a specific company
  getStoresByCompany(companyId: string) {
    return this.stores().filter(store => store.companyId === companyId);
  }

  // Get a specific store
  getStore(storeId: string) {
    return this.stores().find(store => store.id === storeId);
  }
}
