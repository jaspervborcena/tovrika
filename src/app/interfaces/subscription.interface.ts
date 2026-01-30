export interface SubscriptionFeatures {
  maxStores: number;
  maxDevicesPerStore: number;
  maxProducts: number;
  maxUsers: number;
  transactionLimit: number;
  cloudSync: boolean;
  birCompliance: boolean;
  crmEnabled: boolean;
  loyaltyEnabled: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
}

export interface Subscription {
  id?: string;                 // Firestore document id
  subscriptionId: string;      // Unique ID for the subscription (also stored in doc)
  companyId: string;           // Company ID
  storeId: string;             // Store ID
  uid: string;                 // Owner UID

  planType: string;            // e.g., 'freemium', 'standard', 'premium'
  status: string;              // 'active', 'trial', 'expired', etc.

  startDate: Date;             // Paid subscription start
  endDate: Date;               // Paid subscription end

  trialStart?: Date | null;    // Trial start
  trialDays?: number;          // Duration of trial (days)
  isTrial?: boolean;           // Currently in trial

  promoCode?: string | null;   // Optional promo code used
  referralCode?: string | null;// Optional referral code used

  paymentMethod?: string;      // 'gcash', 'paypal', etc.
  paymentReference?: string;   // Transaction ID / GCash reference
  amountPaid?: number;         // Amount paid
  currency?: string;           // 'PHP', etc.

  paymentReceiptUrl?: string;  // Screenshot URL (GCash)

  features: SubscriptionFeatures; // Feature flags/limits

  createdAt?: Date;            // Record creation time
  updatedAt?: Date;            // Last update time
}
