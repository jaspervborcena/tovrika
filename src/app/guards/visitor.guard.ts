import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const visitorGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👤 VisitorGuard: Starting check for URL:', state.url);

  const user = authService.currentUser();
  
  if (!user) {
    console.log('👤 VisitorGuard: No user, redirecting to login');
    router.navigate(['/login']);
    return false;
  }

  const currentPermission = authService.getCurrentPermission();
  
  // Check if user is truly a visitor (no company permissions)
  const isVisitor = !currentPermission || 
                   !currentPermission.companyId || 
                   currentPermission.companyId.trim() === '' || 
                   currentPermission.roleId === 'visitor';



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

  // User is NOT a visitor
  // Only block the onboarding route for non-visitors; allow other routes (e.g., /dashboard) to proceed
  if (state.url === '/onboarding') {
    if (currentPermission.roleId === 'cashier') {
      console.log('👤 VisitorGuard: Non-visitor cashier attempting onboarding, redirecting to POS');
      router.navigate(['/pos']);
      return false;
    }
    console.log('👤 VisitorGuard: Non-visitor attempting onboarding, redirecting to dashboard');
    router.navigate(['/dashboard']);
    return false;
  }

  // For all other routes, allow non-visitors to continue
  console.log('👤 VisitorGuard: Non-visitor user, allowing access');
  return true;
};