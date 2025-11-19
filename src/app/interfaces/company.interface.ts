export interface Company {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  ownerUid: string;
  createdAt: Date;
  updatedAt?: Date;
  plan?: PlanType;
  taxId?: string;
  
  // UI state (optional) - for displaying nested data
  stores?: any[]; // Import from store.interface.ts when needed
}
export type BusinessType = 
  | 'restaurant' 
  | 'car_wash' 
  | 'convenience_store' 
  | 'retail' 
  | 'service' 
  | 'other';

export type PlanType = 'basic' | 'pro' | 'enterprise';

export type OnboardingStep = 
  | 'company_profile' 
  | 'store_creation' 
  | 'branch_creation' 
  | 'product_setup' 
  | 'first_sale' 
  | 'completed';
