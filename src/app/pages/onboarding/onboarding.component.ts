import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { AppConstants } from '../../shared/enums';
import { NetworkService } from '../../core/services/network.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private networkService = inject(NetworkService);

  // Expose authentication state to template (same as home component)
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly currentUser = this.authService.currentUser;
  readonly userRole = this.authService.userRole;
  
  // Expose app constants and network status to template
  readonly isOnline = this.networkService.isOnline;
  readonly appName = computed(() => 
    this.isOnline() ? AppConstants.APP_NAME : AppConstants.APP_NAME_OFFLINE
  );
  readonly headerClass = computed(() => 
    this.isOnline() ? 'home-header' : 'home-header offline'
  );

  navigateToDashboard() {
    const role = this.userRole();
    const currentUser = this.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    
    // Check if user has valid permissions (not visitor)
    const isVisitor = !currentPermission || 
                     !currentPermission.companyId || 
                     currentPermission.companyId.trim() === '' || 
                     currentPermission.roleId === 'visitor';
    
    if (isVisitor) {
      return;
    }
    
    if (role === 'cashier') {
      this.router.navigate(['/pos']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  async logout() {
    await this.authService.logout();
  }

  // Check if user is a visitor
  isVisitorUser() {
    const currentPermission = this.authService.getCurrentPermission();
    return !currentPermission || 
           !currentPermission.companyId || 
           currentPermission.companyId.trim() === '' || 
           currentPermission.roleId === 'visitor';
  }

  // Debug method to test offline mode
  toggleOfflineMode() {
    const currentStatus = this.networkService.getCurrentStatus();
    this.networkService.setOfflineMode(currentStatus);
    setTimeout(() => {
      void this.isOnline();
      void this.headerClass();
      void this.appName();
    }, 200);
  }

  // Onboarding actions
  async navigateToCreateStore() {
  try {
    const currentPermission = this.authService.getCurrentPermission();
    const isVisitor = !currentPermission?.companyId || currentPermission.roleId === 'visitor';

    if (!isVisitor) {
      console.warn('🏪 Onboarding: User is not a visitor, redirecting to dashboard');
      await this.router.navigate(['/dashboard']);
      return;
    }

    await this.router.navigate(['/dashboard/company-profile']);
  } catch (error) {
    console.error('🏪 Onboarding: Error navigating to company profile:', error);
    await this.router.navigate(['/dashboard']);
  }
}

  async navigateToJoinStore() {
    try {
      await this.router.navigate(['/join-store']);
    } catch {
      await this.router.navigate(['/join-store']);
    }
  }
}
