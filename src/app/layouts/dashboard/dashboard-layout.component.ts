import { Component, inject, signal } from '@angular/core';
import { HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AccessService } from '../../core/services/access.service';
import { ToastService } from '../../shared/services/toast.service';
import { ErrorMessages } from '../../shared/enums/notification-messages.enum';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <!-- Sidebar for desktop -->
      <div class="dashboard-sidebar flex flex-col items-center">
        <div class="flex flex-col h-full">
          <!-- Header -->
          <div class="flex-shrink-0 px-4 py-4 border-b border-gray-200 sidebar-header">
            <div class="flex items-center justify-between">
              <div class="font-bold text-2xl mb-4 flex items-center gap-2">
                Management
              </div>
            </div>
          </div>
          <!-- Navigation: Only show allowed links for cashier -->
          <nav class="flex-1 py-4 space-y-2 overflow-y-auto flex flex-col items-center">
            <a *ngIf="permissions.canViewCompanyProfile" routerLink="/dashboard/company-profile" routerLinkActive="nav-link-active" class="nav-link flex flex-col items-center justify-center" title="Company Profile">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span class="ml-2">Company Profile</span>
            </a>
            <a *ngIf="permissions.canViewProducts" routerLink="/dashboard/products" routerLinkActive="nav-link-active" class="nav-link flex flex-col items-center justify-center" title="Products">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span class="ml-2">Products</span>
            </a>
            <a *ngIf="permissions.canViewPOS" routerLink="/pos" routerLinkActive="nav-link-active" class="nav-link flex flex-col items-center justify-center" title="Point of Sale">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="ml-2">POS</span>
            </a>
            <!-- ...existing code for full menu for other roles, using permissions checks... -->
          </nav>
          <!-- User Info -->
          <div class="flex-shrink-0 border-t border-gray-200 p-4" >
            ...existing code...
          </div>
        </div>
      </div>
      <!-- Top bar for mobile -->
  <nav class="dashboard-topbar fixed top-0 left-0 w-full bg-white shadow z-30 flex items-center justify-center px-2 py-1" style="height:56px;">
        <a routerLink="/dashboard/overview" routerLinkActive="nav-link-active" class="mx-2 flex flex-col items-center justify-center group" title="Overview">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          </svg>
          <span class="text-[10px] group-hover:block hidden">Overview</span>
        </a>
        ...existing code for other links, only icon and small text...
      </nav>


  <!-- Main Content -->
  <div class="flex-1 flex flex-col lg:ml-64" >

        <!-- Content -->
        <main class="flex-1 overflow-auto">
          <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
  `
})
export class DashboardLayoutComponent {
  private authService = inject(AuthService);
  private accessService = inject(AccessService);
  private toastService = inject(ToastService);
  user = this.authService.getCurrentUser();

  get permissions() {
    return this.accessService.permissions;
  }

  userInitials(): string {
    const name = this.user?.displayName || this.user?.email || '';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  async logout() {
    try {
      await this.authService.logout();
    } catch (err) {
      console.log('Logout error:', err);
      this.toastService.error(ErrorMessages.NETWORK_ERROR);
    }
  }
}
