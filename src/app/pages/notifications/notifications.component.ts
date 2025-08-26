import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ContentLayoutComponent } from '../../shared/components/content-layout/content-layout.component';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: Date;
  read: boolean;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent, ContentLayoutComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent {
  currentFilter: string = 'all';
  
  notifications: Notification[] = [
    {
      id: '1',
      title: 'Low Stock Alert',
      message: 'Product "iPhone 15 Pro" is running low on stock (5 units remaining)',
      type: 'warning',
      timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      read: false
    },
    {
      id: '2',
      title: 'New Sale Completed',
      message: 'Sale #12345 completed successfully for $1,299.99',
      type: 'success',
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      read: false
    },
    {
      id: '3',
      title: 'Daily Report Available',
      message: 'Your daily sales report for today is now available for download',
      type: 'info',
      timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      read: true
    },
    {
      id: '4',
      title: 'System Maintenance',
      message: 'Scheduled maintenance will occur tonight from 2:00 AM - 4:00 AM EST',
      type: 'info',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      read: true
    },
    {
      id: '5',
      title: 'Payment Failed',
      message: 'Payment processing failed for order #67890. Customer notified.',
      type: 'error',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      read: false
    },
    {
      id: '6',
      title: 'Inventory Updated',
      message: 'Bulk inventory update completed successfully. 145 products updated.',
      type: 'success',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      read: true
    }
  ];

  get filteredNotifications(): Notification[] {
    switch (this.currentFilter) {
      case 'unread':
        return this.notifications.filter(n => !n.read);
      case 'success':
        return this.notifications.filter(n => n.type === 'success');
      case 'warning':
        return this.notifications.filter(n => n.type === 'warning');
      case 'error':
        return this.notifications.filter(n => n.type === 'error');
      case 'info':
        return this.notifications.filter(n => n.type === 'info');
      default:
        return this.notifications;
    }
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  setFilter(filter: string): void {
    this.currentFilter = filter;
  }

  markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
  }

  getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return timestamp.toLocaleDateString();
  }
}
