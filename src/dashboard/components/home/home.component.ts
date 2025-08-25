import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../app/core/services/auth.service';

export interface DashboardStats {
  totalSales: number;
  todayOrders: number;
  activeStores: number;
  totalCustomers: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Enhanced Dashboard Header -->
    <header class="dashboard-header">
      <div class="header-left">
        <div class="logo-section">
          <img src="/assets/images/tovrika_official.png" alt="JasperPOS" class="logo">
          <h1 class="app-title">JasperPOS Dashboard</h1>
        </div>
      </div>
      
      <div class="header-right">
        <!-- Quick Actions -->
        <div class="quick-actions">
          <button class="action-btn" (click)="navigateToHome()" title="Go to Home">
            <i class="fas fa-home"></i>
          </button>
          <button class="action-btn" (click)="openNotifications()" title="Notifications">
            <i class="fas fa-bell"></i>
            <span class="notification-badge" *ngIf="hasNotifications">3</span>
          </button>
        </div>

        <!-- User Menu -->
        <div class="user-menu" [class.active]="isDropdownOpen" (click)="toggleDropdown($event)">
          <div class="user-avatar">
            <img *ngIf="userProfileImage" [src]="userProfileImage" alt="User" class="avatar-image">
            <i *ngIf="!userProfileImage" class="fas fa-user"></i>
          </div>
          <div class="user-info">
            <span class="user-name">{{ userName || 'User' }}</span>
            <span class="user-email">{{ userEmail }}</span>
          </div>
          <i class="fas fa-chevron-down dropdown-arrow"></i>
          
          <!-- Dropdown Menu -->
          <div class="dropdown-menu" *ngIf="isDropdownOpen">
            <a class="dropdown-item" (click)="navigateToHome()">
              <i class="fas fa-home"></i>
              <span>Go to Home</span>
            </a>
            <a class="dropdown-item" (click)="viewProfile()">
              <i class="fas fa-user-circle"></i>
              <span>Company Profile</span>
            </a>
            <a class="dropdown-item" (click)="navigateToCreateStore()">
              <i class="fas fa-store"></i>
              <span>Create Store</span>
            </a>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item" (click)="openSettings()">
              <i class="fas fa-cog"></i>
              <span>Settings</span>
            </a>
            <a class="dropdown-item" (click)="signOut()">
              <i class="fas fa-sign-out-alt"></i>
              <span>Sign Out</span>
            </a>
          </div>
        </div>
      </div>
    </header>

    <!-- Dashboard Content -->
    <main class="dashboard-main">
      <div class="dashboard-container">
        <!-- Welcome Section -->
        <section class="welcome-section">
          <h2>Welcome back, {{ userName || userEmail }}! 👋</h2>
          <p>Here's what's happening with your business today.</p>
        </section>

        <!-- Stats Cards -->
        <section class="stats-section">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon sales">
                <i class="fas fa-dollar-sign"></i>
              </div>
              <div class="stat-content">
                <h3>Total Sales</h3>
                <p class="stat-value">${{ dashboardStats.totalSales.toLocaleString() }}</p>
                <span class="stat-change positive">+12% from yesterday</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon orders">
                <i class="fas fa-shopping-cart"></i>
              </div>
              <div class="stat-content">
                <h3>Today's Orders</h3>
                <p class="stat-value">{{ dashboardStats.todayOrders }}</p>
                <span class="stat-change positive">+8 from yesterday</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon stores">
                <i class="fas fa-store"></i>
              </div>
              <div class="stat-content">
                <h3>Active Stores</h3>
                <p class="stat-value">{{ dashboardStats.activeStores }}</p>
                <span class="stat-change neutral">No change</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon customers">
                <i class="fas fa-users"></i>
              </div>
              <div class="stat-content">
                <h3>Customers</h3>
                <p class="stat-value">{{ dashboardStats.totalCustomers.toLocaleString() }}</p>
                <span class="stat-change positive">+15 this week</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Quick Actions Section -->
        <section class="actions-section">
          <h3>Quick Actions</h3>
          <div class="actions-grid">
            <button class="action-card" (click)="navigateToCreateStore()">
              <i class="fas fa-plus-circle"></i>
              <h4>Create New Store</h4>
              <p>Set up a new store location</p>
            </button>

