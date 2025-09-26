/**
 * INTEGRATION EXAMPLES - Add these to your existing services
 * 
 * This file shows exactly where and how to integrate notifications
 * into your existing POS system services.
 */

import { NotificationService } from './notification.service';

// ============================================================================
// 1. USER REGISTRATION & VERIFICATION (auth.service.ts)
// ============================================================================

/*
In your auth.service.ts registerUser method, add this after successful registration:

async registerUser(email: string, password: string, userData: any): Promise<any> {
  try {
    // ... existing registration logic ...
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    
    // ... existing user creation logic ...
    
    // 🔔 NOTIFICATION: Send email verification notification
    const notificationService = inject(NotificationService);
    await notificationService.notifyUserVerificationRequired(
      userCredential.user.uid,
      email,
      userData.companyId || 'pending' 
    );
    
    return userCredential;
  } catch (error) {
    // ... existing error handling ...
  }
}
*/

// ============================================================================
// 2. USER ROLE ASSIGNMENT (user-role.service.ts)
// ============================================================================

/*
In your user-role.service.ts when assigning roles, add this:

async createUserRole(userRole: Omit<UserRole, 'id' | 'createdAt'>): Promise<string> {
  try {
    // ... existing role creation logic ...
    const docRef = await addDoc(collection(this.firestore, 'userRoles'), userRoleData);
    
    // 🔔 NOTIFICATION: Notify user of role assignment
    const notificationService = inject(NotificationService);
    await notificationService.notifyUserRoleAssignment(
      userRole.userId,
      userRole.email,
      userRole.roleId,
      userRole.storeId,
      userRole.companyId
    );
    
    return docRef.id;
  } catch (error) {
    // ... existing error handling ...
  }
}
*/

// ============================================================================
// 3. PRODUCT MANAGEMENT NOTIFICATIONS (product.service.ts)
// ============================================================================

/*
In your product.service.ts, add inventory monitoring:

async updateProductInventory(productId: string, newQuantity: number): Promise<void> {
  try {
    // ... existing inventory update logic ...
    
    // Get product details
    const product = this.getProductById(productId);
    if (!product) return;
    
    // Check for low stock
    const minStockLevel = product.minStock || 10; // Default minimum
    
    if (newQuantity <= minStockLevel && newQuantity > 0) {
      // 🔔 NOTIFICATION: Low stock alert
      const notificationService = inject(NotificationService);
      const authService = inject(AuthService);
      const currentPermission = authService.getCurrentPermission();
      
      if (currentPermission) {
        await notificationService.notifyLowStock(
          product.productName,
          newQuantity,
          minStockLevel,
          currentPermission.storeId,
          currentPermission.companyId
        );
      }
    }
    
    // ... rest of update logic ...
  } catch (error) {
    // ... existing error handling ...
  }
}

async createProduct(productData: Omit<Product, 'id'>): Promise<string> {
  try {
    // ... existing product creation logic ...
    const docRef = await addDoc(collection(this.firestore, 'products'), productData);
    
    // 🔔 NOTIFICATION: Product created (for store managers)
    const notificationService = inject(NotificationService);
    const authService = inject(AuthService);
    const currentPermission = authService.getCurrentPermission();
    
    if (currentPermission) {
      await notificationService.createNotification({
        title: 'New Product Added',
        message: `Product "${productData.productName}" has been added to inventory`,
        type: 'success',
        category: NotificationCategory.PRODUCT_CREATED,
        recipientType: 'store',
        recipientId: currentPermission.storeId,
        companyId: currentPermission.companyId,
        storeId: currentPermission.storeId,
        priority: NotificationPriority.LOW,
        actionType: NotificationActionType.VIEW_DETAILS,
        actionData: {
          entityId: docRef.id,
          entityType: 'product',
          url: '/dashboard/products',
          buttonText: 'View Products'
        }
      });
    }
    
    return docRef.id;
  } catch (error) {
    // ... existing error handling ...
  }
}
*/

// ============================================================================
// 4. ORDER PROCESSING NOTIFICATIONS (pos.service.ts)
// ============================================================================

