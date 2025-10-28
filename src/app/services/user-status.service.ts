import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserStatusService {
  private authService = inject(AuthService);

  // Computed property to determine if user is a visitor
  readonly isVisitor = computed(() => {
    const currentPermission = this.authService.getCurrentPermission();
    return !currentPermission || 
           !currentPermission.companyId || 
           currentPermission.companyId.trim() === '' || 
           currentPermission.roleId === 'visitor';
  });

  // Computed property to determine if user has valid business permissions
  readonly hasBusinessAccess = computed(() => {
    const currentPermission = this.authService.getCurrentPermission();
    return currentPermission && 
           currentPermission.companyId && 
           currentPermission.companyId.trim() !== '' && 
           ['creator', 'store_manager', 'cashier'].includes(currentPermission.roleId);
  });

  // Computed property to determine if user needs onboarding
  readonly needsOnboarding = computed(() => {
    return this.isVisitor();
  });

  // Helper method to get user role display name
  getUserRoleDisplayName(): string {
    const currentPermission = this.authService.getCurrentPermission();
    if (!currentPermission) return 'Visitor';
    
    switch (currentPermission.roleId) {
      case 'creator': return 'Business Owner';
      case 'store_manager': return 'Store Manager';
      case 'cashier': return 'Cashier';
      case 'visitor': return 'Visitor';
      default: return 'Unknown';
    }
  }

  // Helper method to determine default route after login
  getDefaultRoute(): string {
    if (this.isVisitor()) {
      return '/onboarding';
    }
    
    const currentPermission = this.authService.getCurrentPermission();
    if (currentPermission?.roleId === 'cashier') {
      return '/pos';
    }
    
    return '/dashboard';
  }
}