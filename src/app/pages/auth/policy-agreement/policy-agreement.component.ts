import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, NavigationError, NavigationCancel } from '@angular/router';
import { OfflineStorageService } from '../../../core/services/offline-storage.service';
import { SqliteStorageService } from '../../../core/services/sqlite-storage.service';
import { AuthService } from '../../../services/auth.service';
import { AppConstants } from '../../../shared/enums';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { filter } from 'rxjs';

@Component({
  selector: 'app-policy-agreement',
  standalone: true,
  imports: [CommonModule, FormsModule, LogoComponent],
  templateUrl: './policy-agreement.component.html',
  styleUrls: ['./policy-agreement.component.css']
})
export class PolicyAgreementComponent implements OnInit {
  private offlineStorageService = inject(OfflineStorageService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private sqliteService = inject(SqliteStorageService);

  // App constants
  readonly appName = AppConstants.APP_NAME;

  // Component state
  isLoading = signal(false);
  agreedToTerms = signal(false);
  agreedToPrivacy = signal(false);
  showTermsModal = signal(false);
  showPrivacyModal = signal(false);
  error = signal('');

  // Computed
  canProceed = () => this.agreedToTerms() && this.agreedToPrivacy() && !this.isLoading();

  // Debug method - can be called from browser console
  debugStatus() {
    console.log('🔍 DEBUG STATUS:', {
      agreedToTerms: this.agreedToTerms(),
      agreedToPrivacy: this.agreedToPrivacy(),
      isLoading: this.isLoading(),
      canProceed: this.canProceed(),
      currentUser: this.authService.getCurrentUser()?.email,
      currentPermission: this.authService.getCurrentPermission()
    });
  }

  // Emergency method to clear loading state - can be called from browser console
  clearLoading() {
    console.log('🚨 EMERGENCY: Clearing loading state...');
    this.isLoading.set(false);
    this.error.set('');
  }

  // Method to manually navigate to onboarding - can be called from browser console
  async forceNavigateToOnboarding() {
    console.log('🚨 EMERGENCY: Force navigating to onboarding...');
    try {
      const result = await this.router.navigate(['/onboarding']);
      console.log('🚨 EMERGENCY: Navigation result:', result);
      return result;
    } catch (error: any) {
      console.error('🚨 EMERGENCY: Navigation error:', error);
      return false;
    }
  }

  // Simple method to navigate by URL - can be called from browser console
  async forceNavigateByUrl() {
    console.log('🚨 EMERGENCY: Force navigating by URL...');
    try {
      const result = await this.router.navigateByUrl('/onboarding');
      console.log('🚨 EMERGENCY: navigateByUrl result:', result);
      return result;
    } catch (error: any) {
      console.error('🚨 EMERGENCY: navigateByUrl error:', error);
      return false;
    }
  }

  // Method to test guards manually - can be called from browser console
  testGuards() {
    console.log('🔍 TESTING GUARDS:');
    
    // Test authentication
    const isAuthenticated = this.authService.isAuthenticated();
    console.log('🔍 isAuthenticated:', isAuthenticated);
    
    // Test current user
    const currentUser = this.authService.currentUser();
    console.log('🔍 currentUser:', currentUser?.email, currentUser?.uid);
    
    // Test current permission
    const currentPermission = this.authService.getCurrentPermission();
    console.log('🔍 currentPermission:', currentPermission);
    
    // Test visitor status
    const isVisitor = !currentPermission || 
                     !currentPermission.companyId || 
                     currentPermission.companyId.trim() === '' || 
                     currentPermission.roleId === 'visitor';
    console.log('🔍 isVisitor:', isVisitor);
    
    // Test policy agreement status
    const offlineUser = this.offlineStorageService.currentUser();
    console.log('🔍 offlineUser policy status:', offlineUser?.isAgreedToPolicy);
    
    return {
      isAuthenticated,
      currentUser: currentUser?.email,
      currentPermission,
      isVisitor,
      policyAgreed: offlineUser?.isAgreedToPolicy
    };
  }

  async ngOnInit() {
    console.log('🚀 POLICY AGREEMENT: Component initializing...');
    
    // Expose component for debugging
    (window as any).policyComponent = this;
    console.log('🔧 DEBUG: Component exposed as window.policyComponent - use window.policyComponent.debugStatus()');
    
    // Subscribe to router events to debug navigation issues
    this.router.events.pipe(
      filter(event => event instanceof NavigationError || event instanceof NavigationCancel)
    ).subscribe(event => {
      if (event instanceof NavigationError) {
        console.error('🚨 ROUTER: Navigation error:', event);
        console.error('🚨 ROUTER: Error target:', event.url);
        console.error('🚨 ROUTER: Error reason:', event.error);
      } else if (event instanceof NavigationCancel) {
        console.warn('🚨 ROUTER: Navigation cancelled:', event);
        console.warn('🚨 ROUTER: Cancel target:', event.url);
        console.warn('🚨 ROUTER: Cancel reason:', event.reason);
      }
    });
    
    // Wait for user authentication to be fully loaded
    // This handles race condition where navigation happens before auth state is fully set
    let currentAuthUser = this.authService.getCurrentUser();
    console.log('🚀 POLICY AGREEMENT: Initial auth user check:', currentAuthUser?.email);
    
    if (!currentAuthUser) {
      console.log('🚀 POLICY AGREEMENT: User not immediately available, waiting for auth state...');
      // Wait up to 3 seconds for auth state to be set
      const maxWaitTime = 3000;
      const checkInterval = 100;
      let elapsed = 0;
      
      while (!currentAuthUser && elapsed < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
        currentAuthUser = this.authService.getCurrentUser();
        if (currentAuthUser) {
          console.log('🚀 POLICY AGREEMENT: User authenticated after waiting:', currentAuthUser.email);
          break;
        }
      }
    }
    
    // If still no current auth user after waiting, redirect to login
    if (!currentAuthUser) {
      console.warn('⚠️ Policy Agreement: User not authenticated after waiting, redirecting to login');
      await this.router.navigate(['/login']);
      return;
    }
    
    console.log('🚀 POLICY AGREEMENT: User authenticated:', currentAuthUser.email);

    // User is authenticated, now ensure SQLite is synchronized
    try {
      console.log('📝 Policy Agreement: Ensuring offline storage is synchronized...');
      console.log('📝 Policy Agreement: Current auth user:', currentAuthUser.email);
      
      // Clear all existing user data and save only the current authenticated user
      console.log('📝 Policy Agreement: Clearing old user data and saving current user...');
      await this.offlineStorageService.saveUserSession({
        ...currentAuthUser,
        isAgreedToPolicy: false
      });
      
      // Verify the user was saved correctly
      const offlineUser = this.offlineStorageService.currentUser();
      console.log('📝 Policy Agreement: Saved offline user:', offlineUser?.email);
      
      if (!offlineUser) {
        throw new Error('Failed to save user data to SQLite');
      }
      
      if (offlineUser.uid !== currentAuthUser.uid) {
        throw new Error(`User UID mismatch: auth=${currentAuthUser.uid}, offline=${offlineUser.uid}`);
      }

      // Check if already agreed to policies
      if (offlineUser.isAgreedToPolicy) {
        console.log('✅ Policy Agreement: User already agreed, redirecting to onboarding...');
        await this.router.navigate(['/onboarding']);
        return;
      }
      
      console.log('📝 Policy Agreement: Ready for user to accept policies');
      
    } catch (error: any) {
      console.error('❌ Policy Agreement: Failed to initialize offline storage:', error);
      this.error.set(`Failed to initialize user session: ${error?.message || error}. Please try refreshing the page.`);
    }
  }

  async acceptPolicies() {
    console.log('🔄 Policy Agreement: acceptPolicies() called');
    console.log('🔄 Policy Agreement: canProceed():', this.canProceed());
    console.log('🔄 Policy Agreement: agreedToTerms:', this.agreedToTerms());
    console.log('🔄 Policy Agreement: agreedToPrivacy:', this.agreedToPrivacy());
    console.log('🔄 Policy Agreement: isLoading:', this.isLoading());
    
    if (!this.canProceed()) {
      console.log('🔄 Policy Agreement: Cannot proceed, exiting');
      return;
    }

    console.log('🔄 Policy Agreement: Setting loading to true...');
    this.isLoading.set(true);
    this.error.set('');

    try {
      console.log('📝 Policy Agreement: Starting policy acceptance process...');
      
      // Verify we still have an authenticated user
      const currentAuthUser = this.authService.getCurrentUser();
      if (!currentAuthUser) {
        throw new Error('No current user found - please log in again');
      }
      
      // Update policy agreement (offline user should already exist from ngOnInit)
      console.log('📝 Policy Agreement: About to call updatePolicyAgreement(true)...');
      
      // Add timeout to prevent hanging
      const updatePromise = this.offlineStorageService.updatePolicyAgreement(true);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('updatePolicyAgreement timeout after 10 seconds')), 10000)
      );
      
