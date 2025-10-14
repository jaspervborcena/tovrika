export interface Company {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string;
  email?: string;
  website?: string;
  ownerUid: string;
  createdAt: Date;
  updatedAt?: Date;
  
  // Optional settings (for legacy compatibility)
  settings?: {
    currency?: string;
    timezone?: string;
  };
  
  // UI state (optional) - for displaying nested data
  stores?: any[]; // Import from store.interface.ts when needed
}


export interface StoreSettings {
  currency: string;
  timezone: string;
  taxRate: number;
  enableInventoryTracking: boolean;
  enableCustomerView: boolean;
  receiptSettings: ReceiptSettings;
}

export interface CompanySettings {
  currency: string;
  timezone: string;
  enableMultiStore: boolean;
  defaultBusinessType: BusinessType;
}

export interface ReceiptSettings {
  header: string;
  footer: string;
  showTax: boolean;
  showDiscount: boolean;
  printerSettings?: {
    printerName: string;
    paperSize: 'A4' | '80mm' | '58mm';
  };
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
