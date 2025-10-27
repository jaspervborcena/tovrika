import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  console.log('🛡️ AuthGuard: Starting check for URL:', state.url);

  // Check if user is authenticated
  if (!authService.isAuthenticated()) {
    console.warn(`🛡️ AuthGuard: Unauthenticated access attempt to ${state.url}`);
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const currentUser = authService.currentUser();
  const currentPermission = authService.getCurrentPermission();

  console.log('🛡️ AuthGuard: Current user:', currentUser?.email, currentUser?.uid);
  console.log('🛡️ AuthGuard: Current permission:', currentPermission);

  const isVisitor = !currentPermission?.companyId || currentPermission.roleId === 'visitor';
  const isCompanyProfileRoute = state.url.includes('/dashboard/company-profile');
  const isOnboardingRoute = state.url === '/onboarding';

  // ✅ Allow visitors to access onboarding and company-profile
  if (isVisitor) {
    if (isOnboardingRoute || isCompanyProfileRoute) {
      console.log('🛡️ AuthGuard: Visitor accessing allowed setup route - allowing');
      return true;
    }
    console.warn('🛡️ AuthGuard: Visitor blocked from protected route, redirecting to onboarding');
    router.navigate(['/onboarding']);
    return false;
  }

  // ✅ Allow access to company-profile if user has no companyId (onboarding)
  if (!currentPermission?.companyId && isCompanyProfileRoute) {
    console.log('🛡️ AuthGuard: No companyId but accessing company-profile - allowing');
    return true;
  }

  // 🚫 Block access if no companyId and not on company-profile
  if (!currentPermission?.companyId) {
    console.warn(`🛡️ AuthGuard: Missing companyId for ${state.url}, redirecting to company-profile`);
    router.navigate(['/dashboard/company-profile']);
    return false;
  }

  // ✅ Allow access to company-selection if user has multiple companies and none selected
  if (authService.hasMultipleCompanies() && !currentPermission?.companyId) {
    if (state.url !== '/company-selection') {
      router.navigate(['/company-selection']);
      return false;
    }
    return true;
  }

  // 🔒 Async role check
  const checkRole = async () => {
    let userRole: string = '';
    if (currentPermission?.companyId && currentUser?.uid && currentPermission?.storeId) {
      const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
      const firestore = getFirestore();
      const userRolesRef = collection(firestore, 'userRoles');
      const userRolesQuery = query(
        userRolesRef,
        where('companyId', '==', currentPermission.companyId),
        where('userId', '==', currentUser.uid),
        where('storeId', '==', currentPermission.storeId)
      );
      const userRolesSnap = await getDocs(userRolesQuery);
      if (!userRolesSnap.empty) {
        const userRoleData = userRolesSnap.docs[0].data();
        userRole = userRoleData['roleId'] || '';
      }
    }

    // ✅ Role-based route restriction
    if (route.data?.['roles']) {
      const requiredRoles = route.data['roles'] as string[];
      if (!userRole || !requiredRoles.includes(userRole)) {
        console.warn(`🛡️ AuthGuard: Insufficient role access. Required: ${requiredRoles.join(', ')}, User: ${userRole}`);
        switch (userRole) {
          case 'visitor':
            router.navigate(['/onboarding']);
            break;
          case 'cashier':
            router.navigate(['/pos']);
            break;
          case 'manager':
            router.navigate(['/dashboard/company-profile']);
            break;
          case 'creator':
            router.navigate(['/dashboard/company-profile']);
            break;
          case 'admin':
            router.navigate(['/dashboard/overview']);
            break;
          default:
            router.navigate(['/dashboard/overview']);
        }
        return false;
      }
    }

    // ✅ Check if user account is active
    if (currentUser?.status !== 'active') {
      console.warn(`🛡️ AuthGuard: Inactive user account attempted access to ${state.url}`);
      router.navigate(['/login']);
      return false;
    }

    return true;
  };

  return checkRole();
};
