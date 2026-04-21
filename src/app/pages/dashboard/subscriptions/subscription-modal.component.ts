import { Component, OnInit, signal, computed, inject, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_FEATURES, validatePromoCode, calculateFinalAmount } from '../../../shared/config/subscription-plans.config';
import { Store } from '../../../interfaces/store.interface';
import { SubscriptionRequest } from '../../../interfaces/subscription-request.interface';
import { CompanyService } from '../../../services/company.service';
import { AuthService } from '../../../services/auth.service';
import { SubscriptionService } from '../../../services/subscription.service';
import { CouponService } from '../../../services/coupon.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-subscription-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-modal.component.html',
  styleUrls: ['./subscription-modal.component.css']
})
export class SubscriptionModalComponent implements OnInit {
  private firestore = inject(Firestore);
  private companyService = inject(CompanyService);
  private authService = inject(AuthService);
  private subscriptionService = inject(SubscriptionService);
  private couponService = inject(CouponService);
  private toastService = inject(ToastService);

  @Input() store?: Store; // If provided, this is an upgrade/renewal
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() subscriptionSubmitted = new EventEmitter<{
    tier: 'freemium' | 'basic' | 'standard' | 'premium';
    billingCycle: 'monthly' | 'quarterly' | 'yearly';
    promoCode?: string;
    referralCode?: string;
    discountPercent: number;
    amountPaid: number;
    finalAmount: number;
    paymentMethod: 'gcash' | 'paymaya' | 'bank_transfer' | 'credit_card';
  }>();

  // Notify parent to open centralized upgrade modal (passes selected plan & billing info)
  @Output() openUpgrade = new EventEmitter<{
    tier: 'freemium' | 'basic' | 'standard' | 'premium';
    billingCycle: 'monthly' | 'quarterly' | 'yearly';
    promoCode?: string;
    referralCode?: string;
    durationMonths: number;
    basePrice: number;
  }>();

  plans = SUBSCRIPTION_PLANS;
  features = SUBSCRIPTION_FEATURES;

  selectedTier = signal<'freemium' | 'basic' | 'standard' | 'premium'>('basic');
  billingCycle = signal<'monthly' | 'quarterly' | 'yearly'>('monthly');
  promoCode = signal('');
  referralCode = signal('');
  
  promoValid = signal(false);
  promoDiscount = signal(0);
  promoMessage = signal('');
  promoChecking = signal(false);
  couponIsFree = signal(false);
  
  showFeatures = signal(true);
  showPaymentForm = signal(false);
  showEnterpriseRequest = signal(false);

  // Enterprise request form
  enterpriseNotes = signal('');

  // Payment form
  paymentMethod = signal<'gcash' | 'paymaya' | 'bank_transfer' | 'credit_card'>('gcash');
  accountNumber = signal('');
  accountName = signal('');

  // Computed
  selectedPlan = computed(() => 
    this.plans.find(p => p.tier === this.selectedTier())
  );

  basePrice = computed(() => {
    const plan = this.selectedPlan();
    if (!plan || plan.price === null) return 0;
    return plan.price;
  });

  durationMonths = computed(() => {
    const cycle = this.billingCycle();
    return cycle === 'quarterly' ? 3 : cycle === 'yearly' ? 12 : 1;
  });

  totalBeforeDiscount = computed(() => {
    return this.basePrice() * this.durationMonths();
  });

  totalDiscount = computed(() => {
    return this.promoValid() ? this.promoDiscount() : 0;
  });

  finalAmount = computed(() => {
    return calculateFinalAmount(
      this.basePrice(),
      this.totalDiscount(),
      this.durationMonths()
    );
  });

  savings = computed(() => {
    return this.totalBeforeDiscount() - this.finalAmount();
  });

  // Enterprise request computed values
  currentCompanyName = computed(() => this.companyService.companies()[0]?.name || 'N/A');
  currentUserEmail = computed(() => this.authService.getCurrentUser()?.email || 'N/A');
  currentCompanyPhone = computed(() => this.store?.phoneNumber || 'Not provided');
  currentDate = computed(() => new Date().toLocaleDateString());

  async ngOnInit() {
    // If upgrading existing store, pre-select their current tier + 1 using latest subscription
    if (this.store?.id) {
      try {
        const permission = this.authService.getCurrentPermission();
        if (permission?.companyId) {
          const latest = await this.subscriptionService.getSubscriptionForStore(permission.companyId, this.store.id);
          const currentTier = (latest?.data?.planType as any) || 'freemium';
          if (currentTier === 'freemium') {
            this.selectedTier.set('standard');
          } else if (currentTier === 'standard') {
            this.selectedTier.set('premium');
          }
        }
      } catch {}
    }
  }

  selectTier(tier: 'freemium' | 'basic' | 'standard' | 'premium') {
    this.selectedTier.set(tier);
    
    // If premium selected, show request form instead of payment
    if (tier === 'premium') {
      this.showEnterpriseRequest.set(true);
      this.showPaymentForm.set(false);
    } else {
      this.showEnterpriseRequest.set(false);
    }
  }

  selectBillingCycle(cycle: 'monthly' | 'quarterly' | 'yearly') {
    this.billingCycle.set(cycle);
  }

