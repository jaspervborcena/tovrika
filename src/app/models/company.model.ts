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
  logoUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  ownerUid: string;
  createdAt: Date;
  updatedAt?: Date;
}
