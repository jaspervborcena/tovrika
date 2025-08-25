export interface Branch {
  id?: string;
  companyId: string;
  storeId: string;
  branchName: string;
  address: string;
  createdAt: Date;
}

export interface Store {
  id?: string;
  companyId: string;
  storeName: string;
  address: string;
  createdAt: Date;
  isExpanded?: boolean;
  branches?: Branch[];
}

export interface Company {
  id?: string;
  name: string;
  slug: string;
  ownerUid: string;
  plan: string;
  address?: string;
  logoUrl?: string;
  settings?: {
    currency: string;
    timezone: string;
  };
  createdAt: Date;
  updatedAt?: Date;
  stores?: Store[];
}
