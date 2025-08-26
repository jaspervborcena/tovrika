import { Component, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent],
  template: `
    <div class="min-h-screen bg-gray-100 relative">
      <!-- Header/Navigation -->
      <header class="bg-white/95 backdrop-blur-md shadow-sm fixed top-0 left-0 w-full z-[9999] border-b-2 border-gray-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex justify-between items-center h-12">
            <div class="flex items-center">
              <div class="flex items-center">
                <div class="h-7 w-7 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                  <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 class="text-xl font-bold text-gray-900">
                  <a routerLink="/" class="hover:text-primary-600 transition-colors">Tovrika</a>
                </h1>
              </div>
              <span class="ml-3 px-2 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">POS System</span>
            </div>
            
            <div class="flex items-center space-x-1">
              <!-- Help Icon -->
              <a routerLink="/help" 
                 class="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors duration-200 flex items-center"
                 title="Help & Support">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </a>
              
              <!-- Notifications Icon -->
              <a routerLink="/notifications" 
                 class="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors duration-200 relative flex items-center"
                 title="Notifications">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </a>
              
              <!-- Authentication Section -->
              @if (!isAuthenticated()) {
                <ui-button routerLink="/login" variant="primary" size="sm" class="ml-2">
                  <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </ui-button>
              } @else {
                <!-- User Menu -->
                <div class="relative" data-user-menu>
                  <button 
                    (click)="toggleUserMenu()"
                    class="flex items-center space-x-2 p-2 text-sm bg-gray-50 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-colors duration-200 border border-gray-200">
                    <!-- User Avatar -->
                    <div class="h-7 w-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium border border-primary-200">
                      {{ userInitials() }}
                    </div>
                    <div class="hidden md:block text-left">
                      <div class="text-gray-900 font-medium text-sm">{{ userName() }}</div>
                      <div class="text-gray-500 text-xs">Home</div>
                    </div>
                    <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  <!-- User Menu Dropdown -->
                  @if (isUserMenuOpen) {
                    <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <div class="px-4 py-2 border-b border-gray-100">
                        <div class="text-sm font-medium text-gray-900">{{ currentUser()?.displayName || 'User' }}</div>
                        <div class="text-xs text-gray-500">{{ currentUser()?.email }}</div>
                      </div>
                      
                      <a routerLink="/dashboard" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <svg class="inline w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                        </svg>
                        Dashboard
                      </a>
                      
                      <a routerLink="/notifications" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <svg class="inline w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Notifications
                      </a>
                      
                      <div class="border-t border-gray-100 mt-1 pt-1">
                        <button 
                          (click)="logout()" 
                          class="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                          <svg class="inline w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- Content -->
      <main class="mt-24">
        <ng-content></ng-content>
      </main>
    </div>
  `
})
export class MainLayoutComponent {
  private authService = inject(AuthService);
  
  isAuthenticated = this.authService.isAuthenticated;
  isUserMenuOpen = false;

  // Computed properties for user information
  protected currentUser = computed(() => this.authService.currentUser());
  
  protected userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    
    if (user.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  });

  protected userName = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    return (user.displayName || user.email)?.split('@')[0] || '';
  });

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Close user menu when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('[data-user-menu]')) {
      this.isUserMenuOpen = false;
    }
  }

  async logout() {
    await this.authService.logout();
    this.isUserMenuOpen = false;
  }
}
