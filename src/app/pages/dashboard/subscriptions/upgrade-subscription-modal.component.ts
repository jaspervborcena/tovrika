import { Component, EventEmitter, Input, Output, signal, computed, inject, OnChanges, SimpleChanges, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { SubscriptionService } from '../../../services/subscription.service';
import { StoreService } from '../../../services/store.service';
import { getPlanByTier, calculateFinalAmount, calculateExpiryDate } from '../../../shared/config/subscription-plans.config';
import { CompanyService } from '../../../services/company.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SubscriptionRequest } from '../../../interfaces/subscription-request.interface';
import { OfflineDocumentService } from '../../../core/services/offline-document.service';
import { PaypalService } from '../../../services/paypal.service';
import { environment } from '../../../../environments/environment';

type Tier = 'basic' | 'standard' | 'premium';
type PaymentMethod = 'credit_card';

@Component({
  selector: 'app-upgrade-subscription-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upgrade-subscription-modal.component.html',
  styleUrls: ['./upgrade-subscription-modal.component.css']
})
export class UpgradeSubscriptionModalComponent implements OnChanges, AfterViewChecked {
  private readonly auth = inject(AuthService);
  private readonly subs = inject(SubscriptionService);
  private readonly storeService = inject(StoreService);
  private readonly companyService = inject(CompanyService);
  private readonly toast = inject(ToastService);
  private readonly firestore = inject(Firestore);
  private readonly offlineDocService = inject(OfflineDocumentService);
  private readonly paypalService = inject(PaypalService);

  @Input() isOpen = false;
  @Input() companyId = '';
  @Input() storeId = '';
  @Input() storeName = '';
  @Input() storeCode?: string;
  @Input() companyName?: string;
  // Optional initial values when opened from another modal (e.g., plan chooser)
  @Input() initialTier?: 'basic' | 'standard' | 'premium';
  @Input() initialDurationMonths?: number;
  @Input() initialPromoCode?: string;
  @Input() initialReferralCode?: string;

  @Output() closeModal = new EventEmitter<void>();
  @Output() completed = new EventEmitter<void>();

  // UI State
  activeTab: PaymentMethod = 'credit_card';
  paypalStatus = signal<'success' | 'error' | ''>('');
  private paypalSdkLoaded = false;
  private paypalButtonsInitializing = false;
  private paypalClientId: string | null = environment.paypal.clientId || null;
  private paypalSandbox = environment.paypal.sandbox;
  private readonly paypalCountryCode = 'PH';
  private readonly paypalLocale = 'en_PH';
  selectedTier = signal<Tier>('basic');
  durationMonths = signal(1);
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
  // QR preview state
  qrPreviewOpen = signal(false);
  qrPreviewUrl = signal<string>('');

  // Display account information for the active payment method
  readonly accountInfo = {
    credit_card: {
      numberLabel: 'Credit / Debit Card via PayPal',
      numberValue: 'Use the PayPal button',
      nameLabel: 'Payment Processor',
      nameValue: 'PayPal',
      qrUrl: ''
    },
  } as const;

  resolvedCompanyName = signal<string>('');

  planPrice = computed(() => {
    const plan = getPlanByTier(this.selectedTier());
    return plan?.price ?? 0;
  });

  finalAmount = computed(() => {
    const base = this.planPrice() || 0;
    const discount = 0; // expand later with promo
    return calculateFinalAmount(base, discount, this.durationMonths());
  });

  onTabChange(tab: PaymentMethod) {
    this.activeTab = tab;
    setTimeout(() => this.initPayPalButtons(), 100);
  }

  private async loadPayPalSdk(): Promise<void> {
    if (this.paypalSdkLoaded || (window as any)['paypal']) {
      this.paypalSdkLoaded = true;
      return;
    }

    try {
      const config = await this.paypalService.getClientConfig();
      this.paypalClientId = config.clientId || config.client_id || this.paypalClientId;
      if (typeof config.sandbox === 'boolean') {
        this.paypalSandbox = config.sandbox;
      }
      if (config.currency) {
        this.currency = config.currency;
      }
    } catch (err) {
      console.warn('Falling back to environment PayPal config:', err);
    }

    if (!this.paypalClientId) {
      throw new Error('Missing PayPal client configuration');
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const sandboxFlags = this.paypalSandbox ? `&debug=false&buyer-country=${this.paypalCountryCode}` : '';
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.paypalClientId}&currency=${this.currency}&intent=capture&locale=${this.paypalLocale}${sandboxFlags}`;
      script.onload = () => { this.paypalSdkLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
      document.head.appendChild(script);
    });
  }

  private async initPayPalButtons(): Promise<void> {
    if (this.paypalButtonsInitializing) return;
    this.paypalButtonsInitializing = true;

    try {
      await this.loadPayPalSdk();
      const container = document.getElementById('paypal-button-container');
      if (!container) return;
      if (container.childElementCount > 0) return;

      const paypal = (window as any)['paypal'];
      if (!paypal?.Buttons) {
        throw new Error('PayPal SDK did not load correctly');
      }

      const buttons = paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
        // Prefer the secured Cloud Function, but fall back to the PayPal SDK if the API is unavailable
        createOrder: async (_data: any, actions: any) => {
          const amount = Number((this.amountPaid ?? this.finalAmount()).toFixed(2));
          const description = `${this.selectedTier().toUpperCase()} plan - ${this.durationMonths()} month(s)`;

          try {
            const created = await this.paypalService.createOrder(amount, this.currency, description);
            const orderId = created?.id || created?.orderID || created?.orderId;
            if (!orderId) {
              throw new Error('PayPal order ID was not returned by the API');
            }
            return orderId;
          } catch (apiErr) {
            console.warn('PayPal createOrder API failed, falling back to SDK:', apiErr);
            return actions.order.create({
              intent: 'CAPTURE',
              application_context: {
                shipping_preference: 'NO_SHIPPING',
                user_action: 'PAY_NOW',
                locale: this.paypalLocale.replace('_', '-')
              },
              purchase_units: [{
                amount: { currency_code: this.currency, value: amount.toFixed(2) },
                description
              }]
            });
          }
        },
        // Prefer backend capture, but fall back to SDK capture if needed
        onApprove: async (data: any, actions: any) => {
          try {
            this.submitting.set(true);
            const orderId = data?.orderID || data?.orderId;
            if (!orderId) {
              throw new Error('Missing PayPal order ID');
            }

            let captured: any;
            try {
              captured = await this.paypalService.captureOrder(orderId);
            } catch (apiErr) {
              console.warn('PayPal capture API failed, falling back to SDK:', apiErr);
              captured = await actions.order.capture();
            }
            // Extract payer & transaction info from captured result
            const txId: string = captured?.id || captured?.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';
            const payer = captured?.payer;
            this.paymentReference = txId;
            this.payerName = payer?.name
              ? `${payer.name.given_name || ''} ${payer.name.surname || ''}`.trim()
              : 'PayPal Customer';
            this.payerMobile = payer?.email_address || '';
            this.amountPaid = this.finalAmount();

            const user = this.auth.getCurrentUser();
            if (!user?.uid) throw new Error('Not authenticated');

            // Immediately create an active subscription — PayPal already confirmed payment
            // Also syncs subscriptionEndDate on the store doc inside service
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + this.durationMonths());

            await this.subs.createPaidPayPal(
              this.companyId,
              this.storeId,
              user.uid,
              this.selectedTier(),
              this.durationMonths(),
              this.finalAmount(),
              txId,
              this.payerName,
              this.payerMobile
            );

            // Refresh the in-memory store signal so the UI shows the updated date immediately
            await this.storeService.updateStore(this.storeId, {
              subscriptionEndDate: endDate
            });

            // Also log the request for records (auto-approved)
            await this.createSubscriptionRequest('', this.finalAmount());

            this.paypalStatus.set('success');
            this.toast.success('Payment successful! Your subscription is now active.');
            this.completed.emit();
            this.close();
          } catch (err: any) {
            console.error('PayPal capture / save error:', err);
            this.paypalStatus.set('error');
            this.toast.error('Payment captured but failed to activate subscription: ' + (err?.message || 'unknown error'));
          } finally {
            this.submitting.set(false);
          }
        },
        onCancel: () => {
          this.paypalStatus.set('');
        },
        onError: (err: any) => {
          console.error('PayPal SDK error:', err);
          this.paypalStatus.set('error');
          this.toast.error('PayPal encountered an error. Please try again.');
        }
      });

      await buttons.render(container);
    } catch (err: any) {
      console.error('initPayPalButtons error:', err);
      this.paypalStatus.set('error');
      this.toast.error('Could not load PayPal: ' + (err?.message || 'check your connection'));
    } finally {
      this.paypalButtonsInitializing = false;
    }
  }

  ngAfterViewChecked() {
    if (!this.isOpen || this.activeTab !== 'credit_card') return;
    const container = document.getElementById('paypal-button-container');
    if (container && container.childElementCount === 0 && !this.paypalButtonsInitializing) {
      void this.initPayPalButtons();
    }
  }

  // Basic guard to enable/disable submit button (credit_card uses PayPal's own button)
  canSubmit(): boolean {
    if (this.activeTab === 'credit_card') return false;
    const hasRef = !!this.paymentReference && this.paymentReference.trim().length > 0;
    const hasPayerNo = !!this.payerMobile && this.payerMobile.trim().length > 0;
    const hasPayerName = !!this.payerName && this.payerName.trim().length > 0;
    const amount = this.amountPaid ?? this.finalAmount();
    const hasValidAmount = typeof amount === 'number' && !isNaN(amount) && amount > 0;
    const hasReceipt = !!this.receiptFile;
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
  if (this.activeTab !== 'credit_card' && (!this.paymentReference || !this.paymentReference.trim())) missing.push('Reference ID');
  if (this.activeTab !== 'credit_card' && (!this.payerMobile || !this.payerMobile.trim())) missing.push(this.activeTab === 'gcash' ? 'GCash Number' : 'Sender Account / Mobile');
  if (this.activeTab !== 'credit_card' && (!this.payerName || !this.payerName.trim())) missing.push('Payer Name');
  if (this.activeTab !== 'credit_card' && !(typeof effectiveAmount === 'number' && !isNaN(effectiveAmount) && effectiveAmount > 0)) missing.push('Amount');
  if (this.activeTab !== 'credit_card' && !this.receiptFile) missing.push('Payment Receipt');

      if (missing.length > 0) {
        this.showErrors = true;
        this.toast.error(`Please complete required fields: ${missing.join(', ')}`);
        return;
      }

      this.submitting.set(true);
      const user = this.auth.getCurrentUser();
      if (!user?.uid) throw new Error('Not authenticated');

      // Upload receipt first (if not credit card / PayPal)
      let receiptUrl = '';
      if (this.activeTab !== 'credit_card' && this.receiptFile) {
        // Create temp subscription ID for receipt upload path
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        receiptUrl = await this.subs.uploadPaymentReceipt(this.receiptFile!, {
          companyId: this.companyId,
          storeId: this.storeId,
          subscriptionId: tempId,
          paymentMethod: this.activeTab,
        });
      }

      // Create subscription request ONLY - do not create subscription yet
      // Admin will create the actual subscription when they approve the request
      await this.createSubscriptionRequest(receiptUrl, effectiveAmount);

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
   * This is the ONLY document created when user requests upgrade
   * Admin will create the actual subscription when they approve
   */
  private async createSubscriptionRequest(receiptUrl: string, amountPaid: number): Promise<void> {
    try {
      const user = this.auth.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const company = this.resolvedCompanyName() || 'Unknown Company';
      const store = await this.storeService.getStore(this.storeId);
      
      // Calculate dates for reference (admin will use these when creating subscription)
      const startDate = new Date();
      const endDate = calculateExpiryDate(this.durationMonths(), startDate);
      
      const requestData: Omit<SubscriptionRequest, 'id'> = {
        companyId: this.companyId,
        companyName: company,
        storeId: this.storeId,
        storeName: store?.storeName || this.storeName || '',
        storeCode: store?.storeCode || this.storeCode || '',
        uid: user.uid,
        ownerEmail: user.email || '',
        contactPhone: store?.phoneNumber || this.payerMobile || '',
        requestedAt: new Date(),
        requestedTier: this.selectedTier(),
        notes: `Upgrade to ${this.selectedTier().toUpperCase()} plan for ${this.durationMonths()} month(s). Payment: ${this.activeTab.toUpperCase()}`,
        // PayPal payments are auto-approved (confirmed by PayPal); others need admin review
        status: this.activeTab === 'credit_card' ? 'approved' : 'pending',
        // Subscription details (will be used when creating subscription on approval)
        durationMonths: this.durationMonths(),
        proposedStartDate: startDate,
        proposedEndDate: endDate,
        // Payment details
        paymentMethod: this.activeTab,
        paymentReference: this.paymentReference || '',
        amountPaid: amountPaid,
        currency: this.currency,
        paymentReceiptUrl: receiptUrl,
        payerMobile: this.payerMobile || '',
        payerName: this.payerName || '',
        paymentDescription: this.paymentDescription || '',
        // Promo codes
        promoCode: this.promoCode || null,
        referralCode: this.referralCode || null
      };

      const requestsRef = collection(this.firestore, 'subscriptionRequests');
      
      try {
        const docRef = await addDoc(requestsRef, requestData);
        console.log('✅ Subscription request created for admin approval:', docRef.id);
        this.toast.success('Subscription upgrade request submitted! Waiting for admin approval.');
      } catch (error) {
        console.warn('⚠️ Failed to create subscription request online, trying offline mode:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNetworkError = errorMessage.includes('timeout') || 
                              errorMessage.includes('network') || 
                              errorMessage.includes('connection') ||
                              !navigator.onLine;
        
        if (isNetworkError) {
          console.log('📱 Creating subscription request in offline mode...');
          try {
            const offlineId = await this.offlineDocService.createDocument('subscriptionRequests', requestData);
            console.log('✅ Offline subscription request created:', offlineId);
            this.toast.success('Subscription upgrade request queued offline! It will be submitted when connection is restored.');
          } catch (offlineError) {
            console.error('❌ Failed to create subscription request both online and offline:', offlineError);
            throw new Error('Failed to submit subscription request. Please check your connection and try again.');
          }
        } else {
          throw error;
        }
      }
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
    this.activeTab = 'credit_card';
    this.selectedTier.set('basic');
    this.durationMonths.set(1);
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
    this.paypalStatus.set('');
    // Clear PayPal button container on reset
    const container = document.getElementById('paypal-button-container');
    if (container) container.innerHTML = '';
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
      if (this.initialTier) this.selectedTier.set(this.initialTier);
      if (this.initialDurationMonths && this.initialDurationMonths > 0) this.durationMonths.set(this.initialDurationMonths);
      if (this.initialPromoCode !== undefined) this.promoCode = this.initialPromoCode || '';
      if (this.initialReferralCode !== undefined) this.referralCode = this.initialReferralCode || '';
      // Prefill amount with current total if empty or invalid
      const amt = this.amountPaid;
      if (!(typeof amt === 'number' && !isNaN(amt) && amt > 0)) {
        this.amountPaid = this.finalAmount();
      }

      // Card/PayPal is the only available method now; render the button automatically
      this.activeTab = 'credit_card';
      setTimeout(() => this.initPayPalButtons(), 100);
    }
  }
}