      await Promise.race([updatePromise, timeoutPromise]);
      console.log('✅ Policy Agreement: User accepted policies');
      
      // Small delay to ensure data is saved
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the update was successful
      const userData = this.offlineStorageService.currentUser();
      if (!userData?.isAgreedToPolicy) {
        throw new Error('Policy agreement was not saved properly');
      }

      // Persist acceptance flags in SQLite settings so the guard can bypass next time
      try {
        const uid = currentAuthUser.uid;
        // Save both flags under settings (TovrikaOfflineDB.settings)
        await this.sqliteService.saveSetting(`isPolicyAgree_${uid}`, true);
        await this.sqliteService.saveSetting(`isTermsAgree_${uid}`, true);
        console.log('📝 Policy Agreement: Persisted isPolicyAgree and isTermsAgree in SQLite');
      } catch (flagErr) {
        console.warn('📝 Policy Agreement: Failed to persist acceptance flags to SQLite', flagErr);
      }
      
      // Determine where to redirect based on user status
      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      
      console.log('📍 Policy Agreement: Determining redirect path for user:', currentUser?.email);
      console.log('📍 Policy Agreement: Current user permissions:', currentUser?.permissions);
      console.log('📍 Policy Agreement: Current permission:', currentPermission);
      
      // Check if user has valid company permissions (not visitor)
      const hasValidPermissions = currentPermission && 
                                 currentPermission.companyId && 
                                 currentPermission.companyId.trim() !== '' && 
                                 currentPermission.roleId !== 'visitor';
                                 
