import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OfflineStorageService } from '../../../core/services/offline-storage.service';
import { AuthService } from '../../../services/auth.service';
import { AppConstants } from '../../../shared/enums';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

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

  async ngOnInit() {
    console.log('📝 Policy Agreement: Initializing...');
    
    // Check if user is authenticated
    const currentAuthUser = this.authService.getCurrentUser();
    console.log('📝 Policy Agreement: Current auth user:', currentAuthUser?.email);
    
    // If no current auth user at all, redirect to login
    if (!currentAuthUser) {
      console.warn('⚠️ Policy Agreement: User not authenticated, redirecting to login');
      await this.router.navigate(['/login']);
      return;
    }

    // User is authenticated, now ensure IndexedDB is synchronized
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
        throw new Error('Failed to save user data to IndexedDB');
      }
      
      if (offlineUser.uid !== currentAuthUser.uid) {
        throw new Error(`User UID mismatch: auth=${currentAuthUser.uid}, offline=${offlineUser.uid}`);
      }

      // Check if already agreed to policies
      if (offlineUser.isAgreedToPolicy) {
        console.log('✅ Policy Agreement: User already agreed, redirecting...');
        // Redirect to appropriate page
        if (this.authService.hasMultipleCompanies()) {
          await this.router.navigate(['/company-selection']);
        } else {
          await this.router.navigate(['/dashboard']);
        }
        return;
      }
      
      console.log('📝 Policy Agreement: Ready for user to accept policies');
      
    } catch (error: any) {
      console.error('❌ Policy Agreement: Failed to initialize offline storage:', error);
      this.error.set(`Failed to initialize user session: ${error?.message || error}. Please try refreshing the page.`);
    }
  }

  async acceptPolicies() {
    if (!this.canProceed()) return;

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
      await this.offlineStorageService.updatePolicyAgreement(true);
      console.log('✅ Policy Agreement: User accepted policies');
      
      // Small delay to ensure data is saved
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the update was successful
      const userData = this.offlineStorageService.currentUser();
      if (!userData?.isAgreedToPolicy) {
        throw new Error('Policy agreement was not saved properly');
      }
      
      // Redirect based on user's authentication state
      const currentPermission = this.authService.getCurrentPermission();
      
      console.log('📍 Policy Agreement: Redirecting user...');
      console.log('📍 User:', currentAuthUser?.email);
      console.log('📍 User permissions:', currentPermission);
      console.log('📍 User has multiple companies:', this.authService.hasMultipleCompanies());
      
      // Determine redirect destination
      if (this.authService.hasMultipleCompanies()) {
        console.log('📍 Redirecting to company selection (multiple companies)');
        await this.router.navigate(['/company-selection']);
      } else if (currentPermission?.companyId) {
        // User has a company, redirect to dashboard
        console.log('📍 Redirecting to dashboard (has company)');
        await this.router.navigate(['/dashboard']);
      } else {
        // User needs to select/create company
        console.log('📍 Redirecting to company selection (no company)');
        await this.router.navigate(['/company-selection']);
      }
    } catch (error: any) {
      console.error('❌ Policy Agreement: Failed to save agreement:', error);
      this.error.set(error.message || 'Failed to save policy agreement. Please try again.');
    } finally {
      this.isLoading.set(false);
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
      console.log('🏠 Policy Agreement: Logo clicked - navigating to home');
      
      // If user hasn't agreed to policies, set policy agreement to false in IndexedDB
      if (!this.agreedToTerms() || !this.agreedToPrivacy()) {
        console.log('📝 Policy Agreement: User has not agreed to policies, setting policy agreement to false');
        
        // Ensure offline storage is initialized
        await this.offlineStorageService.loadOfflineData();
        
        // Set policy agreement to false
        await this.offlineStorageService.updatePolicyAgreement(false);
        
        console.log('📝 Policy Agreement: Policy agreement set to false in IndexedDB');
      }
      
      // Navigate to home page without logging in
      await this.router.navigate(['/']);
      
    } catch (error: any) {
      console.error('❌ Policy Agreement: Error handling logo click:', error);
      // Still navigate even if there's an error with storage
      await this.router.navigate(['/']);
    }
  }
}