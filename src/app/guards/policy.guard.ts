import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { OfflineStorageService } from '../core/services/offline-storage.service';

export const policyGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const offlineStorageService = inject(OfflineStorageService);
  const router = inject(Router);

  // Check if user is authenticated
  const currentUser = authService.getCurrentUser();
  if (!currentUser) {
    router.navigate(['/login']);
    return false;
  }

  // Check if user has agreed to policy
  const userData = offlineStorageService.currentUser();
  const hasAgreedToPolicy = userData?.isAgreedToPolicy ?? false;

  console.log('🛡️ PolicyGuard: User policy agreement status:', hasAgreedToPolicy);
  console.log('🛡️ PolicyGuard: User data:', userData);
  console.log('🛡️ PolicyGuard: Trying to access:', state.url);

  if (!hasAgreedToPolicy) {
    // If trying to access policy-agreement page, allow it
    if (state.url === '/policy-agreement') {
      return true;
    }
    
    // Otherwise redirect to policy agreement
    console.log('🛡️ PolicyGuard: Redirecting to policy agreement');
    router.navigate(['/policy-agreement']);
    return false;
  }

  return true;
};