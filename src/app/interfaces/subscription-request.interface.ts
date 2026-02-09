export interface SubscriptionRequest {
  id?: string;
  companyId: string;
  companyName: string;
  storeId?: string;            // Store requesting upgrade
  storeName?: string;          // Store name
  storeCode?: string;          // Store code
  uid?: string;                // User who submitted the request
  ownerEmail: string;
  contactPhone: string;
  requestedAt: Date;
  requestedTier: 'freemium' | 'basic' | 'standard' | 'premium';
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'closed';
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  // Subscription details (used when creating subscription on approval)
  subscriptionId?: string;     // Link to created subscription (set after approval)
  durationMonths?: number;     // Subscription duration
  proposedStartDate?: Date;    // Proposed start date
  proposedEndDate?: Date;      // Proposed end date
  // Payment details
  paymentMethod?: string;      // Payment method used
  paymentReference?: string;   // Payment reference number
  amountPaid?: number;         // Amount paid
  currency?: string;           // Currency
  paymentReceiptUrl?: string;  // Receipt screenshot URL
  payerMobile?: string;        // Payer mobile number
  payerName?: string;          // Payer name
  paymentDescription?: string; // Payment description
  // Promo codes
  promoCode?: string | null;   // Promo code used
  referralCode?: string | null;// Referral code used
}
