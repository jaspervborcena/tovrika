import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const visitorGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👤 VisitorGuard: Starting check for URL:', state.url);

  const user = authService.currentUser();
  console.log('👤 VisitorGuard: Current user:', user?.email, user?.uid);
  
  if (!user) {
    console.log('👤 VisitorGuard: No user, redirecting to login');
    router.navigate(['/login']);
    return false;
  }

  const currentPermission = authService.getCurrentPermission();
  console.log('👤 VisitorGuard: Current permission:', currentPermission);
  
  // Check if user is truly a visitor (no company permissions)
  const isVisitor = !currentPermission || 
                   !currentPermission.companyId || 
                   currentPermission.companyId.trim() === '' || 
                   currentPermission.roleId === 'visitor';

  console.log('👤 VisitorGuard: Checking visitor status', {
    isVisitor,
    currentPermission,
    requestedUrl: state.url,
    hasPermission: !!currentPermission,
    hasCompanyId: !!currentPermission?.companyId,
    companyIdValue: currentPermission?.companyId,
    roleIdValue: currentPermission?.roleId
  });

  if (isVisitor) {
    if (state.url === '/onboarding') {
      console.log('👤 VisitorGuard: User is visitor, allowing access to onboarding');
      return true;
    } if (state.url === '/dashboard/company-profile') {
      console.log('👤 VisitorGuard: User is visitor, allowing access to onboarding');
      return true;
    } else {
      console.log('👤 VisitorGuard: Visitor trying to access non-onboarding route, redirecting to onboarding');
      router.navigate(['/onboarding']);
      return false;
    }
  }

  // User is not a visitor, redirect to appropriate page based on role
  if (currentPermission.roleId === 'cashier') {
    console.log('👤 VisitorGuard: Cashier detected, redirecting to POS');
    router.navigate(['/pos']);
    return false;
  } else {
    console.log('👤 VisitorGuard: Non-visitor user detected, redirecting to dashboard');
    router.navigate(['/dashboard']);
    return false;
  }
};