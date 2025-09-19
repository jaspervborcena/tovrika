/**
 * Centralized enum for all notification messages used throughout the application
 * This helps maintain consistency and makes it easier to update messages in one place
 */

export enum ErrorMessages {
  // General errors
  GENERIC_ERROR = 'An unexpected error occurred. Please try again.',
  NETWORK_ERROR = 'Network error. Please check your connection and try again.',
  SAVE_ERROR = 'Error saving changes. Please try again.',
  DELETE_ERROR = 'Error deleting item. Please try again.',
  LOAD_ERROR = 'Error loading data. Please try again.',

  // Authentication errors
  LOGIN_FAILED = 'Unable to log in. Please check your network or try again later.',
  AUTHENTICATION_ERROR = 'Authentication failed. Please log in again.',
  SESSION_EXPIRED = 'Your session has expired. Please log in again.',

  // User management errors
  USER_SEARCH_ERROR = 'Error searching for user. Please try again.',
  USER_ROLE_SAVE_ERROR = 'Error saving user role. Please try again.',
  USER_ROLE_DELETE_ERROR = 'Failed to delete user role',

  // Product management errors
  PRODUCT_SAVE_ERROR = 'Error saving product. Please try again.',
  PRODUCT_DELETE_ERROR = 'Error deleting product. Please try again.',
  INVENTORY_BATCH_ADD_ERROR = 'Error adding inventory batch. Please try again.',
  INVENTORY_BATCH_REMOVE_ERROR = 'Error removing inventory batch. Please try again.',
  ACTIVE_BATCH_SET_ERROR = 'Failed to set active batch',
  IMAGE_UPLOAD_ERROR = 'Image compression or upload failed. Please upload a smaller image.',

  // Store management errors
  STORE_SAVE_ERROR = 'Error saving store. Please try again.',
  STORE_DELETE_ERROR = 'Error deleting store. Please try again.',

  // Role management errors
  ROLE_SAVE_ERROR = 'Error saving changes. Please try again.',
  ROLE_DELETE_ERROR = 'Error deleting role. Please try again.',
  ROLE_CREATE_ERROR = 'Failed to create role. Please try again.',

  // POS errors
  ORDER_PROCESS_ERROR = 'Failed to process order. Please try again.',
  PAYMENT_ERROR = 'Payment processing failed. Please try again.',
  INVENTORY_ERROR = 'Inventory update failed. Please try again.',
}

export enum WarningMessages {
  // General warnings
  UNSAVED_CHANGES = 'You have unsaved changes. Are you sure you want to leave?',
  DATA_LOSS_WARNING = 'This action cannot be undone.',

  // Validation warnings
  REQUIRED_FIELD = 'This field is required.',
  INVALID_FORMAT = 'Please enter a valid format.',
  DUPLICATE_NAME = 'A record with this name already exists.',
  
  // User management warnings
  ROLE_NAME_REQUIRED = 'Please enter a role name.',
  ROLE_NAME_EXISTS = 'A role with this name already exists. Please choose a different name.',
  ROLE_NAME_RESERVED = 'This is a reserved role name. Please choose a different name.',
  DEFAULT_ROLE_DELETE = 'Default roles cannot be deleted.',

  // Product warnings
  PRODUCT_OUT_OF_STOCK = 'Product is out of stock',
  LOW_INVENTORY = 'Low inventory warning',
  PRICE_VALIDATION = 'Please enter a valid price.',

  // Store warnings
  STORE_NAME_EXISTS = 'A store with this name already exists in the selected location.',
  STORE_LIMIT_REACHED = 'Maximum number of stores reached for your plan.',
}

export enum SuccessMessages {
  // General success
  SAVE_SUCCESS = 'Changes saved successfully.',
  DELETE_SUCCESS = 'Item deleted successfully.',
  CREATE_SUCCESS = 'Item created successfully.',
  UPDATE_SUCCESS = 'Item updated successfully.',

  // Authentication success
  LOGIN_SUCCESS = 'Welcome back! You have been logged in successfully.',
  LOGOUT_SUCCESS = 'You have been logged out successfully.',

  // User management success
  USER_ROLE_SAVED = 'User role saved successfully.',
  USER_ROLE_DELETED = 'User role deleted successfully.',

  // Product management success
  PRODUCT_SAVED = 'Product saved successfully.',
  PRODUCT_DELETED = 'Product deleted successfully.',
  INVENTORY_UPDATED = 'Inventory updated successfully.',
  IMAGE_UPLOADED = 'Image uploaded successfully.',

  // Store management success
  STORE_SAVED = 'Store saved successfully.',
  STORE_DELETED = 'Store deleted successfully.',

  // Role management success
  ROLE_SAVED = 'Role saved successfully.',
  ROLE_DELETED = 'Role deleted successfully.',
  ROLE_CREATED = 'Role created successfully.',

  // POS success
  ORDER_COMPLETED = 'Order completed successfully.',
  PAYMENT_PROCESSED = 'Payment processed successfully.',
}

export enum InfoMessages {
  // General info
  LOADING = 'Loading...',
  PROCESSING = 'Processing your request...',
  SYNCING = 'Syncing data...',

  // User guidance
  SELECT_ITEM = 'Please select an item to continue.',
  FILL_REQUIRED_FIELDS = 'Please fill in all required fields.',
  CHECK_FORM_ERRORS = 'Please check the form for errors.',

  // Status updates
  SYNC_COMPLETE = 'Data synchronization complete.',
  BACKUP_COMPLETE = 'Backup completed successfully.',
  CONNECTION_RESTORED = 'Connection restored.',
}

/**
 * Utility class for getting dynamic messages with parameters
 */
export class NotificationMessages {
  
  /**
   * Get a role deletion success message with the role name
   */
  static getRoleDeletedMessage(roleName: string): string {
    return `Role "${roleName}" deleted successfully.`;
  }

  /**
   * Get a role name exists warning with store context
   */
  static getRoleExistsMessage(roleName: string, isStoreLevel: boolean): string {
    const context = isStoreLevel ? 'in the selected store' : 'at the company level';
    return `A role with the name "${roleName}" already exists ${context}. Please choose a different name.`;
  }

  /**
   * Get a reserved role name warning
   */
  static getReservedRoleMessage(roleName: string): string {
    return `"${roleName}" is a reserved role name. Please choose a different name.`;
  }

  /**
   * Get a user role delete error with details
   */
  static getUserRoleDeleteError(error: any): string {
    return `Failed to delete user role: ${error}`;
  }

  /**
   * Get a generic error message with details
   */
  static getErrorWithDetails(baseMessage: string, details?: string): string {
    return details ? `${baseMessage}: ${details}` : baseMessage;
  }
}