  async applyPromoCode() {
    const code = this.promoCode().trim();
    if (!code) {
      this.promoValid.set(false);
      this.promoMessage.set('');
      this.couponIsFree.set(false);
      return;
    }

    this.promoChecking.set(true);
    this.promoValid.set(false);
    this.promoMessage.set('');
    this.couponIsFree.set(false);

    try {
      const coupon = await this.couponService.getCoupon(code);

      if (!coupon) {
        this.promoValid.set(false);
        this.promoMessage.set('Invalid promo code.');
        this.toastService.error('Invalid promo code.');
        return;
      }

      const company = this.companyService.companies()[0];
      const region = 'PH';
      const isNewUser = !company;
      const error = this.couponService.validateCoupon(coupon, region, isNewUser);

      if (error) {
        this.promoValid.set(false);
        this.promoMessage.set(error);
        this.toastService.error(error);
        return;
      }

      // Coupon is valid
      this.promoValid.set(true);
      const isFree = coupon.appliesTo?.plan === 'monthly' && coupon.durationDays > 0;
      this.couponIsFree.set(isFree);

      if (isFree) {
        this.promoMessage.set(`✓ Coupon valid! ${coupon.description} — ${coupon.durationDays} days free, no payment required.`);
        this.toastService.success(`Coupon applied! ${coupon.description}`);
      } else {
        // Fall back to local discount logic for non-free coupons
        const result = validatePromoCode(code);
        this.promoDiscount.set(result.discount);
        this.promoMessage.set(`✓ ${result.description}`);
        this.toastService.success(result.description);
      }
    } catch (err) {
      this.promoValid.set(false);
      this.promoMessage.set('Failed to validate promo code. Please try again.');
      this.toastService.error('Failed to validate promo code.');
    } finally {
      this.promoChecking.set(false);
    }
  }

  toggleShowFeatures() {
    this.showFeatures.update(v => !v);
  }

  isSubmittingCoupon = signal(false);

  async proceedToPayment() {
    // If a free coupon is applied, bypass payment entirely
    if (this.couponIsFree() && this.promoValid()) {
      await this.activateWithFreeCoupon();
      return;
    }

    // Premium tier shows request form instead
    if (this.selectedTier() === 'premium') {
      this.showEnterpriseRequest.set(true);
      this.showPaymentForm.set(false);
    } else {
      // Emit an event so the parent can open the centralized upgrade modal
      this.openUpgrade.emit({
        tier: this.selectedTier(),
        billingCycle: this.billingCycle(),
        promoCode: this.promoCode() || undefined,
        referralCode: this.referralCode() || undefined,
        durationMonths: this.durationMonths(),
        basePrice: this.basePrice(),
      });
    }
  }

  async activateWithFreeCoupon() {
    const company = this.companyService.companies()[0];
    if (!company || !company.id) {
      this.toastService.error('No company found. Please complete your profile first.');
      return;
    }

    const storeId = this.store?.id || '';

    this.isSubmittingCoupon.set(true);
    try {
      const result = await this.couponService.applyCouponSubscription(
        this.promoCode().trim(),
        company.id,
        storeId,
        'PH',
        true
      );

      if (result.success) {
        this.toastService.success(result.message);
        this.closeModal.emit();
      } else {
        this.toastService.error(result.message);
      }
    } catch (err: any) {
      this.toastService.error(err?.message || 'Failed to activate coupon subscription.');
    } finally {
      this.isSubmittingCoupon.set(false);
    }
  }

  backToPlans() {
    this.showPaymentForm.set(false);
    this.showEnterpriseRequest.set(false);
  }

  async submitEnterpriseRequest() {
    const notes = this.enterpriseNotes().trim();
    if (!notes) {
      alert('Please provide details about your enterprise needs');
      return;
    }

    try {
      const company = this.companyService.companies()[0];
      const user = this.authService.getCurrentUser();
      const permission = this.authService.getCurrentPermission();

      if (!company || !user || !permission) {
        alert('Unable to submit request. Please try again.');
        return;
      }

      const requestData: Omit<SubscriptionRequest, 'id'> = {
        companyId: permission.companyId,
        companyName: company.name,
        ownerEmail: user.email || '',
        contactPhone: this.store?.phoneNumber || '',
        requestedAt: new Date(),
        requestedTier: 'premium',
        notes: notes,
        status: 'pending'
      };

      const requestsRef = collection(this.firestore, 'subscriptionRequests');
      await addDoc(requestsRef, requestData);

      alert('🎉 Enterprise request submitted successfully!\n\nOur team will review your request and contact you within 24 hours.');
      this.close();
    } catch (error) {
      console.error('Error submitting enterprise request:', error);
      alert('Failed to submit request. Please try again.');
    }
  }

  submitSubscription() {
    if (this.selectedTier() === 'freemium') {
      // Freemium doesn't require payment
      this.emitSubscription();
      return;
    }

    // Validate payment form
    if (!this.accountNumber() || !this.accountName()) {
      alert('Please fill in all payment details');
      return;
    }

    this.emitSubscription();
  }

  emitSubscription() {
    this.subscriptionSubmitted.emit({
      tier: this.selectedTier(),
      billingCycle: this.billingCycle(),
      promoCode: this.promoCode() || undefined,
      referralCode: this.referralCode() || undefined,
      discountPercent: this.totalDiscount(),
      amountPaid: this.basePrice(),
      finalAmount: this.finalAmount(),
      paymentMethod: this.paymentMethod()
    });
    this.close();
  }

  close() {
    this.closeModal.emit();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  getFeatureValue(tier: 'freemium' | 'standard' | 'premium', feature: any): string | boolean {
    return feature[tier];
  }

  isBoolean(value: any): boolean {
    return typeof value === 'boolean';
  }
}
