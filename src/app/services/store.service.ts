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
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { Store } from '../interfaces/store.interface';

export type { Store } from '../interfaces/store.interface';

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
    private authService: AuthService,
    private firestoreSecurityService: FirestoreSecurityService,
    private offlineDocService: OfflineDocumentService
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
        const store: Store = {
          id: doc.id,
          companyId: data.companyId || '',
          storeName: data.storeName || '',
          storeCode: data.storeCode || '',
          storeType: data.storeType || '',
          branchName: data.branchName || '',
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          uid: data.uid || '',
          status: data.status || 'inactive',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          logoUrl: data.logoUrl || '',
          // BIR Compliance
          isBirAccredited: data.isBirAccredited || false,
          tempInvoiceNumber: data.tempInvoiceNumber || '',
          birDetails: data.birDetails || {
            birPermitNo: '',
            atpOrOcn: '',
            inclusiveSerialNumber: '',
            serialNumber: '',
            minNumber: '',
            maxNumber: ''
          },
          tinNumber: data.tinNumber || '',
          // Subscription
          subscription: data.subscription || {
            tier: 'free',
            status: 'trial',
            startDate: new Date(),
            billingCycle: 'monthly'
          },
          promoUsage: data.promoUsage || undefined,
          subscriptionPopupShown: data.subscriptionPopupShown || false
        };
        
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
        const store: Store = {
          id: doc.id,
          companyId: data.companyId || '',
          storeName: data.storeName || '',
          storeCode: data.storeCode || '',
          storeType: data.storeType || '',
          branchName: data.branchName || '',
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          uid: data.uid || '',
          status: data.status || 'inactive',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          logoUrl: data.logoUrl || '',
          // BIR Compliance
          isBirAccredited: data.isBirAccredited || false,
          tempInvoiceNumber: data.tempInvoiceNumber || '',
          birDetails: data.birDetails || {
            birPermitNo: '',
            atpOrOcn: '',
            inclusiveSerialNumber: '',
            serialNumber: '',
            minNumber: '',
            maxNumber: ''
          },
          tinNumber: data.tinNumber || '',
          // Subscription
          subscription: data.subscription || {
            tier: 'free',
            status: 'trial',
            startDate: new Date(),
            billingCycle: 'monthly'
          },
          promoUsage: data.promoUsage || undefined,
          subscriptionPopupShown: data.subscriptionPopupShown || false
        };
        
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
      const newStore: Omit<Store, 'id'> = {
        ...store,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
      const documentId = await this.offlineDocService.createDocument('stores', newStore);
      const createdStore: Store = {
        id: documentId,
        ...newStore
      };
      // Update the signal
      this.storesSignal.update(stores => [...stores, createdStore]);
      
      // Add default roles for this store
      const defaultRolesService = new (await import('./default-roles.service')).DefaultRolesService(this.firestore, this.offlineDocService);
      await defaultRolesService.createDefaultRoles(store.companyId, documentId);
      
      console.log('✅ Store created with ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
      return documentId;
    } catch (error) {
      console.error('Error creating store:', error);
      throw error;
    }
  }

  async updateStore(storeId: string, updates: Partial<Store>) {
    try {
      const storeRef = doc(this.firestore, 'stores', storeId);
      
      const updateData = await this.firestoreSecurityService.addUpdateSecurityFields({
        ...updates,
        updatedAt: new Date()
      });

      console.log('🔥 Firestore updateStore - Store ID:', storeId);
      console.log('🔥 Firestore updateStore - Updates:', updates);
      console.log('🔥 Firestore updateStore - Final data to save:', updateData);
      
      await updateDoc(storeRef, updateData);
      console.log('✅ Firestore document updated successfully');

      // Update the signal
      this.storesSignal.update(stores =>
        stores.map(store =>
          store.id === storeId
            ? { ...store, ...updateData }
            : store
        )
      );
      console.log('✅ Local stores signal updated');
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
  
  /**
   * Generate default invoice number for new stores
   */
  generateDefaultInvoiceNo(): string {
    const currentYear = new Date().getFullYear();
    return `INV-${currentYear}-000000`;
  }

  /**
   * Parse invoice number to extract parts
   */
  parseInvoiceNo(invoiceNo: string): { prefix: string; year: string; sequence: number } | null {
    const match = invoiceNo.match(/^(INV)-(\d{4})-(\d{6})$/);
    if (!match) return null;
    
    return {
      prefix: match[1],
      year: match[2],
      sequence: parseInt(match[3], 10)
    };
  }

  /**
   * Generate next invoice number
   */
  generateNextInvoiceNo(currentInvoiceNo: string): string {
    const parsed = this.parseInvoiceNo(currentInvoiceNo);
    if (!parsed) {
      // If parsing fails, return current year with sequence 1
      const currentYear = new Date().getFullYear();
      return `INV-${currentYear}-000001`;
    }

    const currentYear = new Date().getFullYear();
    let nextSequence: number;
    let year: string;

    if (parseInt(parsed.year, 10) === currentYear) {
      // Same year, increment sequence
      nextSequence = parsed.sequence + 1;
      year = parsed.year;
    } else {
      // New year, reset sequence to 1
      nextSequence = 1;
      year = currentYear.toString();
    }

    // Pad sequence to 6 digits
    const paddedSequence = nextSequence.toString().padStart(6, '0');
    return `${parsed.prefix}-${year}-${paddedSequence}`;
  }

  /**
   * Initialize temp invoice number for existing stores that don't have one
   */
  async initializeInvoiceNoForStore(storeId: string): Promise<void> {
    try {
      const store = this.getStore(storeId);
      if (store && !store.tempInvoiceNumber) {
        const defaultInvoiceNo = this.generateDefaultInvoiceNo();
        await this.updateStore(storeId, { tempInvoiceNumber: defaultInvoiceNo });
        console.log(`✅ Initialized temp invoice number for store ${store.storeName}: ${defaultInvoiceNo}`);
      }
    } catch (error) {
      console.error('❌ Error initializing temp invoice number:', error);
      throw error;
    }
  }

  // Debug method to check store status
  debugStoreStatus() {
    const stores = this.getStores();
    console.log('🔍 StoreService Debug Status:');
    console.log('  - Total stores:', stores.length);
    console.log('  - Last load time:', this.loadTimestamp ? new Date(this.loadTimestamp).toLocaleTimeString() : 'Never');
    console.log('  - Is loading:', this.isLoading);
    console.log('  - Stores:', stores.map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId, tempInvoice: s.tempInvoiceNumber })));
    return { stores, count: stores.length, lastLoad: this.loadTimestamp, isLoading: this.isLoading };
  }

  /**
   * Submit BIR accreditation for a store
   * Sets status to 'pending' and saves submission timestamp
   */
  async submitBirAccreditation(
    storeId: string,
    birData: {
      tinNumber: string;
      businessName: string;
      address: string;
      // Add other BIR-related fields as needed
    }
  ): Promise<void> {
    try {
      console.log('📄 Submitting BIR accreditation for store:', storeId);

      const storeRef = doc(this.firestore, 'stores', storeId);
      await updateDoc(storeRef, {
        isBirAccredited: false, // Not yet accredited until approved
        birAccreditationStatus: 'pending',
        birAccreditationSubmittedAt: new Date(),
        'birDetails.tinNumber': birData.tinNumber,
        'birDetails.businessName': birData.businessName,
        'birDetails.address': birData.address,
        updatedAt: new Date()
      });

      console.log('✅ BIR accreditation submitted, awaiting admin approval');
    } catch (error) {
      console.error('❌ Error submitting BIR accreditation:', error);
      throw error;
    }
  }

  /**
   * Update BIR accreditation status
   * Called by admin after review
   */
  async updateBirAccreditationStatus(
    storeId: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string
  ): Promise<void> {
    try {
      console.log('🔄 Updating BIR accreditation status:', storeId, '→', status);

      const updateData: any = {
        birAccreditationStatus: status,
        updatedAt: new Date()
      };

      if (status === 'approved') {
        updateData.isBirAccredited = true;
        updateData.birAccreditationApprovedAt = new Date();
      } else if (status === 'rejected' && rejectionReason) {
        updateData.birAccreditationRejectedReason = rejectionReason;
      }

      const storeRef = doc(this.firestore, 'stores', storeId);
      await updateDoc(storeRef, updateData);

      console.log('✅ BIR accreditation status updated');
    } catch (error) {
      console.error('❌ Error updating BIR accreditation status:', error);
      throw error;
    }
  }

  /**
   * Get stores pending BIR accreditation (for admin)
   */
  async getStoresPendingBirAccreditation(): Promise<Store[]> {
    try {
      console.log('📋 Loading stores pending BIR accreditation');

      const storesRef = collection(this.firestore, 'stores');
      const storesQuery = query(
        storesRef,
        where('birAccreditationStatus', '==', 'pending')
      );

      const querySnapshot = await getDocs(storesQuery);
      const stores = querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        const store: Store = {
          id: doc.id,
          companyId: data.companyId || '',
          storeName: data.storeName || '',
          storeCode: data.storeCode || '',
          storeType: data.storeType || '',
          branchName: data.branchName || '',
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          uid: data.uid || '',
          status: data.status || 'inactive',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          logoUrl: data.logoUrl || '',
          isBirAccredited: data.isBirAccredited || false,
          birAccreditationStatus: data.birAccreditationStatus,
          birAccreditationSubmittedAt: data.birAccreditationSubmittedAt?.toDate(),
          birAccreditationApprovedAt: data.birAccreditationApprovedAt?.toDate(),
          birAccreditationRejectedReason: data.birAccreditationRejectedReason,
          tinNumber: data.tinNumber || '',
          birDetails: data.birDetails || {
            birPermitNo: '',
            atpOrOcn: '',
            inclusiveSerialNumber: '',
            serialNumber: '',
            minNumber: '',
            invoiceType: '',
            invoiceNumber: '',
            permitDateIssued: new Date(),
            validityNotice: ''
          },
          subscription: data.subscription || {
            tier: 'freemium',
            status: 'inactive',
            subscribedAt: new Date(),
            expiresAt: new Date(),
            billingCycle: 'monthly',
            durationMonths: 0,
            amountPaid: 0,
            discountPercent: 0,
            finalAmount: 0,
            paymentMethod: 'credit_card',
            lastPaymentDate: new Date()
          },
          subscriptionPopupShown: data.subscriptionPopupShown || false,
          tempInvoiceNumber: data.tempInvoiceNumber
        };
        return store;
      });

      console.log('✅ Found', stores.length, 'stores pending BIR accreditation');
      return stores;
    } catch (error) {
      console.error('❌ Error loading pending BIR stores:', error);
      throw error;
    }
  }
}
