export interface NotificationData {
  id?: string;
  
  // Core notification data
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  category: NotificationCategory;
  
  // Recipients
  recipientType: 'user' | 'role' | 'store' | 'company' | 'system';
  recipientId?: string; // userId, roleId, storeId, companyId, or null for system-wide
  
  // Context information
  companyId: string;
  storeId?: string; // Optional, for store-specific notifications
  
  // Metadata
  createdAt: Date;
  createdBy?: string; // User ID who triggered the notification
  
  // Status
  read: boolean;
  readAt?: Date;
  priority: NotificationPriority;
  
  // Action data (optional)
  actionType?: NotificationActionType;
  actionData?: {
    entityId?: string; // ID of related entity (userId, productId, etc.)
    entityType?: string; // 'user', 'product', 'order', etc.
    url?: string; // Deep link to relevant page
    buttonText?: string; // Custom action button text
  };
  
  // Expiry (optional)
  expiresAt?: Date;
  
  // Email notification (optional)
  sendEmail?: boolean;
  emailSent?: boolean;
  emailSentAt?: Date;
}

export enum NotificationCategory {
  // User Management
  USER_VERIFICATION = 'user_verification',
  USER_ROLE_ASSIGNMENT = 'user_role_assignment', 
  USER_ROLE_CHANGE = 'user_role_change',
  
  // Product Management  
  PRODUCT_CREATED = 'product_created',
  PRODUCT_UPDATED = 'product_updated',
  PRODUCT_DELETED = 'product_deleted',
  LOW_STOCK_ALERT = 'low_stock_alert',
  OUT_OF_STOCK = 'out_of_stock',
  
  // Order Management
  ORDER_CREATED = 'order_created',
  ORDER_COMPLETED = 'order_completed',
  ORDER_CANCELLED = 'order_cancelled',
  
  // System & Admin
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SYSTEM_UPDATE = 'system_update',
  BACKUP_COMPLETE = 'backup_complete',
  
  // Store Management
  STORE_CREATED = 'store_created',
  STORE_UPDATED = 'store_updated',
  
  // Reports & Analytics
  DAILY_REPORT = 'daily_report',
  WEEKLY_REPORT = 'weekly_report',
  
  // Security & Compliance
  SECURITY_ALERT = 'security_alert',
  COMPLIANCE_WARNING = 'compliance_warning',
  
  // Disaster & Emergency
  EMERGENCY_ALERT = 'emergency_alert',
  SYSTEM_ERROR = 'system_error'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal', 
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum NotificationActionType {
  VIEW_DETAILS = 'view_details',
  VERIFY_EMAIL = 'verify_email',
  APPROVE_USER = 'approve_user',
  RESTOCK_PRODUCT = 'restock_product',
  VIEW_REPORT = 'view_report',
  ACKNOWLEDGE = 'acknowledge',
  DISMISS = 'dismiss'
}

// For filtering and querying
export interface NotificationFilter {
  companyId: string;
  storeId?: string;
  userId?: string;
  category?: NotificationCategory[];
  type?: ('success' | 'warning' | 'error' | 'info')[];
  read?: boolean;
  priority?: NotificationPriority[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

// -----------------------------------------------------------------------------
// Simple notification schema for the new `notifications` collection
// -----------------------------------------------------------------------------
import { Timestamp } from 'firebase/firestore';

/**
 * Lightweight notification record stored in `notifications` collection.
 * - `type` distinguishes display/visibility logic (user-facing vs technical/system)
 * - `metadata` can contain arbitrary technical details (error traces, codes, etc.)
 */
export interface StoreNotification {
  id: string; // UUID or auto-generated document ID
  type: 'user' | 'technical';
  title: string;
  message: string;
  storeId: string;
  createdAt: Timestamp;
  read: boolean;
  metadata?: any;
}

export type NotificationRecord = StoreNotification;