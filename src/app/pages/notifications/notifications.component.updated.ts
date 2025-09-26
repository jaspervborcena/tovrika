import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ContentLayoutComponent } from '../../shared/components/content-layout/content-layout.component';
import { NotificationService } from '../../services/notification.service';
import { NotificationData, NotificationCategory } from '../../interfaces/notification.interface';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, HeaderComponent, ContentLayoutComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {
  private notificationService = inject(NotificationService);
  
  currentFilter: string = 'all';
  
  // Real-time data from Firebase - the service automatically starts listening on injection
  notifications = this.notificationService.notifications$;

  get unreadCount(): number {
    return this.notificationService.unreadCount$();
  }

  ngOnInit(): void {
    // No need to start listening manually - the service handles this automatically
  }

  get filteredNotifications() {
    const allNotifications = this.notifications();
    
    switch (this.currentFilter) {
      case 'unread':
        return allNotifications.filter(n => !n.read);
      case 'success':
        return allNotifications.filter(n => n.type === 'success');
      case 'warning':
        return allNotifications.filter(n => n.type === 'warning');
      case 'error':
        return allNotifications.filter(n => n.type === 'error');
      case 'info':
        return allNotifications.filter(n => n.type === 'info');
      default:
        return allNotifications;
    }
  }

  setFilter(filter: string): void {
    this.currentFilter = filter;
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await this.notificationService.markAsRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      await this.notificationService.markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await this.notificationService.deleteNotification(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  handleNotificationAction(notification: NotificationData): void {
    if (notification.actionData?.url) {
      // Mark as read when action is taken
      this.markAsRead(notification.id!);
      
      // Navigate to the URL
      if (notification.actionData.url.startsWith('http')) {
        window.open(notification.actionData.url, '_blank');
      } else {
        // Handle internal navigation here
        // You can inject Router and navigate programmatically
        console.log('Navigate to:', notification.actionData.url);
      }
    }
  }

  getTimeAgo(timestamp: Date | any): string {
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  }

  getNotificationIcon(notification: NotificationData): string {
    switch (notification.category) {
      case NotificationCategory.USER_VERIFICATION: return 'fas fa-user-check';
      case NotificationCategory.USER_ROLE_ASSIGNMENT: return 'fas fa-user-cog';
      case NotificationCategory.LOW_STOCK_ALERT: return 'fas fa-exclamation-triangle';
      case NotificationCategory.PRODUCT_CREATED: return 'fas fa-plus-circle';
      case NotificationCategory.ORDER_COMPLETED: return 'fas fa-shopping-cart';
      case NotificationCategory.SYSTEM_MAINTENANCE: return 'fas fa-tools';
      case NotificationCategory.EMERGENCY_ALERT: return 'fas fa-exclamation-circle';
      case NotificationCategory.STORE_CREATED: return 'fas fa-store';
      case NotificationCategory.SYSTEM_ERROR: return 'fas fa-credit-card';
      case NotificationCategory.BACKUP_COMPLETE: return 'fas fa-database';
      default: return 'fas fa-bell';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'URGENT': return 'priority-urgent';
      case 'HIGH': return 'priority-high';
      case 'NORMAL': return 'priority-normal';
      case 'LOW': return 'priority-low';
      default: return '';
    }
  }
}