import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    console.warn(`AuthGuard: Unauthenticated access attempt to ${state.url}`);
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  const currentUser = authService.currentUser();

  // Allow access to company-profile if user has no companyId (onboarding)
  if (!currentUser?.permission?.companyId) {
    if (state.url.includes('/dashboard/company-profile')) {
      // Treat as creator for onboarding
      return true;
    }
    console.warn(`AuthGuard: User missing company access for ${state.url}`);
    router.navigate(['/dashboard/company-profile']);
    return false;
  }

  // Async role check
  const checkRole = async () => {
    let userRole: string = '';
  if (currentUser?.permission?.companyId && currentUser?.uid && currentUser?.permission?.storeId) {
      const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
      const firestore = getFirestore();
      const userRolesRef = collection(firestore, 'userRoles');
      const userRolesQuery = query(
        userRolesRef,
  where('companyId', '==', currentUser.permission?.companyId),
        where('userId', '==', currentUser.uid),
  where('storeId', '==', currentUser.permission?.storeId)
      );
      const userRolesSnap = await getDocs(userRolesQuery);
      if (!userRolesSnap.empty) {
        const userRoleData = userRolesSnap.docs[0].data();
        userRole = userRoleData['roleId'] || '';
      }
    }

    // Check for specific role requirements if specified in route data
    if (route.data?.['roles']) {
      const requiredRoles = route.data['roles'] as string[];
      if (!userRole || !requiredRoles.includes(userRole)) {
        console.warn(`AuthGuard: Insufficient role access. Required: ${requiredRoles.join(', ')}, User: ${userRole}`);
        // Redirect based on user role
        switch (userRole) {
          case 'cashier':
            router.navigate(['/dashboard/pos']);
            break;
          case 'manager':
            router.navigate(['/dashboard/overview']);
            break;
          case 'admin':
            router.navigate(['/dashboard/overview']);
            break;
          default:
            router.navigate(['/dashboard']);
        }
        return false;
      }
    }

    // Check if user account is active
    if (currentUser?.status !== 'active') {
      console.warn(`AuthGuard: Inactive user account attempted access to ${state.url}`);
      router.navigate(['/login']);
      return false;
    }
    return true;
  };

  // Return a promise for async guard
  return checkRole();
};
