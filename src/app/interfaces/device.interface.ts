export interface Device {
  id?: string;
  uid: string; // User ID for security rules
  companyId: string;
  storeId: string;
  
  // Device Identification
  deviceLabel: string;
  terminalId: string;
  
  // Invoice Series Management
  invoicePrefix: string;
  invoiceSeriesStart: number;
  invoiceSeriesEnd: number;
  currentInvoiceNumber: number;
  
  // BIR Compliance
  serialNumber: string;
  minNumber: string;
  birPermitNo: string;
  atpOrOcn: string;
  permitDateIssued: Date;
  vatRegistrationType: 'VAT-registered' | 'Non-VAT' | 'VAT-exempt';
  vatRate: number;
  receiptType: string;
  validityNotice: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
  
  // Optional fields for device management
  status?: 'pending' | 'active' | 'inactive' | 'maintenance';
  lastUsedAt?: Date;
  isOnline?: boolean;
  
  // BIR Approval tracking
  isLocked?: boolean; // True after admin approval - prevents editing
  approvedBy?: string; // Admin UID who approved
  approvedAt?: Date;
}

export type VatRegistrationType = 'VAT-registered' | 'Non-VAT' | 'VAT-exempt';

export interface DeviceInvoiceSeries {
  prefix: string;
  start: number;
  end: number;
  current: number;
}
