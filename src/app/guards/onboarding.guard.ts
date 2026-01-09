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

  // TEMPORARY: Complete bypass for POS routes to test functionality
  if (state.url.includes('/pos')) {
    console.log('🛡️ OnboardingGuard: COMPLETE POS BYPASS ENABLED - Skipping all onboarding checks');
    console.warn('⚠️ POS is running in bypass mode - this is for testing the invoice functionality only');
    return true;
  }

  const user = authService.currentUser();

  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  const currentPermission = authService.getCurrentPermission();
  
  // NEW: Skip onboarding for users with valid company permissions
  if (currentPermission && 
      currentPermission.companyId && 
      currentPermission.companyId.trim() !== '' && 
      currentPermission.roleId !== 'visitor' &&
      (currentPermission.roleId === 'creator' || currentPermission.roleId === 'store_manager' || currentPermission.roleId === 'cashier')) {
    return true;
  }
  
  console.log('🛡️ OnboardingGuard: Checking access for:', state.url);
  
  // TEMPORARY: Allow POS access for testing (bypass company check for POS routes)
  if (state.url.includes('/pos') && !currentPermission?.companyId) {
    console.log('🛡️ OnboardingGuard: TEMPORARY BYPASS - Allowing POS access without company setup');
    console.warn('⚠️ POS is running without proper company setup - this is for testing only');
    return true;
  }
  
  // Step 1: Check company profile
  if (!currentPermission?.companyId) {
    console.log('🛡️ OnboardingGuard: No company ID, redirecting to company-profile');
    router.navigate(['/dashboard/company-profile']);
    return false;
  }

  await companyService.loadCompanies();
  const company = await companyService.getActiveCompany();
  
  // TEMPORARY: Allow POS access for testing (bypass company check for POS routes)
  if (state.url.includes('/pos') && !company) {
    console.log('🛡️ OnboardingGuard: TEMPORARY BYPASS - Allowing POS access without active company');
    console.warn('⚠️ POS is running without active company - this is for testing only');
    return true;
  }
  
  if (!company) {
    console.log('🛡️ OnboardingGuard: No active company found, redirecting to company-profile');
    router.navigate(['/dashboard/company-profile']);
    return false;
  }
  
  console.log('🛡️ OnboardingGuard: Company found:', company.name);

  // Step 2: Check stores
  await storeService.loadStoresByCompany(currentPermission.companyId);
  const stores = storeService.getStoresByCompany(currentPermission.companyId);
  
  console.log('🛡️ OnboardingGuard: Stores found:', stores?.length || 0);

  // NOTE: Role checks are handled by roleGuard now. Keep onboarding-focused logic only.

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

    // Check if user has access to any valid store
    // If user has a single storeId, check if it matches any store
    let hasValidStore = false;
    if (currentPermission?.storeId) {
      hasValidStore = stores.some(store => store.id === currentPermission.storeId);
    }

    if (!hasValidStore && !state.url.includes('stores')) {
      router.navigate(['/dashboard/stores']);
      return false;
    }

    // Role-based access is handled by roleGuard. OnboardingGuard won't enforce roles.

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

  // Check if user is a visitor (no company permissions yet)
  const currentPermission = authService.getCurrentPermission();
  const isVisitor = !currentPermission || 
                   !currentPermission.companyId || 
                   currentPermission.companyId.trim() === '' || 
                   currentPermission.roleId === 'visitor';

  // Allow visitors to access company profile to create their first company
  if (isVisitor) {
    console.log('CompanyProfileGuard: Allowing visitor to access company profile for setup');
    return true;
  }

  // Use permission-based access control for existing users
  if (!accessService.canView('canViewCompanyProfile')) {
    console.warn('CompanyProfileGuard: Insufficient permission for company profile');
    router.navigate(['/dashboard/overview']);
    return false;
  }
  return true;
};
