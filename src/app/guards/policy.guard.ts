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

  // If user has previously accepted policy & terms (persisted via IndexedDB), allow.
  try {
    const accepted = await authService.hasAcceptedPolicyAndTerms(currentUser.uid);
    if (accepted) {
      console.log('🛡️ PolicyGuard: User has accepted policy & terms (IndexedDB), allowing access');
      return true;
    }
  } catch (e) {
    console.warn('🛡️ PolicyGuard: Error checking acceptance flags, falling back to existing checks', e);
  }

  // Check if user is a visitor based on current permission (more reliable than user.roleId)
  const currentPermission = authService.getCurrentPermission();
  const isVisitor = !currentPermission || 
                   !currentPermission.companyId || 
                   currentPermission.companyId.trim() === '' || 
                   currentPermission.roleId === 'visitor';

  // Allow visitors to access company profile for initial setup
  if (isVisitor && state.url.includes('/dashboard/company-profile')) {
    console.log('🛡️ PolicyGuard: Visitor accessing company profile for setup - allowing');
    return true;
  }

  if (isVisitor) {
    console.log('🛡️ PolicyGuard: Visitor user attempting to access protected route, blocking (onboarding-only)');
    return false;
  }

  // If trying to access policy-agreement page, allow it
  if (state.url === '/policy-agreement') {
    console.log('🛡️ PolicyGuard: Allowing access to policy-agreement page');
    return true;
  }

  try {
    // Fast-path: trust in-memory acceptance first to avoid race with IndexedDB reload
    let userData = offlineStorageService.currentUser();
    let hasAgreedToPolicy = userData?.isAgreedToPolicy ?? false;

    if (!hasAgreedToPolicy) {
      // Slow-path: reload from IndexedDB only if needed
      await offlineStorageService.loadOfflineData();
      userData = offlineStorageService.currentUser();
      hasAgreedToPolicy = userData?.isAgreedToPolicy ?? false;
    }

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