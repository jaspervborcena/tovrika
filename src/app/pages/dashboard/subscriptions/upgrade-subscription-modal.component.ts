import { Component, EventEmitter, Input, Output, signal, computed, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { SubscriptionService } from '../../../services/subscription.service';
import { BillingService } from '../../../services/billing.service';
import { StoreService } from '../../../services/store.service';
import { getPlanByTier, calculateFinalAmount, calculateExpiryDate } from '../../../shared/config/subscription-plans.config';
import { CompanyService } from '../../../services/company.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SubscriptionRequest } from '../../../interfaces/subscription-request.interface';

type Tier = 'standard' | 'premium';
type PaymentMethod = 'gcash' | 'paymaya' | 'paypal';

@Component({
  selector: 'app-upgrade-subscription-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upgrade-subscription-modal.component.html',
  styleUrls: ['./upgrade-subscription-modal.component.css']
})
export class UpgradeSubscriptionModalComponent implements OnChanges {
  private readonly auth = inject(AuthService);
  private readonly subs = inject(SubscriptionService);
  private readonly billing = inject(BillingService);
  private readonly storeService = inject(StoreService);
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);
  private readonly firestore = inject(Firestore);

  @Input() isOpen = false;
  @Input() companyId = '';
  @Input() storeId = '';
  @Input() storeName = '';
  @Input() storeCode?: string;
  @Input() companyName?: string;
  // Optional initial values when opened from another modal (e.g., plan chooser)
  @Input() initialTier?: 'standard' | 'premium';
  @Input() initialDurationMonths?: number;
  @Input() initialPromoCode?: string;
  @Input() initialReferralCode?: string;

  @Output() closeModal = new EventEmitter<void>();
  @Output() completed = new EventEmitter<void>();

  // UI State
  activeTab: PaymentMethod = 'gcash';
  selectedTier: Tier = 'standard';
  durationMonths = 1;
  promoCode = '';
  referralCode = '';
  paymentReference = '';
  amountPaid: number | null = null;
  currency = 'PHP';
  uploading = signal(false);
  submitting = signal(false);
  receiptFile: File | null = null;
  payerMobile: string = '';
  payerName: string = '';
  paymentDescription: string = '';
  // Validation state
  showErrors = false;
  // PayPal config (replace with your business handle or dynamic config)
  private paypalMeHandle = 'yourbusiness'; // TODO: set to your PayPal.Me handle
  // Card (PayPal) placeholders – do NOT store these values to Firestore
  cardName: string = '';
  cardNumber: string = '';
  cardExpiry: string = '';
  cardCvv: string = '';
  // QR preview state
  qrPreviewOpen = signal(false);
  qrPreviewUrl = signal<string>('');

  // Display account information per payment method (placeholder values)
  readonly accountInfo: Record<PaymentMethod, { numberLabel: string; numberValue: string; nameLabel: string; nameValue: string; qrUrl?: string }> = {
    gcash: {
      numberLabel: 'Account Number / Mobile Number',
      numberValue: '0917 301 ****',
      nameLabel: 'Account Name',
      nameValue: 'JA***R B.',
      qrUrl: 'assets/gcashQR.jpg'
    },
    paymaya: {
      numberLabel: 'Account Number / Mobile Number',
      numberValue: '0917 XXX XX59',
      nameLabel: 'Account Name',
      nameValue: 'JASPER BORCENA',
      qrUrl: 'assets/mayaQR.jpg'
    },
    paypal: {
      numberLabel: 'Card via PayPal',
      numberValue: 'Use the PayPal button below',
      nameLabel: 'Payment Processor',
      nameValue: 'PayPal',
      qrUrl: ''
    },
  } as const;

  resolvedCompanyName = signal<string>('');

  planPrice = computed(() => {
    const plan = getPlanByTier(this.selectedTier);
    return plan?.price ?? 0;
  });

  finalAmount = computed(() => {
    const base = this.planPrice() || 0;
    const discount = 0; // expand later with promo
    return calculateFinalAmount(base, discount, this.durationMonths);
  });

  onTabChange(tab: PaymentMethod) {
    this.activeTab = tab;
  }

  // Basic guard to enable/disable submit button
  canSubmit(): boolean {
    const hasRef = this.activeTab === 'paypal' ? true : (!!this.paymentReference && this.paymentReference.trim().length > 0);
    const hasPayerNo = this.activeTab === 'paypal' ? true : (!!this.payerMobile && this.payerMobile.trim().length > 0);
    const hasPayerName = this.activeTab === 'paypal' ? true : (!!this.payerName && this.payerName.trim().length > 0);
    const amount = this.amountPaid ?? this.finalAmount();
    const hasValidAmount = typeof amount === 'number' && !isNaN(amount) && amount > 0;
    const hasReceipt = this.activeTab === 'paypal' ? true : !!this.receiptFile;
    return hasRef && hasPayerNo && hasPayerName && hasValidAmount && hasReceipt && !!this.companyId && !!this.storeId;
  }

  // Template-safe amount validity check (avoid complex expressions in template)
  isAmountValid(): boolean {
    const amount = this.amountPaid ?? this.finalAmount();
    return typeof amount === 'number' && !isNaN(amount) && amount > 0;
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const selected = input.files[0];
      try {
        const compressed = await this.compressImage(selected, 900 * 900);
        this.receiptFile = compressed;
        this.toast.info('Receipt image compressed for upload');
      } catch (e) {
        // Fallback to original if compression fails
        this.receiptFile = selected;
        this.toast.warning('Using original image (compression failed)');
      }
    }
  }

  // Open PayPal payment page in a new tab
  openPayPal() {
    const amount = this.amountPaid ?? this.finalAmount();
    const url = this.getPaypalLink(amount || 0);
    window.open(url, '_blank', 'noopener');
  }

  private getPaypalLink(amount: number): string {
    const safeAmount = Math.max(0, Math.round(amount * 100) / 100); // 2 decimals
    // PayPal.Me format: https://www.paypal.me/<handle>/<amount>
    return `https://www.paypal.me/${this.paypalMeHandle}/${safeAmount}`;
  }

  openQrPreview() {
    const url = this.accountInfo[this.activeTab].qrUrl;
    if (!url) return;
    this.qrPreviewUrl.set(url);
    this.qrPreviewOpen.set(true);
  }

  closeQrPreview() {
    this.qrPreviewOpen.set(false);
    this.qrPreviewUrl.set('');
  }

  async submit() {
    if (this.submitting()) return;
    try {
      if (!this.companyId || !this.storeId) throw new Error('Missing company or store id');
      // Validate required fields
      const effectiveAmount = this.amountPaid ?? this.finalAmount();
      const missing: string[] = [];
  if (this.activeTab !== 'paypal' && (!this.paymentReference || !this.paymentReference.trim())) missing.push('Reference ID');
  if (this.activeTab !== 'paypal' && (!this.payerMobile || !this.payerMobile.trim())) missing.push(this.activeTab === 'gcash' ? 'GCash Number' : (this.activeTab === 'paymaya' ? 'PayMaya Number' : 'Sender Account / Mobile'));
  if (this.activeTab !== 'paypal' && (!this.payerName || !this.payerName.trim())) missing.push('Payer Name');
  if (this.activeTab !== 'paypal' && !(typeof effectiveAmount === 'number' && !isNaN(effectiveAmount) && effectiveAmount > 0)) missing.push('Amount');
  if (this.activeTab !== 'paypal' && !this.receiptFile) missing.push('Payment Receipt');

      if (missing.length > 0) {
        this.showErrors = true;
        this.toast.error(`Please complete required fields: ${missing.join(', ')}`);
        return;
      }

      this.submitting.set(true);
      const user = this.auth.getCurrentUser();
      if (!user?.uid) throw new Error('Not authenticated');

      // Build subscription payload (doc created first to get id)
      const startDate = new Date();
      const endDate = calculateExpiryDate(this.durationMonths, startDate);

      const subInput = {
        subscriptionId: '', // will set to doc id after creation
        companyId: this.companyId,
        storeId: this.storeId,
        uid: user.uid,
        planType: this.selectedTier,
        status: 'pending', // Changed from 'active' to 'pending' - requires admin approval
        startDate,
        endDate,
        trialStart: null,
        trialDays: 0,
        isTrial: false,
        promoCode: this.promoCode || null,
        referralCode: this.referralCode || null,
        paymentMethod: this.activeTab,
        paymentReference: this.paymentReference || '',
        amountPaid: effectiveAmount,
        currency: this.currency,
        paymentReceiptUrl: '',
        payerMobile: this.payerMobile || null,
        payerName: this.payerName || null,
        description: this.paymentDescription || null,
        features: this.subs.getDefaultFeatures(),
      } as any;

      const docId = await this.subs.createSubscription(subInput);

      // Upload receipt using docId as subscriptionId in path
      let url = '';
      if (this.activeTab !== 'paypal') {
        url = await this.subs.uploadPaymentReceipt(this.receiptFile!, {
          companyId: this.companyId,
          storeId: this.storeId,
          subscriptionId: docId,
          paymentMethod: this.activeTab,
        });
        // Update subscription with receipt URL and subscriptionId field
        await this.subs.updateSubscription(docId, {
          subscriptionId: docId,
          paymentReceiptUrl: url,
        } as any);
      } else {
        // For PayPal card flow, we'll later set receipt/transaction after capture
        await this.subs.updateSubscription(docId, {
          subscriptionId: docId,
          paymentReceiptUrl: '',
        } as any);
      }

      // Create subscription request for admin approval
      await this.createSubscriptionRequest(docId, url, effectiveAmount);

      // Do NOT update store subscription end date yet - wait for admin approval
      // await this.storeService.updateStore(this.storeId, { subscriptionEndDate: endDate as any });

      // Create billing history record
      await this.billing.createBillingHistory({
        companyId: this.companyId,
        storeId: this.storeId,
        tier: this.selectedTier,
        cycle: 'monthly',
        durationMonths: this.durationMonths,
        amount: this.planPrice() || 0,
        discountPercent: 0,
        finalAmount: effectiveAmount,
        promoCode: this.promoCode || '',
        referralCode: this.referralCode || '',
        paymentMethod: this.activeTab,
        transactionId: this.activeTab === 'paypal' ? '' : (this.paymentReference || ''),
        payerMobile: this.activeTab === 'paypal' ? '' : (this.payerMobile || ''),
        payerName: this.activeTab === 'paypal' ? '' : (this.payerName || ''),
        description: this.activeTab === 'paypal' ? '' : (this.paymentDescription || ''),
        paidAt: new Date(),
        createdAt: new Date(),
      } as any);

      this.completed.emit();
      this.close();
    } catch (err: any) {
      console.error('Subscription upgrade failed:', err);
      const msg = typeof err?.message === 'string' ? err.message : 'Upgrade failed';
      if (msg.includes('storage/unauthorized')) {
        this.toast.error('Upload blocked by storage security rules. Please sign in again or contact your admin.');
      } else {
        this.toast.error(msg);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Create a subscription request for admin approval
   */
  private async createSubscriptionRequest(subscriptionId: string, receiptUrl: string, amountPaid: number): Promise<void> {
    try {
      const user = this.auth.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const company = this.resolvedCompanyName() || 'Unknown Company';
      const store = await this.storeService.getStore(this.storeId);
      
      const requestData: Omit<SubscriptionRequest, 'id'> = {
        companyId: this.companyId,
        companyName: company,
        ownerEmail: user.email || '',
        contactPhone: store?.phoneNumber || this.payerMobile || '',
        requestedAt: new Date(),
        requestedTier: this.selectedTier,
        notes: `Upgrade to ${this.selectedTier.toUpperCase()} plan for ${this.durationMonths} month(s). Payment: ${this.activeTab.toUpperCase()}`,
        status: 'pending',
        // Link subscription details
        subscriptionId: subscriptionId,
        durationMonths: this.durationMonths,
        paymentMethod: this.activeTab,
        paymentReference: this.paymentReference || '',
        amountPaid: amountPaid,
        paymentReceiptUrl: receiptUrl
      };

      const requestsRef = collection(this.firestore, 'subscriptionRequests');
      await addDoc(requestsRef, requestData);

      console.log('✅ Subscription request created for admin approval:', subscriptionId);
      this.toast.success('Subscription upgrade submitted! Waiting for admin approval.');
    } catch (error) {
      console.error('❌ Failed to create subscription request:', error);
      throw error;
    }
  }

  close() {
    this.reset();
    this.closeModal.emit();
  }

  // Lightweight image compression (mirrors product management approach)
  private compressImage(file: File, maxArea: number = 800 * 800, quality: number = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      img.onload = () => {
        let { width, height } = img as HTMLImageElement & { width: number; height: number };
        const maxDim = Math.sqrt(maxArea);
        if (width > height) {
          if (width > maxDim) {
            height = height * (maxDim / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = width * (maxDim / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: mime, lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        }, mime, quality);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  private reset() {
    this.activeTab = 'gcash';
    this.selectedTier = 'standard';
    this.durationMonths = 1;
    this.promoCode = '';
    this.referralCode = '';
    this.paymentReference = '';
    this.amountPaid = null;
    this.receiptFile = null;
    this.resolvedCompanyName.set('');
    this.payerMobile = '';
    this.payerName = '';
    this.paymentDescription = '';
    this.showErrors = false;
    this.cardName = '';
    this.cardNumber = '';
    this.cardExpiry = '';
    this.cardCvv = '';
  }

  // Normalize MMYY numeric entry, clamp month between 01-12
  onCardExpiryInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let digits = (input.value || '').replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) {
      const mm = Math.min(Math.max(parseInt(digits.slice(0, 2) || '0', 10), 1), 12);
      const mmStr = mm.toString().padStart(2, '0');
      digits = mmStr + digits.slice(2);
    }
    this.cardExpiry = digits;
  }

  async ngOnChanges(changes: SimpleChanges) {
    if ((changes['isOpen'] || changes['companyId'] || changes['companyName']) && this.isOpen) {
      if (this.companyName && this.companyName.trim()) {
        this.resolvedCompanyName.set(this.companyName);
      } else if (this.companyId) {
        try {
          const company = await this.companyService.getCompanyById(this.companyId);
          this.resolvedCompanyName.set(company?.name || '');
        } catch {
          this.resolvedCompanyName.set('');
        }
      }
      // Apply initial values if provided
      if (this.initialTier) this.selectedTier = this.initialTier;
      if (this.initialDurationMonths && this.initialDurationMonths > 0) this.durationMonths = this.initialDurationMonths;
      if (this.initialPromoCode !== undefined) this.promoCode = this.initialPromoCode || '';
      if (this.initialReferralCode !== undefined) this.referralCode = this.initialReferralCode || '';
      // Prefill amount with current total if empty or invalid
      const amt = this.amountPaid;
      if (!(typeof amt === 'number' && !isNaN(amt) && amt > 0)) {
        this.amountPaid = this.finalAmount();
      }
    }
  }
}
