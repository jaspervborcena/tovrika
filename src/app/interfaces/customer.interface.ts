export interface Customer {
  id?: string;
  companyId: string;
  storeId: string;
  customerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  contactNumber?: string;
  address?: string;
  zipCode?: string;
  country?: string;
  tin?: string;
  isSeniorCitizen?: boolean;
  isPWD?: boolean;
  exemptionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerFormData {
  soldTo?: string;
  tin?: string;
  businessAddress?: string;
  email?: string;
  contactNumber?: string;
  exemptionId?: string;
  isSeniorCitizen?: boolean;
  isPWD?: boolean;
}
