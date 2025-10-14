export interface Store {
  id?: string;
  storeName: string;
  storeType: string;
  branchName: string;
  address: string;
  phoneNumber: string;
  email: string;
  companyId: string;
  uid: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt?: Date;
  logoUrl?: string;
  
  // BIR Compliance
  isBirAccredited: boolean;
  birAccreditationStatus?: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  birAccreditationSubmittedAt?: Date;
  birAccreditationApprovedAt?: Date;
  birAccreditationRejectedReason?: string;
  tempInvoiceNumber?: string;
  birDetails: BirDetails;
  tinNumber: string;
  
  // Subscription
  subscription: Subscription;
  promoUsage?: PromoUsage;
  subscriptionPopupShown: boolean;
  
  // UI state (optional) - for displaying nested data
  isExpanded?: boolean;
  branches?: any[]; // Import from branch.interface.ts when needed
}

export interface BirDetails {
  birPermitNo: string;
  atpOrOcn: string;
  inclusiveSerialNumber: string;
  serialNumber: string;
  minNumber: string;
  invoiceType: string;
  invoiceNumber: string;
  permitDateIssued: Date;
  validityNotice: string;
}

export interface Subscription {
  tier: 'freemium' | 'standard' | 'premium' | 'enterprise';
  status: 'active' | 'inactive' | 'expired' | 'cancelled';
  subscribedAt: Date;
  expiresAt: Date;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  durationMonths: number;
  amountPaid: number;
  discountPercent: number;
  finalAmount: number;
  promoCode?: string;
  referralCodeUsed?: string;
  paymentMethod: 'credit_card' | 'paypal' | 'bank_transfer' | 'gcash' | 'paymaya';
  lastPaymentDate: Date;
}

export interface PromoUsage {
  promoCodeApplied?: string;
  referralCodeUsed?: string;
  discountPercent: number;
}

