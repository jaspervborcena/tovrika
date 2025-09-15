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
    console.warn('OnboardingGuard: No authenticated user');
    router.navigate(['/login']);
    return false;
  }

  if (!user.companyId) {
    console.warn('OnboardingGuard: User has no company association');
    router.navigate(['/dashboard/company-profile']);
    return false;
  }

  try {
    // Check if company profile exists
    await companyService.loadCompanies();
    const company = await companyService.getActiveCompany();
    
    if (!company) {
      console.info('OnboardingGuard: No company profile found, redirecting to setup');
      router.navigate(['/dashboard/company-profile']);
      return false;
    }

    // Check if company has stores
    await storeService.loadStoresByCompany(user.companyId);
    const stores = storeService.getStoresByCompany(user.companyId);
    
    if (stores.length === 0 && !state.url.includes('stores')) {
      console.info('OnboardingGuard: No stores configured, redirecting to stores setup');
      router.navigate(['/dashboard/stores']);
      return false;
    }

    // Check role-based access
    if (route.data?.['roles']) {
      const requiredRoles = route.data['roles'] as string[];
      const userRole = authService.userRole();
      
      console.log(`OnboardingGuard: Role check - Required: [${requiredRoles.join(', ')}], User: ${userRole}, URL: ${state.url}`);
      
      if (!userRole || !requiredRoles.includes(userRole)) {
        console.warn(`OnboardingGuard: Role check failed. Required: ${requiredRoles.join(', ')}, User: ${userRole}`);
        router.navigate(['/dashboard/overview']);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('OnboardingGuard: Error checking company setup', error);
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