/*
In your pos.service.ts processOrder method:

async processOrder(customerInfo?: any): Promise<string | null> {
  try {
    // ... existing order processing logic ...
    
    // After successful order creation
    const orderId = await addDoc(ordersRef, orderData);
    
    // 🔔 NOTIFICATION: Order completed
    const notificationService = inject(NotificationService);
    const authService = inject(AuthService);
    const currentPermission = authService.getCurrentPermission();
    
    if (currentPermission) {
      await notificationService.createNotification({
        title: 'Sale Completed',
        message: `Order #${orderData.invoiceNumber} completed - Total: $${orderData.totalAmount}`,
        type: 'success', 
        category: NotificationCategory.ORDER_COMPLETED,
        recipientType: 'store',
        recipientId: currentPermission.storeId,
        companyId: currentPermission.companyId,
        storeId: currentPermission.storeId,
        priority: NotificationPriority.LOW,
        actionType: NotificationActionType.VIEW_DETAILS,
        actionData: {
          entityId: orderId.id,
          entityType: 'order',
          url: `/dashboard/sales/orders?orderId=${orderId.id}`,
          buttonText: 'View Order'
        }
      });
    }
    
    return orderId.id;
  } catch (error) {
    // ... existing error handling ...
  }
}
*/

// ============================================================================
// 5. SYSTEM MAINTENANCE NOTIFICATIONS (Admin Service)
// ============================================================================

/*
For system-wide notifications, create in your admin service or component:

async scheduleMaintenanceNotification(): Promise<void> {
  const notificationService = inject(NotificationService);
  
  const maintenanceDate = new Date();
  maintenanceDate.setHours(maintenanceDate.getHours() + 24); // 24 hours from now
  
  await notificationService.notifySystemMaintenance(
    'Scheduled System Maintenance',
    'System maintenance is scheduled for tomorrow 2:00 AM - 4:00 AM EST. Some features may be temporarily unavailable.',
    maintenanceDate,
    undefined // System-wide notification
  );
}

async sendEmergencyAlert(): Promise<void> {
  const notificationService = inject(NotificationService);
  const authService = inject(AuthService);
  const currentPermission = authService.getCurrentPermission();
  
  await notificationService.notifyEmergency(
    'System Critical Error',
    'Critical system error detected. Please contact support immediately.',
    currentPermission?.companyId, // Company-specific or leave undefined for system-wide
    currentPermission?.storeId     // Store-specific or leave undefined
  );
}
*/

// ============================================================================
// 6. STORE MANAGEMENT NOTIFICATIONS (store.service.ts)
// ============================================================================

/*
In your store.service.ts when creating/updating stores:

async createStore(storeData: Omit<Store, 'id'>): Promise<string> {
  try {
    // ... existing store creation logic ...
    const docRef = await addDoc(collection(this.firestore, 'stores'), storeData);
    
    // 🔔 NOTIFICATION: New store created
    const notificationService = inject(NotificationService);
    
    await notificationService.createNotification({
      title: 'New Store Created',
      message: `Store "${storeData.storeName}" has been created successfully`,
      type: 'success',
      category: NotificationCategory.STORE_CREATED,
      recipientType: 'company',
      companyId: storeData.companyId,
      priority: NotificationPriority.NORMAL,
      actionType: NotificationActionType.VIEW_DETAILS,
      actionData: {
        entityId: docRef.id,
        entityType: 'store',
        url: '/dashboard/stores-management',
        buttonText: 'View Stores'
      }
    });
    
    return docRef.id;
  } catch (error) {
    // ... existing error handling ...
  }
}
*/

// ============================================================================
// 7. HEADER COMPONENT INTEGRATION (header.component.ts)
// ============================================================================

/*
Update your header.component.ts to show real notification count:

import { NotificationService } from '../../services/notification.service';

export class HeaderComponent {
  private notificationService = inject(NotificationService);
  
  // Real-time unread count
  unreadNotificationCount = this.notificationService.unreadCount$;
  
  // Start listening when component initializes
  ngOnInit() {
    this.notificationService.startListening();
  }
}

// In header.component.html, replace hardcoded badge:
<span class="notification-badge">{{ unreadNotificationCount() }}</span>
*/

// ============================================================================
// 8. NOTIFICATION PAGE INTEGRATION (notifications.component.ts) 
// ============================================================================

/*
Update your notifications.component.ts to use real data:

import { NotificationService } from '../../services/notification.service';

export class NotificationsComponent {
  private notificationService = inject(NotificationService);
  
  // Real-time notifications
  notifications = this.notificationService.notifications$;
  unreadCount = this.notificationService.unreadCount$;
  
  ngOnInit() {
    // Notifications are automatically loaded via the service
  }
  
  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationService.markAsRead(notificationId);
  }
  
  async markAllAsRead(): Promise<void> {
    await this.notificationService.markAllAsRead();
  }
}
*/