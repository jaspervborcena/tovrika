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
  collectionGroup
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';

export interface Store {
  id?: string;
  companyId: string;
  storeName: string;
  storeCode: string;
  storeType: string;
  address: string;
  phoneNumber?: string;
  email?: string;
  managerName?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt?: Date;
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

  async loadStores(companyId?: string) {
    if (this.isLoading) {
      console.log('⏳ Store loading already in progress, skipping...');
      return;
    }
    
    try {
      this.isLoading = true;
      console.log('🏪 StoreService.loadStores called with companyId:', companyId);
      
      const storesRef = collection(this.firestore, 'stores');
      const storesQuery = companyId 
        ? query(storesRef, where('companyId', '==', companyId))
        : query(storesRef);

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
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          managerName: data.managerName || '',
          status: data.status || 'inactive',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
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
  
  // Debug method to check store status
  debugStoreStatus() {
    const stores = this.getStores();
    console.log('🔍 StoreService Debug Status:');
    console.log('  - Total stores:', stores.length);
    console.log('  - Last load time:', this.loadTimestamp ? new Date(this.loadTimestamp).toLocaleTimeString() : 'Never');
    console.log('  - Is loading:', this.isLoading);
    console.log('  - Stores:', stores.map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
    return { stores, count: stores.length, lastLoad: this.loadTimestamp, isLoading: this.isLoading };
  }
}
