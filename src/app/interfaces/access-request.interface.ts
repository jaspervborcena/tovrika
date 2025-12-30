export interface AccessRequest {
  id?: string;
  createdAt: Date;
  createdBy: string;
  email: string;
  requestedRole: string;
  status: 'pending' | 'approved' | 'rejected';
  storeCode: string;
  uid: string;
  updatedAt: Date;
  updatedBy: string;
  storeId?: string; // Store ID resolved from storeCode
}
