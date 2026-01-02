export interface SubscriptionRequest {
  id?: string;
  companyId: string;
  companyName: string;
  ownerEmail: string;
  contactPhone: string;
  requestedAt: Date;
  requestedTier: 'freemium' | 'standard' | 'premium' | 'enterprise';
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'closed';
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  // New fields for upgrade requests
  subscriptionId?: string;     // Link to subscription document
  durationMonths?: number;     // Subscription duration
  paymentMethod?: string;      // Payment method used
  paymentReference?: string;   // Payment reference number
  amountPaid?: number;         // Amount paid
  paymentReceiptUrl?: string;  // Receipt screenshot URL
}
