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

  const currentPermission = authService.getCurrentPermission();
  // Step 1: Check company profile
  if (!currentPermission?.companyId) {
    router.navigate(['/dashboard/company-profile']);
    return false;
  }

  await companyService.loadCompanies();
  const company = await companyService.getActiveCompany();
  if (!company) {
    router.navigate(['/dashboard/company-profile']);
    return false;
  }

  // Step 2: Check stores
  await storeService.loadStoresByCompany(currentPermission.companyId);
  const stores = storeService.getStoresByCompany(currentPermission.companyId);

  // Role-based access control (move up so userRole is always defined)
  let userRole: string | undefined;
  try {
    const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
    const firestore = getFirestore();
    const userRolesRef = collection(firestore, 'userRoles');
    let foundUserRole = false;
    if (stores && stores.length === 1) {
      const storeId = stores[0].id;
      const userRolesQuery = query(
        userRolesRef,
        where('companyId', '==', currentPermission.companyId),
        where('userId', '==', user.uid),
        where('storeId', '==', storeId)
      );
      const userRolesSnap = await getDocs(userRolesQuery);
      if (!userRolesSnap.empty) {
        const userRoleData = userRolesSnap.docs[0].data();
        userRole = userRoleData['roleId'];
        foundUserRole = true;
      }
    } else if (stores) {
      for (const store of stores) {
        const storeId = store.id;
        const userRolesQuery = query(
          userRolesRef,
          where('companyId', '==', currentPermission.companyId),
          where('userId', '==', user.uid),
          where('storeId', '==', storeId)
        );
        const userRolesSnap = await getDocs(userRolesQuery);
        if (!userRolesSnap.empty) {
          const userRoleData = userRolesSnap.docs[0].data();
          userRole = userRoleData['roleId'];
          foundUserRole = true;
          break;
        }
      }
    }
    if (!foundUserRole && currentPermission?.roleId) {
      userRole = currentPermission.roleId;
    }
  } catch (roleError) {
    if (currentPermission?.roleId) {
      userRole = currentPermission.roleId;
    }
  }

  // If cashier, always allow POS route
  if (userRole === 'cashier' && state.url.includes('pos')) {
    return true;
  }

  // Creator role has full access to all routes
  if (userRole === 'creator') {
    return true;
  }

  // Store manager has access to most routes including POS
  if (userRole === 'store_manager' && state.url.includes('pos')) {
    return true;
  }

  if (!stores || stores.length === 0) {
    // Only allow onboarding routes if no stores exist
    if (state.url.includes('stores') || state.url.includes('products')) {
      return true;
    }
    // Restrict other routes, redirect to stores management
    router.navigate(['/dashboard/stores']);
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
    await storeService.loadStoresByCompany(currentPermission.companyId);
    const stores = storeService.getStoresByCompany(currentPermission.companyId);

    // Role-based access control (move up so userRole is always defined)
    let userRole: string | undefined;
    try {
      const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
      const firestore = getFirestore();
      const userRolesRef = collection(firestore, 'userRoles');
      let foundUserRole = false;
      if (stores.length === 1) {
        const storeId = stores[0].id;
        const userRolesQuery = query(
          userRolesRef,
          where('companyId', '==', currentPermission.companyId),
          where('userId', '==', user.uid),
          where('storeId', '==', storeId)
        );
        const userRolesSnap = await getDocs(userRolesQuery);
        if (!userRolesSnap.empty) {
          const userRoleData = userRolesSnap.docs[0].data();
          userRole = userRoleData['roleId'];
          foundUserRole = true;
        }
      } else {
        for (const store of stores) {
          const storeId = store.id;
          const userRolesQuery = query(
            userRolesRef,
            where('companyId', '==', currentPermission.companyId),
            where('userId', '==', user.uid),
            where('storeId', '==', storeId)
          );
          const userRolesSnap = await getDocs(userRolesQuery);
          if (!userRolesSnap.empty) {
            const userRoleData = userRolesSnap.docs[0].data();
            userRole = userRoleData['roleId'];
            foundUserRole = true;
            break;
          }
        }
      }
      if (!foundUserRole && currentPermission?.roleId) {
        userRole = currentPermission.roleId;
      }
    } catch (roleError) {
      if (currentPermission?.roleId) {
        userRole = currentPermission.roleId;
      }
    }

    // Check if user has access to any valid store
    // If user has a single storeId, check if it matches any store
    let hasValidStore = false;
    if (currentPermission?.storeId) {
      hasValidStore = stores.some(store => store.id === currentPermission.storeId);
    }

    // If cashier, always allow POS route
    if (userRole === 'cashier' && state.url.includes('pos')) {
      return true;
    }

    // Creator role has full access to all routes
    if (userRole === 'creator') {
      return true;
    }

    // Store manager has access to most routes including POS
    if (userRole === 'store_manager' && state.url.includes('pos')) {
      return true;
    }

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
        let foundUserRole = false;
        if (stores.length === 1) {
          // Only one store, no need to loop
          const storeId = stores[0].id;
          const userRolesQuery = query(
            userRolesRef,
            where('companyId', '==', currentPermission.companyId),
            where('userId', '==', user.uid),
            where('storeId', '==', storeId)
          );
          const userRolesSnap = await getDocs(userRolesQuery);
          if (!userRolesSnap.empty) {
            const userRoleData = userRolesSnap.docs[0].data();
            userRole = userRoleData['roleId'];
            foundUserRole = true;
            console.log(`[OnboardingGuard] Single store - Role: ${userRole}, Store: ${storeId}`);
          }
        } else {
          // Multiple stores, loop through stores
          for (const store of stores) {
            const storeId = store.id;
            const userRolesQuery = query(
              userRolesRef,
              where('companyId', '==', currentPermission.companyId),
              where('userId', '==', user.uid),
              where('storeId', '==', storeId)
            );
            const userRolesSnap = await getDocs(userRolesQuery);
            if (!userRolesSnap.empty) {
              const userRoleData = userRolesSnap.docs[0].data();
              userRole = userRoleData['roleId'];
              foundUserRole = true;
              console.log(`[OnboardingGuard] Multi-store - Role: ${userRole}, Store: ${storeId}`);
              break;
            }
          }
        }
        // Fallback to currentPermission.roleId if no userRoles found
        if (!foundUserRole && currentPermission?.roleId) {
          userRole = currentPermission.roleId;
          console.log('[OnboardingGuard] Fallback to currentPermission.roleId:', userRole);
        }
      } catch (roleError) {
        console.error('[OnboardingGuard] Error fetching userRoles:', roleError);
        // Fallback to currentPermission.roleId if error
        if (currentPermission?.roleId) {
          userRole = currentPermission.roleId;
          console.log('[OnboardingGuard] Fallback to currentPermission.roleId (error):', userRole);
        }
      }

      // If no userRole found, treat as 'creator' for first login
      if (!userRole) {
        userRole = 'creator';
      }
      if (!requiredRoles.includes(userRole)) {
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


export const companyProfileGuard: CanActivateFn = () => {
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
