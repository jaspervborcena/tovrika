export interface CompanyBillingHistory {
  id?: string;
  companyId: string;
  storeId: string;
  tier: 'freemium' | 'basic' | 'standard' | 'premium';
  cycle: 'monthly' | 'quarterly' | 'yearly';
  durationMonths: number;
  amount: number;
  discountPercent: number;
  finalAmount: number;
  promoCode?: string;
  referralCode?: string;
  paymentMethod: 'credit_card' | 'paypal' | 'bank_transfer' | 'gcash' | 'paymaya';
  paidAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BillingTier = 'freemium' | 'standard' | 'premium' | 'enterprise';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';
export type PaymentMethod = 'credit_card' | 'paypal' | 'bank_transfer' | 'gcash' | 'paymaya';
