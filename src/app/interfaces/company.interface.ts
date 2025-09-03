export interface Branch {
  id?: string;
  companyId: string;
  storeId: string;
  branchName: string;
  address: string;
  businessType: BusinessType;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Store {
  id?: string;
  companyId: string;
  storeName: string;
  address: string;
  businessType: BusinessType;
  isActive: boolean;
  settings: StoreSettings;
  createdAt: Date;
  updatedAt?: Date;
  isExpanded?: boolean;
  branches?: Branch[];
}

export interface Company {
  id?: string;
  name: string;
  slug: string;
  ownerUid: string;
  plan: PlanType;
  address?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  website?: string;
  
  // BIR Compliance Fields (for Philippines)
  atpOrOcn?: string; // Authority to Print or Official Control Number
  birPermitNo?: string; // BIR Permit Number
  inclusiveSerialNumber?: string; // Inclusive Serial Number Range
  tin?: string; // Tax Identification Number
  
  onboardingStatus: OnboardingStatus;
  settings?: CompanySettings;
  createdAt: Date;
  updatedAt?: Date;
  stores?: Store[];
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

export interface OnboardingStatus {
  profileCompleted: boolean;
  storesCreated: boolean;
  productsAdded: boolean;
  firstSaleCompleted: boolean;
  currentStep: OnboardingStep;
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
