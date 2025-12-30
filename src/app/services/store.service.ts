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
import { runTransaction, getFirestore } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { toDateValue } from '../core/utils/date-utils';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { IndexedDBService } from '../core/services/indexeddb.service';
import { Store } from '../interfaces/store.interface';
import { FEATURE_FLAGS } from '../shared/config/feature-flags';

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
    console.log('📊 StoreService: current stores =', currentStores);
    // Log when stores change
    if (currentStores.length === 0 && this.loadTimestamp > 0) {
      console.warn('🚨 STORES SIGNAL IS EMPTY! Last loaded:', new Date(this.loadTimestamp).toLocaleTimeString());
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
    ,
    private indexedDb: IndexedDBService
  ) {}

  async loadStores(storeIds: string[]) {
    if (this.isLoading) {
      return;
    }
    
    try {
    this.isLoading = true;
      
      if (!storeIds || storeIds.length === 0) {
        this.storesSignal.set([]);
        return;
      }

      const storesRef = collection(this.firestore, 'stores');
      const storesQuery = query(storesRef, where(documentId(), 'in', storeIds));

      let querySnapshot = await getDocs(storesQuery);
      // If permission denied, try one token refresh and retry the query once
      if (!querySnapshot || (querySnapshot && querySnapshot.empty === true && this.authService.getCurrentUser() && false)) {
        // no-op placeholder to keep lint happy
      }
      
      const stores = querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        const store: Store = {
          id: doc.id,
          companyId: data.companyId || '',
          storeName: data.storeName || '',
          storeType: data.storeType || '',
          storeCode: data.storeCode || '',
          branchName: data.branchName || '',
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          uid: data.uid || '',
          status: data.status || 'inactive',
          createdAt: toDateValue(data.createdAt) || new Date(),
          updatedAt: toDateValue(data.updatedAt) || new Date(),
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
          // Effective subscription end date (synced from subscriptions collection)
          subscriptionEndDate: toDateValue(data.subscriptionEndDate) || (data.subscriptionEndDate || undefined),
          promoUsage: data.promoUsage || undefined,
          subscriptionPopupShown: data.subscriptionPopupShown || false
        };
        
        return store;
      });
      
      this.storesSignal.set(stores);
      this.loadTimestamp = Date.now();
      // Persist snapshot per-company to IndexedDB settings for offline use
      try {
        const companyId = stores[0]?.companyId;
        if (companyId) {
          await this.indexedDb.saveSetting(`stores_${companyId}`, stores);
        }
      } catch (e) {
        console.warn('Failed to persist stores snapshot to IndexedDB:', e);
      }
      
      
    } catch (error) {
      console.error('❌ Error loading stores:', error);
      // Attempt offline fallback: try to read stored snapshot for the company
      try {
        // As a simpler fallback, load saved stores for current user's company via auth
        const currentUser = this.authService.getCurrentUser();
        const currentCompanyId = currentUser?.currentCompanyId as string | undefined;
        if (currentCompanyId) {
          const saved = await this.indexedDb.getSetting(`stores_${currentCompanyId}`);
          if (saved && Array.isArray(saved)) {
            const normalized = saved.map((s: any) => ({
              ...s,
              createdAt: toDateValue(s.createdAt) || (s.createdAt || new Date()),
              updatedAt: toDateValue(s.updatedAt) || (s.updatedAt || new Date()),
              subscriptionEndDate: toDateValue(s.subscriptionEndDate) || (s.subscriptionEndDate || undefined)
            }));
            this.storesSignal.set(normalized);
            return;
          }
        }
      } catch (fallbackError) {
        console.warn('Stores offline fallback failed:', fallbackError);
      }

      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async loadStoresByCompany(companyId: string) {
    if (this.isLoading) {
      return;
    }
    
    try {
  this.isLoading = true;
      // Ensure auth state is settled before making Firestore requests.
      try {
        await this.authService.waitForAuth();
        // Force a token refresh to avoid transient "Missing or insufficient permissions" errors
        await this.authService.getFirebaseIdToken(true);
      } catch (authPrepErr) {
        console.warn('🔍 StoreService: auth preparation failed (may be offline)', authPrepErr);
      }
      
      const storesRef = collection(this.firestore, 'stores');
      const storesQuery = query(storesRef, where('companyId', '==', companyId));

      const querySnapshot = await getDocs(storesQuery);
      
      const stores = querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        const store: Store = {
          id: doc.id,
          companyId: data.companyId || '',
          storeName: data.storeName || '',
          storeType: data.storeType || '',
          storeCode: data.storeCode || '',
          invoiceType: data.invoiceType || '',
          branchName: data.branchName || '',
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          uid: data.uid || '',
          status: data.status || 'inactive',
          createdAt: toDateValue(data.createdAt) || new Date(),
          updatedAt: toDateValue(data.updatedAt) || new Date(),
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
          // Effective subscription end date (synced from subscriptions collection)
          subscriptionEndDate: toDateValue(data.subscriptionEndDate) || (data.subscriptionEndDate || undefined),
          promoUsage: data.promoUsage || undefined,
          subscriptionPopupShown: data.subscriptionPopupShown || false
        };
        
        return store;
      });
      
      this.storesSignal.set(stores);
      this.loadTimestamp = Date.now();
      // Persist snapshot to IndexedDB for offline use
      try {
        await this.indexedDb.saveSetting(`stores_${companyId}`, stores);
      } catch (e) {
        console.warn('Failed to persist stores snapshot to IndexedDB:', e);
      }
      
      
    } catch (error: any) {
      console.error('❌ Error loading stores by company:', error);
      // If it's a permission error, attempt to refresh the auth token and retry once
      const isPermissionDenied = String(error?.message || '').toLowerCase().includes('missing or insufficient permissions') || String(error?.code || '').toLowerCase().includes('permission');
      if (isPermissionDenied) {
        try {
          console.warn('Permission denied when loading stores - attempting token refresh and retry');
          await this.authService.getFirebaseIdToken(true);
          try {
            const currentUser = this.authService.getCurrentUser();
            console.warn('🔍 Store load diagnostics - current user uid:', currentUser?.uid || null);
            const token = await this.authService.getFirebaseIdToken();
            console.warn('🔍 Store load diagnostics - idToken present:', !!token, 'length:', token?.length || 0);
          } catch (diagErr) {
            console.warn('🔍 Store load diagnostics failed:', diagErr);
          }
          // retry the query once
          const storesRefRetry = collection(this.firestore, 'stores');
          const storesQueryRetry = query(storesRefRetry, where('companyId', '==', companyId));
          const querySnapshotRetry = await getDocs(storesQueryRetry);
          const stores = querySnapshotRetry.docs.map(doc => {
            const data = doc.data() as any;
            const store: Store = {
              id: doc.id,
              companyId: data.companyId || '',
              storeName: data.storeName || '',
              storeType: data.storeType || '',
              storeCode: data.storeCode || '',
              invoiceType: data.invoiceType || '',
              branchName: data.branchName || '',
              address: data.address || '',
              phoneNumber: data.phoneNumber || '',
              email: data.email || '',
              uid: data.uid || '',
              status: data.status || 'inactive',
              createdAt: toDateValue(data.createdAt) || new Date(),
              updatedAt: toDateValue(data.updatedAt) || new Date(),
              logoUrl: data.logoUrl || '',
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
              subscriptionEndDate: toDateValue(data.subscriptionEndDate) || (data.subscriptionEndDate || undefined),
              promoUsage: data.promoUsage || undefined,
              subscriptionPopupShown: data.subscriptionPopupShown || false
            };
            return store;
          });

          this.storesSignal.set(stores);
          this.loadTimestamp = Date.now();
          try {
            await this.indexedDb.saveSetting(`stores_${companyId}`, stores);
          } catch (e) {
            console.warn('Failed to persist stores snapshot to IndexedDB after retry:', e);
          }
          return;
        } catch (retryErr) {
          console.warn('Retry after token refresh failed for loading stores by company:', retryErr);
        }
      }
      // Offline fallback: try to read saved snapshot
      try {
        const saved = await this.indexedDb.getSetting(`stores_${companyId}`);
        if (saved && Array.isArray(saved)) {
          const normalized = saved.map((s: any) => ({
            ...s,
            createdAt: toDateValue(s.createdAt) || (s.createdAt || new Date()),
            updatedAt: toDateValue(s.updatedAt) || (s.updatedAt || new Date()),
            subscriptionEndDate: toDateValue(s.subscriptionEndDate) || (s.subscriptionEndDate || undefined)
          }));
          this.storesSignal.set(normalized);
          return;
        }
      } catch (e) {
        console.warn('Failed to read stores snapshot from IndexedDB:', e);
      }
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async createStore(store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      // Optionally generate an auto store code (disabled by default via feature flag)
      let storeCode: string | undefined = undefined;
      if (FEATURE_FLAGS.AUTO_STORE_CODE) {
        try {
          storeCode = await this.generateStoreCode();
        } catch (e) {
          console.warn('⚠️ Failed to generate store code, continuing without it:', e);
        }
      }

      const newStore: Omit<Store, 'id'> = {
        ...store,
        ...(storeCode ? { storeCode } : {}),
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
      
      // 🔄 Update current user's data: set creator role, link company/store, and set current selections
      const user = this.authService.getCurrentUser();
      if (user) {
        const permissions = Array.isArray(user.permissions) ? [...user.permissions] : [];
        const idx = permissions.findIndex(p => p.companyId === store.companyId);
        if (idx >= 0) {
          permissions[idx] = { ...permissions[idx], roleId: 'creator', storeId: documentId };
        } else {
          permissions.push({ companyId: store.companyId, storeId: documentId, roleId: 'creator' });
        }

        try {
          await this.authService.updateUserData({
            permissions,
            currentCompanyId: store.companyId,
            // currentStoreId is used by the app session; include it alongside permissions
            // @ts-ignore - allow field even if not in strict interface
            currentStoreId: documentId as any,
            roleId: 'creator'
          } as any);
        } catch (e) {
          console.warn('⚠️ Failed to update user to creator with new store context:', e);
        }

        // Also write userRoles entry for this store to make role checks pass everywhere
        try {
          const userRole = {
            companyId: store.companyId,
            storeId: documentId,
            userId: user.uid,
            roleId: 'creator',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await this.offlineDocService.createDocument('userRoles', userRole);
        } catch (e) {
          console.warn('⚠️ Failed to create userRoles entry for creator:', e);
        }
      }

      return documentId;
    } catch (error) {
      console.error('Error creating store:', error);
      throw error;
    }
  }

  async updateStore(storeId: string, updates: Partial<Store>) {
    try {
      const storeRef = doc(this.firestore, 'stores', storeId);
      
      const rawUpdate = {
        ...updates,
        updatedAt: new Date()
      } as any;

      // Normalize any date-like fields in the update before persisting and applying to signal
      const updateData = await this.firestoreSecurityService.addUpdateSecurityFields(rawUpdate);
      if (updateData.subscriptionEndDate !== undefined) {
        updateData.subscriptionEndDate = toDateValue(updateData.subscriptionEndDate) || updateData.subscriptionEndDate;
      }

      await this.offlineDocService.updateDocument('stores', storeId, updateData);

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
  await this.offlineDocService.deleteDocument('stores', storeId);

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
   * Generate random invoice number (new approach - no sequential)
   * Format: INV-YYMM-XXXXXX (where XXXXXX is random 6-digit number)
   */
  generateRandomInvoiceNo(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(100000 + Math.random() * 900000); // 6-digit random
    return `INV-${yy}${mm}-${random}`;
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
   * Generate next invoice number (legacy sequential approach - kept for backward compatibility)
   * @deprecated Use generateRandomInvoiceNo() instead
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
      }
    } catch (error) {
      console.error('❌ Error initializing temp invoice number:', error);
      throw error;
    }
  }

  // Debug method to check store status
  debugStoreStatus() {
  const stores = this.getStores();
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
      

      const storeRef = doc(this.firestore, 'stores', storeId);
      await this.offlineDocService.updateDocument('stores', storeId, {
        isBirAccredited: false, // Not yet accredited until approved
        birAccreditationStatus: 'pending',
        birAccreditationSubmittedAt: new Date(),
        'birDetails.tinNumber': birData.tinNumber,
        'birDetails.businessName': birData.businessName,
        'birDetails.address': birData.address,
        updatedAt: new Date()
      });

      
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
  await this.offlineDocService.updateDocument('stores', storeId, updateData);

      
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
          storeType: data.storeType || '',
          branchName: data.branchName || '',
          address: data.address || '',
          phoneNumber: data.phoneNumber || '',
          email: data.email || '',
          uid: data.uid || '',
          status: data.status || 'inactive',
          createdAt: toDateValue(data.createdAt) || new Date(),
          updatedAt: toDateValue(data.updatedAt) || new Date(),
          logoUrl: data.logoUrl || '',
          isBirAccredited: data.isBirAccredited || false,
          birAccreditationStatus: data.birAccreditationStatus,
          birAccreditationSubmittedAt: toDateValue(data.birAccreditationSubmittedAt),
          birAccreditationApprovedAt: toDateValue(data.birAccreditationApprovedAt),
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
          subscriptionEndDate: toDateValue(data.subscriptionEndDate) || (data.subscriptionEndDate || undefined),
          subscriptionPopupShown: data.subscriptionPopupShown || false,
          tempInvoiceNumber: data.tempInvoiceNumber
        };
        return store;
      });

      
      return stores;
    } catch (error) {
      console.error('❌ Error loading pending BIR stores:', error);
      throw error;
    }
  }
async generateStoreCode(): Promise<string> {
  const MAX_ATTEMPTS = 5;
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;

    // 1) Generate a unique base using epoch time + random suffix
    const epoch = Date.now().toString(36).toUpperCase(); // e.g., 'L5Z3K8'
    const rand = Math.floor(Math.random() * 1296).toString(36).toUpperCase(); // 2-char random (36^2 = 1296)
    const candidate = (epoch + rand).slice(-6); // total length = 6

    // 2) Ensure uniqueness in 'stores' collection
    const isUnique = await this.isStoreCodeUnique(candidate);
    if (isUnique) {
      return candidate;
    }

    console.warn(`🔁 Collision on storeCode ${candidate}, retrying (attempt ${attempt}/${MAX_ATTEMPTS})`);
  }

  throw new Error('Unable to generate a unique store code after multiple attempts');
}

  private async isStoreCodeUnique(code: string): Promise<boolean> {
    const storesRef = collection(this.firestore, 'stores');
    const q = query(storesRef, where('storeCode', '==', code));
    const snap = await getDocs(q);
    return snap.empty;
  }
}
