export interface Store {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  phone?: string;
  email?: string;
  companyId: string;
  status: 'active' | 'inactive';
  taxRate?: number;
  invoiceNo?: string; // Invoice number format: INV-YYYY-XXXXXX
  createdAt: Date;
  updatedAt: Date;
  settings?: {
    currency: string;
    timezone: string;
    printerSettings?: {
      receiptHeader?: string;
      receiptFooter?: string;
      printerName?: string;
    };
  };
}

export interface StoreBranch {
  id: string;
  name: string;
  storeId: string;
  companyId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
