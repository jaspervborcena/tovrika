import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-100">
      <!-- Navigation -->
      <nav class="bg-primary-600">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <span class="text-white text-xl font-bold">POS System</span>
              </div>
              <div class="hidden md:block">
                <div class="ml-10 flex items-baseline space-x-4">
                  <a 
                    *ngFor="let item of navigation" 
                    [routerLink]="item.href"
                    routerLinkActive="bg-primary-700 text-white"
                    class="text-primary-100 hover:bg-primary-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    {{ item.name }}
                  </a>
                </div>
              </div>
            </div>
            <div class="hidden md:block">
              <div class="ml-4 flex items-center md:ml-6">
                <div class="ml-3 relative">
                  <div class="flex items-center">
                    <span class="text-white mr-4">{{ user?.displayName }}</span>
                    <button
                      (click)="logout()"
                      class="text-primary-100 hover:bg-primary-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <main>
        <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `
})
export class DashboardLayoutComponent {
  private authService = inject(AuthService);
  user = this.authService.getCurrentUser();

  navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Companies', href: '/companies' },
    { name: 'Stores', href: '/stores' },
    { name: 'Products', href: '/products' },
    { name: 'Inventory', href: '/inventory' },
    { name: 'POS', href: '/pos' },
  ];

  async logout() {
    await this.authService.logout();
  }
}