      console.log('📍 Policy Agreement: hasValidPermissions:', hasValidPermissions);
      
      if (hasValidPermissions) {
        // Redirect based on role
        if (currentPermission.roleId === 'cashier') {
          console.log('📍 Policy Agreement: Cashier user, redirecting to POS...');
          await this.router.navigate(['/pos']);
        } else {
          console.log('📍 Policy Agreement: User has valid permissions, redirecting to dashboard...');
          await this.router.navigate(['/dashboard']);
        }
      } else {
        console.log('📍 Policy Agreement: User needs onboarding, redirecting to onboarding...');
        console.log('📍 Policy Agreement: About to navigate to /onboarding...');
        
        // Pre-navigation guard check
        console.log('📍 Policy Agreement: Pre-navigation guard check:');
        const guardTest = this.testGuards();
        console.log('📍 Policy Agreement: Guard test result:', guardTest);
        
        try {
          const navigationResult = await this.router.navigate(['/onboarding']);
          console.log('📍 Policy Agreement: Navigation result:', navigationResult);
          
          if (!navigationResult) {
            console.error('❌ Policy Agreement: Navigation to onboarding failed!');
            console.error('❌ Policy Agreement: Router returned false - checking for navigation errors...');
            this.error.set('Failed to redirect to onboarding. Please try refreshing the page.');
          } else {
            console.log('✅ Policy Agreement: Successfully navigated to onboarding');
          }
        } catch (navigationError: any) {
          console.error('❌ Policy Agreement: Navigation threw an error:', navigationError);
          console.error('❌ Policy Agreement: Error type:', typeof navigationError);
          console.error('❌ Policy Agreement: Error message:', navigationError?.message);
          console.error('❌ Policy Agreement: Error stack:', navigationError?.stack);
          this.error.set(`Navigation error: ${navigationError?.message || navigationError}. Please try refreshing the page.`);
        }
      }
    } catch (error: any) {
      console.error('❌ Policy Agreement: Failed to save agreement:', error);
      console.error('❌ Policy Agreement: Error details:', error);
      this.error.set(error.message || 'Failed to save policy agreement. Please try again.');
    } finally {
      console.log('🔄 Policy Agreement: Setting loading to false...');
      this.isLoading.set(false);
      console.log('🔄 Policy Agreement: acceptPolicies() completed');
    }
  }

  openTermsModal() {
    this.showTermsModal.set(true);
  }

  openPrivacyModal() {
    this.showPrivacyModal.set(true);
  }

  closeModals() {
    this.showTermsModal.set(false);
    this.showPrivacyModal.set(false);
  }

  onTermsChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.agreedToTerms.set(checkbox?.checked || false);
  }

  onPrivacyChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.agreedToPrivacy.set(checkbox?.checked || false);
  }

  async handleLogoClick() {
    try {
      console.log('🏠 Policy Agreement: Logo clicked - checking user status...');
      
      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      
      // Check if user is a visitor
      const isVisitor = !currentPermission || 
                       !currentPermission.companyId || 
                       currentPermission.companyId.trim() === '' || 
                       currentPermission.roleId === 'visitor';
      
      if (isVisitor) {
        console.log('🏠 Policy Agreement: User is visitor - their home is onboarding');
        
        // If user hasn't agreed to policies yet, update policy agreement to false
        if (!this.agreedToTerms() || !this.agreedToPrivacy()) {
          console.log('📝 Policy Agreement: User has not agreed to policies, setting policy agreement to false');
          
          // Ensure offline storage is initialized
          await this.offlineStorageService.loadOfflineData();
          
          // Set policy agreement to false
          await this.offlineStorageService.updatePolicyAgreement(false);
          
          console.log('📝 Policy Agreement: Policy agreement set to false in SQLite');
        }
        
        // For visitors, navigate to onboarding (their home)
        await this.router.navigate(['/onboarding']);
      } else {
        console.log('🏠 Policy Agreement: User has company access - navigating to public home');
        
        // If user hasn't agreed to policies, set policy agreement to false in SQLite
        if (!this.agreedToTerms() || !this.agreedToPrivacy()) {
          console.log('📝 Policy Agreement: User has not agreed to policies, setting policy agreement to false');
          
          // Ensure offline storage is initialized
          await this.offlineStorageService.loadOfflineData();
          
          // Set policy agreement to false
          await this.offlineStorageService.updatePolicyAgreement(false);
          
          console.log('📝 Policy Agreement: Policy agreement set to false in SQLite');
        }
        
        // Navigate to home page
        await this.router.navigate(['/']);
      }
      
    } catch (error: any) {
      console.error('❌ Policy Agreement: Error handling logo click:', error);
      // Still navigate based on user type even if there's an error with storage
      const currentPermission = this.authService.getCurrentPermission();
      const isVisitor = !currentPermission || 
                       !currentPermission.companyId || 
                       currentPermission.companyId.trim() === '' || 
                       currentPermission.roleId === 'visitor';
      
      if (isVisitor) {
        await this.router.navigate(['/onboarding']);
      } else {
        await this.router.navigate(['/']);
      }
    }
  }
}