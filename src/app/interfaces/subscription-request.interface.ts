export interface SubscriptionRequest {
  id?: string;
  companyId: string;
  companyName: string;
  ownerEmail: string;
  contactPhone: string;
  requestedAt: Date;
  requestedTier: 'enterprise';
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}
