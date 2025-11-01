import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, doc, getDocs, query, where, limit, Timestamp } from '@angular/fire/firestore';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AuthService } from './auth.service';
import { Subscription, SubscriptionFeatures } from '../interfaces/subscription.interface';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly offlineDocService = inject(OfflineDocumentService);

  private readonly collectionName = 'subscriptions';

  // Default features (can be refined per plan later)
  getDefaultFeatures(): SubscriptionFeatures {
    return {
      maxStores: 1,
      maxDevicesPerStore: 2,
      maxProducts: 1000,
      maxUsers: 5,
      transactionLimit: 10000,
      cloudSync: true,
      birCompliance: true,
      crmEnabled: false,
      loyaltyEnabled: false,
      apiAccess: false,
      whiteLabel: false,
    };
  }

  /** Create a new subscription with sane defaults */
  async createSubscription(input: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'features'> & { features?: Partial<SubscriptionFeatures> }): Promise<string> {
    const user = this.auth.getCurrentUser();
    if (!user?.uid) throw new Error('Not authenticated');

    const now = Timestamp.now();

    const features: SubscriptionFeatures = { ...this.getDefaultFeatures(), ...(input.features || {}) };

    const payload: any = {
      ...input,
      uid: input.uid || user.uid,
      features,
      startDate: input.startDate instanceof Date ? Timestamp.fromDate(input.startDate) : input.startDate,
      endDate: input.endDate instanceof Date ? Timestamp.fromDate(input.endDate) : input.endDate,
      trialStart: input.trialStart ? (input.trialStart instanceof Date ? Timestamp.fromDate(input.trialStart) : input.trialStart) : null,
      createdAt: now,
      updatedAt: now,
    };

    const colRef = collection(this.firestore, this.collectionName);
    const docRef = await addDoc(colRef, payload);
    return docRef.id;
  }

  /** Update an existing subscription by document id */
  async updateSubscription(docId: string, updates: Partial<Subscription>): Promise<void> {
    const now = Timestamp.now();
    const updatesPayload: any = { ...updates, updatedAt: now };
    if (updates.startDate instanceof Date) updatesPayload.startDate = Timestamp.fromDate(updates.startDate);
    if (updates.endDate instanceof Date) updatesPayload.endDate = Timestamp.fromDate(updates.endDate);
    if (updates.trialStart instanceof Date) updatesPayload.trialStart = Timestamp.fromDate(updates.trialStart);

  const docRef = doc(this.firestore, this.collectionName, docId);
  await this.offlineDocService.updateDocument(this.collectionName, docId, updatesPayload);
  }

  /** Get the latest subscription for a company+store (assumes one active at a time) */
  async getSubscriptionForStore(companyId: string, storeId: string): Promise<{ id: string; data: Subscription } | null> {
    const colRef = collection(this.firestore, this.collectionName);
    const qRef = query(colRef, where('companyId', '==', companyId), where('storeId', '==', storeId), limit(1));
    const snap = await getDocs(qRef);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const raw = d.data() as any;
    const toDate = (v: any) => v?.toDate?.() || v || null;
    const sub: Subscription = {
      id: d.id,
      subscriptionId: raw.subscriptionId,
      companyId: raw.companyId,
      storeId: raw.storeId,
      uid: raw.uid,
      planType: raw.planType,
      status: raw.status,
      startDate: toDate(raw.startDate),
      endDate: toDate(raw.endDate),
      trialStart: toDate(raw.trialStart),
      trialDays: raw.trialDays,
      isTrial: raw.isTrial,
      promoCode: raw.promoCode ?? null,
      referralCode: raw.referralCode ?? null,
      paymentMethod: raw.paymentMethod,
      paymentReference: raw.paymentReference,
      amountPaid: raw.amountPaid,
      currency: raw.currency,
      paymentReceiptUrl: raw.paymentReceiptUrl,
      features: raw.features as SubscriptionFeatures,
      createdAt: toDate(raw.createdAt),
      updatedAt: toDate(raw.updatedAt),
    };
    return { id: d.id, data: sub };
  }

  /** Upload a payment receipt screenshot to Firebase Storage and return the URL
   *  Path pattern aligned with product management:
   *  {storeId}/payments/{subscriptionId}/{paymentMethod_timestamp.ext}
   */
  async uploadPaymentReceipt(file: File, params: { companyId: string; storeId: string; subscriptionId: string; paymentMethod: 'gcash' | 'paymaya' | string }): Promise<string> {
    const storage = getStorage();
    const user = this.auth.getCurrentUser();
    if (!user?.uid) throw new Error('Not authenticated');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `${params.storeId}/payments/${params.subscriptionId}/${params.paymentMethod}_${ts}.${ext}`;
    const r = ref(storage, path);
    const snap = await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' });
    const url = await getDownloadURL(snap.ref);
    return url;
  }
}