            <button class="action-card" (click)="viewProfile()">
              <i class="fas fa-building"></i>
              <h4>Company Profile</h4>
              <p>Manage company information</p>
            </button>

            <button class="action-card" (click)="openInventory()">
              <i class="fas fa-boxes"></i>
              <h4>Inventory</h4>
              <p>Manage products and stock</p>
            </button>

            <button class="action-card" (click)="openReports()">
              <i class="fas fa-chart-bar"></i>
              <h4>Reports</h4>
              <p>View sales and analytics</p>
            </button>
          </div>
        </section>

        <!-- Recent Activity -->
        <section class="activity-section">
          <h3>Recent Activity</h3>
          <div class="activity-list">
            <div class="activity-item">
              <div class="activity-icon">
                <i class="fas fa-shopping-cart"></i>
              </div>
              <div class="activity-content">
                <p><strong>New order #1234</strong> from Downtown Store</p>
                <span class="activity-time">2 minutes ago</span>
              </div>
            </div>

            <div class="activity-item">
              <div class="activity-icon">
                <i class="fas fa-user-plus"></i>
              </div>
              <div class="activity-content">
                <p><strong>New customer registered</strong> - John Smith</p>
                <span class="activity-time">15 minutes ago</span>
              </div>
            </div>

            <div class="activity-item">
              <div class="activity-icon">
                <i class="fas fa-store"></i>
              </div>
              <div class="activity-content">
                <p><strong>Store "Main Branch"</strong> went online</p>
                <span class="activity-time">1 hour ago</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  `,
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  // User data
  userEmail: string | null = null;
  userName: string | null = null;
  userProfileImage: string | null = null;
  
  // UI state
  isDropdownOpen = false;
  hasNotifications = true;

  // Dashboard data
  dashboardStats: DashboardStats = {
    totalSales: 45250,
    todayOrders: 28,
    activeStores: 3,
    totalCustomers: 1847
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.userEmail = localStorage.getItem('email');
      this.userName = localStorage.getItem('userName') || this.extractNameFromEmail();
    }
  }

  ngOnInit() {
    this.loadDashboardData();
  }

  private extractNameFromEmail(): string {
    if (this.userEmail) {
      return this.userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'User';
  }

  private loadDashboardData() {
    // In a real app, this would load data from your backend
    // For now, using mock data
  }

  // Header dropdown methods
  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: Event) {
    this.isDropdownOpen = false;
  }

  // Navigation methods
  navigateToHome() {
    this.router.navigate(['/']);
  }

  viewProfile() {
    this.router.navigate(['/company-profile']);
  }

  navigateToCreateStore() {
    this.router.navigate(['/create-store']);
  }

  openNotifications() {
    console.log('Opening notifications...');
    // Implement notifications
  }

  openSettings() {
    console.log('Opening settings...');
    // Implement settings
  }

  openInventory() {
    console.log('Opening inventory...');
    // Navigate to inventory management
  }

  openReports() {
    console.log('Opening reports...');
    // Navigate to reports
  }

  signOut() {
    this.authService.signOut().then(() => {
      localStorage.removeItem('user');
      localStorage.removeItem('email');
      localStorage.removeItem('userName');
      this.router.navigate(['/']);
    });
  }
}
      description: 'Let guests RSVP and choose preferences.',
      imageUrl: '/assets/images/no_image_template.png'
      // No image, will use default
    },
    {
      id: 'event-registration',
      title: 'Event Register',
      description: 'Gather attendees and schedule details.',
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/270/270014.png'
    }
  ];

  createBlankTemplate() {
  this.router.navigate(['/create-template']);
}

  loadTemplate(templateId: string) {
    console.log(`Load template: ${templateId}`);
  }
  onGetStarted(): void {
   this.router.navigate(['/get-started']);
  // Replace with: this.router.navigate(['/tutorial']);
}

onCheckTemplates(): void {
  this.router.navigate(['/launch-template']);
}

}
