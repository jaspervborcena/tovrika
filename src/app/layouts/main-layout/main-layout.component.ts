import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header/Navigation -->
      <header class="bg-white shadow-sm fixed w-full z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex justify-between items-center">
            <div class="flex items-center">
              <h1 class="text-2xl font-bold text-primary-600">
                <a routerLink="/" class="hover:text-primary-500">JasperPOS</a>
              </h1>
            </div>
            <div class="flex items-center space-x-4">
              <a routerLink="/help" class="text-gray-600 hover:text-gray-900">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </a>
              <a routerLink="/notifications" class="text-gray-600 hover:text-gray-900">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </a>
              <ng-container *ngIf="!isAuthenticated(); else userMenu">
                <ui-button routerLink="/login">Sign In</ui-button>
              </ng-container>
              <ng-template #userMenu>
                <div class="relative">
                  <button
                    (click)="toggleUserMenu()"
                    class="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <span class="sr-only">Open user menu</span>
                    <div class="h-8 w-8 rounded-full bg-primary-500 text-white flex items-center justify-center">
                      {{ userInitials() }}
                    </div>
                  </button>
                  <div
                    *ngIf="isUserMenuOpen"
                    class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                    role="menu"
                  >
                    <div class="py-1" role="none">
                      <a
                        routerLink="/dashboard"
                        class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        Dashboard
                      </a>
                      <button
                        (click)="logout()"
                        class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              </ng-template>
            </div>
          </div>
        </div>
      </header>

      <!-- Content -->
      <div class="pt-16">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class MainLayoutComponent {
  private authService = inject(AuthService);
  
  isAuthenticated = this.authService.isAuthenticated;
  isUserMenuOpen = false;

  userInitials = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return '';
    return user.displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  });

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  async logout() {
    await this.authService.logout();
    this.isUserMenuOpen = false;
  }
}
