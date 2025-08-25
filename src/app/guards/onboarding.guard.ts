import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CompanySetupService } from '../services/companySetup.service';

export const onboardingGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const companyService = inject(CompanySetupService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  // For now, allow all routes - we'll implement proper onboarding flow later
  // TODO: Check company profile completion and guide user through onboarding
  
  return true;
};

export const companyProfileGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  if (!user) {
    router.navigate(['/login']);
    return false;
  }
  
  // Allow access to company profile setup
  return true;
};
