import { BusinessType } from './company.interface';

export interface Branch {
  id: string;
  companyId: string;
  storeId: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  businessType: BusinessType;
  isActive: boolean;
  settings: BranchSettings;
  assignedUsers: string[]; // User IDs who can access this branch
  createdAt: Date;
  updatedAt: Date;
}

export interface BranchSettings {
  operatingHours: OperatingHours[];
  contactInfo: {
    phone?: string;
    email?: string;
  };
  posSettings: {
    enableCustomerDisplay: boolean;
    requireSignature: boolean;
    allowDiscounts: boolean;
    maxDiscountPercent: number;
  };
}

export interface OperatingHours {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  isOpen: boolean;
  openTime: string; // HH:mm format
  closeTime: string; // HH:mm format
}
