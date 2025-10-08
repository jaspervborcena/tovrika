import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { OfflineStorageService } from '../core/services/offline-storage.service';

export const policyGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const offlineStorageService = inject(OfflineStorageService);
  const router = inject(Router);

  console.log('🛡️ PolicyGuard: Starting policy check for URL:', state.url);

  // Check if user is authenticated
  const currentUser = authService.getCurrentUser();
  if (!currentUser) {
    console.log('🛡️ PolicyGuard: No authenticated user, redirecting to login');
    router.navigate(['/login']);
    return false;
  }

  // If trying to access policy-agreement page, allow it
  if (state.url === '/policy-agreement') {
    console.log('🛡️ PolicyGuard: Allowing access to policy-agreement page');
    return true;
  }

  try {
    // Ensure offline storage is loaded
    await offlineStorageService.loadOfflineData();
    
    // Check if user has agreed to policy
    const userData = offlineStorageService.currentUser();
    const hasAgreedToPolicy = userData?.isAgreedToPolicy ?? false;

    console.log('🛡️ PolicyGuard: User policy agreement status:', hasAgreedToPolicy);
    console.log('🛡️ PolicyGuard: User data exists:', !!userData);
    console.log('🛡️ PolicyGuard: User UID match:', userData?.uid === currentUser.uid);

    if (!hasAgreedToPolicy) {
      console.log('🛡️ PolicyGuard: User has not agreed to policy, redirecting');
      router.navigate(['/policy-agreement']);
      return false;
    }

    console.log('🛡️ PolicyGuard: Policy check passed, allowing access');
    return true;
  } catch (error) {
    console.error('🛡️ PolicyGuard: Error checking policy status:', error);
    // On error, redirect to policy agreement to be safe
    router.navigate(['/policy-agreement']);
    return false;
  }
};