import { AccessService } from '../core/services/access.service';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CompanyService } from '../services/company.service';
import { StoreService } from '../services/store.service';

export const onboardingGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const companyService = inject(CompanyService);
  const storeService = inject(StoreService);
  const router = inject(Router);

  const user = authService.currentUser();

  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  if (!user.companyId) {
    router.navigate(['/dashboard/company-profile']);
    return false;
  }

  try {
    // Load and validate company
    await companyService.loadCompanies();
    const company = await companyService.getActiveCompany();
    if (!company) {
      router.navigate(['/dashboard/company-profile']);
      return false;
    }

    // Load stores for the company
    await storeService.loadStoresByCompany(user.companyId);
    const stores = storeService.getStoresByCompany(user.companyId);

    // Check if user has access to any valid store
    const hasValidStore = user.storeIds?.some(storeId =>
      stores.some(store => store.id === storeId)
    );

    if (!hasValidStore && !state.url.includes('stores')) {
      router.navigate(['/dashboard/stores']);
      return false;
    }

    // Role-based access control
    if (route.data?.['roles']) {
      const requiredRoles = route.data['roles'] as string[];
      let userRole: string | undefined;

      try {
        const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
        const firestore = getFirestore();
        const userRolesRef = collection(firestore, 'userRoles');

        // Use stores from storeService for role lookup
        if (stores.length === 1) {
          // Only one store, no need to loop
          const storeId = stores[0].id;
          const userRolesQuery = query(
            userRolesRef,
            where('companyId', '==', user.companyId),
            where('userId', '==', user.uid),
            where('storeId', '==', storeId)
          );
          const userRolesSnap = await getDocs(userRolesQuery);
          if (!userRolesSnap.empty) {
            const userRoleData = userRolesSnap.docs[0].data();
            userRole = userRoleData['roleId'];
            console.log(`[OnboardingGuard] Single store - Role: ${userRole}, Store: ${storeId}`);
          }
        } else {
          // Multiple stores, loop through stores
          for (const store of stores) {
            const storeId = store.id;
            const userRolesQuery = query(
              userRolesRef,
              where('companyId', '==', user.companyId),
              where('userId', '==', user.uid),
              where('storeId', '==', storeId)
            );
            const userRolesSnap = await getDocs(userRolesQuery);
            if (!userRolesSnap.empty) {
              const userRoleData = userRolesSnap.docs[0].data();
              userRole = userRoleData['roleId'];
              console.log(`[OnboardingGuard] Multi-store - Role: ${userRole}, Store: ${storeId}`);
              break;
            }
          }
        }
      } catch (roleError) {
        console.error('[OnboardingGuard] Error fetching userRoles:', roleError);
      }

      if (!userRole || !requiredRoles.includes(userRole)) {
        router.navigate(['/dashboard/overview']);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[OnboardingGuard] Unexpected error:', error);
    router.navigate(['/dashboard/company-profile']);
    return false;
  }
};


export const companyProfileGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const accessService = inject(AccessService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (!user) {
    console.warn('CompanyProfileGuard: No authenticated user');
    router.navigate(['/login']);
    return false;
  }

  // Use permission-based access control
  if (!accessService.canView('canViewCompanyProfile')) {
    console.warn('CompanyProfileGuard: Insufficient permission for company profile');
    router.navigate(['/dashboard/overview']);
    return false;
  }
  return true;
};
