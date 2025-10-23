import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { OfflineStorageService } from '../core/services/offline-storage.service';
import { NetworkService } from '../core/services/network.service';

export const policyGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const offlineStorageService = inject(OfflineStorageService);
  const networkService = inject(NetworkService);
  const router = inject(Router);

  console.log('🛡️ PolicyGuard: Starting policy check for URL:', state.url);
  
  // In offline mode, bypass policy check to avoid chunk loading issues
  if (networkService.isOffline()) {
    console.log('🛡️ PolicyGuard: Offline mode detected - bypassing policy check');
    return true;
  }

  // Check if user is authenticated
  const currentUser = authService.getCurrentUser();
  if (!currentUser) {
    console.log('🛡️ PolicyGuard: No authenticated user, redirecting to login');
    router.navigate(['/login']);
    return false;
  }

  // If user is a visitor, redirect to homepage (visitors don't need policy agreement)
  if (currentUser.roleId === 'visitor') {
    console.log('🛡️ PolicyGuard: Visitor user attempting to access protected route, redirecting to homepage');
    router.navigate(['/']);
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
    
    // In offline mode, allow access rather than redirecting to policy-agreement
    if (networkService.isOffline()) {
      console.log('🛡️ PolicyGuard: Error in offline mode - allowing access to avoid chunk loading issues');
      return true;
    }
    
    // Only redirect to policy agreement if online
    router.navigate(['/policy-agreement']);
    return false;
  }
};