import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { AppConstants } from '../../shared/enums';
import { NetworkService } from '../../core/services/network.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private networkService = inject(NetworkService);

  // Expose authentication state to template
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly currentUser = this.authService.currentUser;
  readonly userRole = this.authService.userRole;
  
  // User menu state
  protected isUserMenuOpen = signal<boolean>(false);
  
  // Expose app constants and network status to template
  readonly isOnline = this.networkService.isOnline;
  readonly appName = computed(() => 
    this.isOnline() ? AppConstants.APP_NAME : AppConstants.APP_NAME_OFFLINE
  );
  readonly headerClass = computed(() => 
    this.isOnline() ? 'home-header' : 'home-header offline'
  );

  navigateToDashboard() {
    // Navigate based on user role
    const role = this.userRole();
    const currentUser = this.currentUser();
    
    // If user is a visitor, they don't have access to dashboard
    if (currentUser?.roleId === 'visitor') {
      // Could show a message or upgrade prompt here
      return;
    }
    
    // Navigate based on role for business users
    if (role === 'cashier') {
      this.router.navigate(['/pos']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
  
  protected toggleUserMenu() {
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }
  
  protected closeUserMenu() {
    this.isUserMenuOpen.set(false);
  }

  async logout() {
    this.closeUserMenu();
    await this.authService.logout();
  }

  // Debug method to test offline mode
  toggleOfflineMode() {
    const currentStatus = this.networkService.getCurrentStatus();
    this.networkService.setOfflineMode(currentStatus);
    
    // Force change detection after a short delay
    setTimeout(() => {
      void this.isOnline();
      void this.headerClass();
      void this.appName();
    }, 200);
  }
}
