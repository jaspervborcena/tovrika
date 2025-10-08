import { Injectable, inject, signal, computed } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  Timestamp,
  deleteDoc,
  writeBatch
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { ToastService } from '../shared/services/toast.service';
import { 
  NotificationData, 
  NotificationFilter, 
  NotificationCategory, 
  NotificationPriority, 
  NotificationActionType 
} from '../interfaces/notification.interface';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private firestoreSecurityService = inject(FirestoreSecurityService);
  private offlineDocService = inject(OfflineDocumentService);

  // Reactive state
  private notifications = signal<NotificationData[]>([]);
  private unsubscribe: (() => void) | null = null;

  // Public computed signals
  notifications$ = computed(() => this.notifications());
  unreadCount$ = computed(() => this.notifications().filter(n => !n.read).length);
  
  // Get notifications by priority
  urgentNotifications$ = computed(() => 
    this.notifications().filter(n => n.priority === NotificationPriority.URGENT && !n.read)
  );
  
  highPriorityNotifications$ = computed(() => 
    this.notifications().filter(n => n.priority === NotificationPriority.HIGH && !n.read)
  );

  constructor() {
    // Auto-start listening when user logs in
    // Note: You may need to implement currentUser$ observable in AuthService
    // For now, we'll start listening when methods are called
  }

  /**
   * Start real-time listening to notifications for current user
   */
  private startListening(): void {
    const currentPermission = this.authService.getCurrentPermission();
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentPermission || !currentUser) return;

    this.stopListening(); // Clean up existing listener

    const notificationsRef = collection(this.firestore, 'notifications');
    
    // Query for notifications relevant to current user
    const q = query(
      notificationsRef,
      where('companyId', '==', currentPermission.companyId),
      where('recipientType', 'in', [
        'system', // System-wide notifications
        'company', // Company-wide notifications  
        'user' // User-specific notifications
      ]),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    // Real-time listener
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: NotificationData[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const notification: NotificationData = {
          id: doc.id,
          ...data,
          createdAt: data['createdAt']?.toDate() || new Date(),
          readAt: data['readAt']?.toDate(),
          expiresAt: data['expiresAt']?.toDate(),
          emailSentAt: data['emailSentAt']?.toDate()
        } as NotificationData;

        // Filter based on recipient logic
        const shouldInclude = this.shouldIncludeNotification(notification, currentUser.uid, currentPermission);
        if (shouldInclude) {
          notifications.push(notification);
        }
      });

      this.notifications.set(notifications);
      
      // Show urgent notifications as toasts
      this.showUrgentNotificationsAsToasts(notifications);
    });
  }

  /**
   * Stop listening to real-time updates
   */
  private stopListening(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Determine if notification should be included for current user
   */
  private shouldIncludeNotification(
    notification: NotificationData, 
    userId: string, 
    userPermission: any
  ): boolean {
    // System and company-wide notifications
    if (['system', 'company'].includes(notification.recipientType)) {
      return true;
    }

    // User-specific notifications
    if (notification.recipientType === 'user') {
      return notification.recipientId === userId;
    }

    // Role-based notifications
    if (notification.recipientType === 'role') {
      return notification.recipientId === userPermission.roleId;
    }

    // Store-based notifications
    if (notification.recipientType === 'store') {
      return notification.recipientId === userPermission.storeId;
    }

    return false;
  }

  /**
   * Show urgent notifications as toast messages
   */
  private showUrgentNotificationsAsToasts(notifications: NotificationData[]): void {
    const currentNotificationIds = this.notifications();
    const newUrgentNotifications = notifications.filter(n => 
      n.priority === NotificationPriority.URGENT && 
      !n.read &&
      !currentNotificationIds.some(existing => existing.id === n.id)
    );

    newUrgentNotifications.forEach(notification => {
      this.toastService.addToast({
        message: `🚨 ${notification.title}: ${notification.message}`,
        type: notification.type,
        duration: 8000 // Longer duration for urgent notifications
      });
    });
  }

  /**
   * Create a new notification
   */
  async createNotification(notificationData: Omit<NotificationData, 'id' | 'createdAt' | 'read'>): Promise<string> {
    const notificationsRef = collection(this.firestore, 'notifications');
    
    const docData = {
      ...notificationData,
      createdAt: new Date(),
      read: false,
      // Convert dates to Firestore timestamps for offline compatibility
      expiresAt: notificationData.expiresAt || null,
    };

    // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
    const documentId = await this.offlineDocService.createDocument('notifications', docData);
    console.log('✅ Notification created with ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
    return documentId;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notificationRef = doc(this.firestore, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: Timestamp.now()
    });
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    
    notificationIds.forEach(id => {
      const notificationRef = doc(this.firestore, 'notifications', id);
      batch.update(notificationRef, {
        read: true,
        readAt: Timestamp.now()
      });
    });

    await batch.commit();
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(): Promise<void> {
    const unreadNotifications = this.notifications().filter(n => !n.read);
    const unreadIds = unreadNotifications.map(n => n.id!);
    
    if (unreadIds.length > 0) {
      await this.markMultipleAsRead(unreadIds);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const notificationRef = doc(this.firestore, 'notifications', notificationId);
    await deleteDoc(notificationRef);
  }

  /**
   * Get filtered notifications (for advanced filtering)
   */
  async getFilteredNotifications(filter: NotificationFilter): Promise<NotificationData[]> {
    const notificationsRef = collection(this.firestore, 'notifications');
    
    let q = query(
      notificationsRef,
      where('companyId', '==', filter.companyId),
      orderBy('createdAt', 'desc')
    );

    if (filter.limit) {
      q = query(q, limit(filter.limit));
    }

    const snapshot = await getDocs(q);
    const notifications: NotificationData[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        ...data,
        createdAt: data['createdAt']?.toDate() || new Date(),
        readAt: data['readAt']?.toDate(),
        expiresAt: data['expiresAt']?.toDate(),
        emailSentAt: data['emailSentAt']?.toDate()
      } as NotificationData);
    });

    return notifications;
  }

  // === HELPER METHODS FOR SPECIFIC NOTIFICATION TYPES ===

  /**
   * Create user verification notification
   */
  async notifyUserVerificationRequired(userId: string, userEmail: string, companyId: string): Promise<void> {
    await this.createNotification({
      title: 'Email Verification Required',
      message: `New user ${userEmail} needs to verify their email address`,
      type: 'warning',
      category: NotificationCategory.USER_VERIFICATION,
      recipientType: 'company', // All company admins
      companyId,
      priority: NotificationPriority.HIGH,
      actionType: NotificationActionType.VERIFY_EMAIL,
      actionData: {
        entityId: userId,
        entityType: 'user',
        url: `/dashboard/user-roles?userId=${userId}`,
        buttonText: 'Verify User'
      },
      sendEmail: true
    });
  }

  /**
   * Create user role assignment notification
   */
  async notifyUserRoleAssignment(
    userId: string, 
    userName: string, 
    roleId: string, 
    storeId: string,
    companyId: string
  ): Promise<void> {
    // Notify the user being assigned
    await this.createNotification({
      title: 'Role Assignment',
      message: `You have been assigned as ${roleId} for store operations`,
      type: 'success',
      category: NotificationCategory.USER_ROLE_ASSIGNMENT,
      recipientType: 'user',
      recipientId: userId,
      companyId,
      storeId,
      priority: NotificationPriority.NORMAL,
      actionType: NotificationActionType.VIEW_DETAILS,
      actionData: {
        url: '/dashboard',
        buttonText: 'Go to Dashboard'
      }
    });

    // Notify company admins
    await this.createNotification({
      title: 'User Role Assigned',
      message: `${userName} has been assigned role: ${roleId}`,
      type: 'info',
      category: NotificationCategory.USER_ROLE_ASSIGNMENT,
      recipientType: 'company',
      companyId,
      storeId,
      priority: NotificationPriority.LOW,
      actionType: NotificationActionType.VIEW_DETAILS,
      actionData: {
        url: '/dashboard/user-roles',
        buttonText: 'View User Roles'
      }
    });
  }

  /**
   * Create low stock alert notification
   */
  async notifyLowStock(
    productName: string, 
    currentStock: number, 
    minStock: number,
    storeId: string, 
    companyId: string
  ): Promise<void> {
    await this.createNotification({
      title: 'Low Stock Alert',
      message: `${productName} is running low (${currentStock} remaining, minimum: ${minStock})`,
      type: 'warning',
      category: NotificationCategory.LOW_STOCK_ALERT,
      recipientType: 'store', // All users in this store
      recipientId: storeId,
      companyId,
      storeId,
      priority: NotificationPriority.HIGH,
      actionType: NotificationActionType.RESTOCK_PRODUCT,
      actionData: {
        entityType: 'product',
        url: '/dashboard/products',
        buttonText: 'Manage Inventory'
      }
    });
  }

  /**
   * Create system maintenance notification
   */
  async notifySystemMaintenance(
    title: string,
    message: string,
    scheduledTime: Date,
    companyId?: string
  ): Promise<void> {
    await this.createNotification({
      title,
      message,
      type: 'info',
      category: NotificationCategory.SYSTEM_MAINTENANCE,
      recipientType: companyId ? 'company' : 'system',
      recipientId: companyId,
      companyId: companyId || 'system',
      priority: NotificationPriority.NORMAL,
      expiresAt: scheduledTime,
      actionType: NotificationActionType.ACKNOWLEDGE,
      actionData: {
        buttonText: 'Acknowledge'
      }
    });
  }

  /**
   * Create emergency alert notification
   */
  async notifyEmergency(
    title: string,
    message: string,
    companyId?: string,
    storeId?: string
  ): Promise<void> {
    await this.createNotification({
      title: `🚨 EMERGENCY: ${title}`,
      message,
      type: 'error',
      category: NotificationCategory.EMERGENCY_ALERT,
      recipientType: storeId ? 'store' : (companyId ? 'company' : 'system'),
      recipientId: storeId || companyId,
      companyId: companyId || 'system',
      storeId,
      priority: NotificationPriority.URGENT,
      actionType: NotificationActionType.ACKNOWLEDGE,
      actionData: {
        buttonText: 'Acknowledge Emergency'
      },
      sendEmail: true
    });
  }

  /**
   * Cleanup expired notifications
   */
  async cleanupExpiredNotifications(): Promise<void> {
    const now = new Date();
    const expiredNotifications = this.notifications().filter(n => 
      n.expiresAt && n.expiresAt < now
    );

    const batch = writeBatch(this.firestore);
    expiredNotifications.forEach(notification => {
      if (notification.id) {
        const notificationRef = doc(this.firestore, 'notifications', notification.id);
        batch.delete(notificationRef);
      }
    });

    if (expiredNotifications.length > 0) {
      await batch.commit();
    }
  }
}