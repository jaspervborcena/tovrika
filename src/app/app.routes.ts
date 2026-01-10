

import { Routes, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { authGuard } from './guards/auth.guard';
import { onboardingGuard, companyProfileGuard } from './guards/onboarding.guard';
import { policyGuard } from './guards/policy.guard';
import { cashierGuard } from './guards/cashier.guard';
import { visitorGuard } from './guards/visitor.guard';
import { AuthService } from './services/auth.service';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  // Public Routes - but visitors should go to onboarding
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
      const authService = inject(AuthService);
      const router = inject(Router);
      
      // Wait for Firebase auth state to be restored (max 3 seconds)
      let attempts = 0;
      const maxAttempts = 30; // 3 seconds (30 * 100ms)
      
      while (authService['isLoading']() && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      console.log('🏠 Root Guard: Auth state loaded after', attempts * 100, 'ms');
      
      // If user is authenticated, check where they should be redirected
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        const currentPermission = authService.getCurrentPermission();
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        
        console.log('🏠 Root Guard: Authenticated user detected', {
          email: currentUser?.email,
          rememberMe,
          hasPermission: !!currentPermission,
          hasCompanyId: !!currentPermission?.companyId
        });
        
        const isVisitor = !currentPermission || 
                         !currentPermission.companyId || 
                         currentPermission.companyId.trim() === '' || 
                         currentPermission.roleId === 'visitor';
        
        // If remember me is enabled and user is authenticated, redirect to appropriate page
        if (rememberMe) {
          if (isVisitor) {
            console.log('🏠 Root Guard: Visitor with remember me - redirecting to onboarding');
            router.navigate(['/onboarding']);
            return false;
          } else {
            console.log('🏠 Root Guard: User with remember me - redirecting to dashboard');
            router.navigate(['/dashboard']);
            return false;
          }
        }
        
        // If not remember me but is visitor, go to onboarding
        if (isVisitor) {
          console.log('🏠 Root Guard: Visitor without remember me - redirecting to onboarding');
          router.navigate(['/onboarding']);
          return false;
        }
      }
      
      return true;
    }]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
      const authService = inject(AuthService);
      const router = inject(Router);
      
      // Wait for Firebase auth state to be restored (max 3 seconds)
      let attempts = 0;
      const maxAttempts = 30; // 3 seconds (30 * 100ms)
      
      while (authService['isLoading']() && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // If user is already authenticated with remember me, redirect them
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        const currentPermission = authService.getCurrentPermission();
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        
        if (rememberMe) {
          const isVisitor = !currentPermission || 
                           !currentPermission.companyId || 
                           currentPermission.companyId.trim() === '' || 
                           currentPermission.roleId === 'visitor';
          
          if (isVisitor) {
            console.log('🔐 Login Guard: Redirecting authenticated visitor to onboarding');
            router.navigate(['/onboarding']);
          } else {
            console.log('🔐 Login Guard: Redirecting authenticated user to dashboard');
            router.navigate(['/dashboard']);
          }
          return false;
        }
      }
      
      return true;
    }]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./pages/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard, visitorGuard]
  },
  {
    path: 'join-store',
    loadComponent: () => import('./pages/join-store/join-store.component').then(m => m.JoinStoreComponent)
  },
  {
    path: 'policy-agreement',
    // Remove authGuard to prevent circular dependencies during chunk errors
    loadComponent: () => import('./pages/auth/policy-agreement/policy-agreement.component')
      .then(m => m.PolicyAgreementComponent)
      .catch(error => {
        console.warn('🔄 Policy agreement component failed to load, triggering reload:', error);
        setTimeout(() => window.location.reload(), 100);
        throw error;
      })
  },
  {
    path: 'company-selection',
    canActivate: [authGuard, policyGuard],
    loadComponent: () => import('./pages/company-selection/company-selection.component').then(m => m.CompanySelectionComponent)
  },
  {
    path: 'help',
    loadComponent: () => import('./pages/help/help.component').then(m => m.HelpComponent)
  },
  {
    path: 'account-settings',
    loadComponent: () => import('./pages/account-settings/account-settings.component').then(m => m.AccountSettingsComponent)
  },
  {
    path: 'print-setup',
    loadComponent: () => import('./pages/print-setup/print-setup.component').then(m => m.PrintSetupComponent)
  },
  
  // Import Utility Route (admin use only)
  {
    path: 'import',
    loadComponent: () => import('./pages/import/import.component').then(m => m.ImportComponent)
  },
  
  // Customer Display Route (no authentication needed)
  {
    path: 'customer-view/:sessionId',
    loadComponent: () => import('./pages/customer-view/customer-view.component').then(m => m.CustomerViewComponent)
  },
  
  // Feature Detail Routes (public marketing pages)
  {
    path: 'features/inventory',
    loadComponent: () => import('./pages/features/inventory/feature-inventory.component').then(m => m.FeatureInventoryComponent)
  },
  {
    path: 'features/reports',
    loadComponent: () => import('./pages/features/reports/feature-reports.component').then(m => m.FeatureReportsComponent)
  },
  {
    path: 'features/multistore',
    loadComponent: () => import('./pages/features/multistore/feature-multistore.component').then(m => m.FeatureMultistoreComponent)
  },
  {
    path: 'features/offline',
    loadComponent: () => import('./pages/features/offline/feature-offline.component').then(m => m.FeatureOfflineComponent)
  },
  {
    path: 'features/cloudsync',
    loadComponent: () => import('./pages/features/cloudsync/feature-cloudsync.component').then(m => m.FeatureCloudSyncComponent)
  },
  

  // Protected Routes - Main Dashboard
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    // Simplify parent guards; use roleGuard on children where roles are specified
    canActivate: [authGuard, policyGuard],
    children: [
      {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full'
      },
      {
        path: 'company-profile',
        loadComponent: () => import('./pages/dashboard/company-profile/company-profile.component').then(m => m.CompanyProfileComponent),
        canActivate: [companyProfileGuard]
      },
      // Routes requiring onboarding completion
      {
  path: 'overview',
  loadComponent: () => import('./pages/dashboard/overview/overview.component').then(m => m.OverviewComponent),
  canActivate: [onboardingGuard, roleGuard],
  data: { roles: ['creator', 'store_manager', 'admin'] }
      },
      {
  path: 'stores',
  loadComponent: () => import('./pages/dashboard/stores-management/stores-management.component').then(m => m.StoresManagementComponent),
  canActivate: [onboardingGuard, roleGuard],
  data: { roles: ['creator', 'store_manager', 'admin'] }
      },
      {
  path: 'branches',
  loadComponent: () => import('./pages/dashboard/branches/branches.component').then(m => m.BranchesComponent),
  canActivate: [onboardingGuard, roleGuard],
  data: { roles: ['creator', 'store_manager', 'admin'] }
      },
      {
  path: 'access',
  loadComponent: () => import('./pages/dashboard/access/access.component').then(m => m.AccessComponent)
      },
      {
  path: 'user-roles',
  loadComponent: () => import('./pages/dashboard/user-roles/user-roles.component').then(m => m.UserRolesComponent)
      },
      {
  path: 'subscriptions',
  loadComponent: () => import('./pages/dashboard/subscriptions/subscriptions.component').then(m => m.SubscriptionsComponent),
  canActivate: [onboardingGuard, roleGuard],
  data: { roles: ['creator', 'admin'] }
      },
      {
  path: 'admin',
  loadComponent: () => import('./pages/dashboard/admin/admin.component').then(m => m.AdminComponent),
  canActivate: [onboardingGuard, roleGuard],
  data: { roles: ['admin'] }
      },
      {
  path: 'invoice-setup',
  loadComponent: () => import('./pages/dashboard/invoice-setup/invoice-setup.component').then(m => m.InvoiceSetupComponent),
  canActivate: [roleGuard],
  data: { roles: ['creator', 'store_manager', 'admin'] }
      },
      {
  path: 'products',
  loadComponent: () => import('./pages/dashboard/products/product-management.component').then(m => m.ProductManagementComponent),
  canActivate: [onboardingGuard, roleGuard],
  data: { roles: ['creator', 'store_manager', 'admin'] }
      },
        {
      path: 'inventory',
      loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent),
      canActivate: [onboardingGuard, roleGuard],
      data: { roles: ['creator', 'store_manager', 'admin'] }
        },

      {
        path: 'sales/summary',
        loadComponent: () => import('./pages/dashboard/sales/sales-summary/sales-summary.component').then(m => m.SalesSummaryComponent),
        canActivate: [onboardingGuard, roleGuard],
        data: { roles: ['creator', 'store_manager', 'admin'] }
      }
      ,
      {
        path: 'reconciliation',
        loadComponent: () => import('./pages/dashboard/reconciliation/reconciliation.component').then(m => m.ReconciliationComponent),
        canActivate: [onboardingGuard, roleGuard],
        data: { roles: ['creator', 'store_manager', 'admin'] }
      }
    ]
  },
  
  // Protected standalone routes
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [authGuard, policyGuard]
  },
  
  
  
  // Standalone POS Route - Accessible by creator, store_manager, and cashier
  {
    path: 'pos',
    loadComponent: () => import('./pages/dashboard/pos/pos.component').then(m => m.PosComponent),
    canActivate: [authGuard, policyGuard, onboardingGuard, roleGuard],
    data: { roles: ['creator', 'store_manager', 'cashier', 'admin'] }
  },

  // Mobile POS Route - Accessible by creator, store_manager, and cashier
  {
    path: 'pos/mobile',
    loadComponent: () => import('./pages/dashboard/pos/mobile/pos-mobile.component').then(m => m.PosMobileComponent),
    canActivate: [authGuard, policyGuard, onboardingGuard, roleGuard],
    data: { roles: ['creator', 'store_manager', 'cashier', 'admin'] }
  },

  // Mobile Receipt Preview Route - Accessible by creator, store_manager, and cashier
  {
    path: 'pos/mobile/receipt-preview',
    loadComponent: () => import('./pages/dashboard/pos/mobile/mobile-receipt-preview.component').then(m => m.MobileReceiptPreviewComponent),
    canActivate: [authGuard, policyGuard, onboardingGuard, roleGuard],
    data: { roles: ['creator', 'store_manager', 'cashier', 'admin'] }
  },

  // BACKUP Mobile POS Route for Testing - Uses print.service.bak.ts
  {
    path: 'pos/mobile-bak',
    loadComponent: () => import('./pages/dashboard/pos/mobile_bak/pos-mobile.component').then(m => m.PosMobileBakComponent),
    canActivate: [authGuard, policyGuard, onboardingGuard, roleGuard],
    data: { roles: ['creator', 'store_manager', 'cashier', 'admin'] }
  },

  // BACKUP Mobile Receipt Preview Route for Testing
  {
    path: 'pos/mobile-bak/receipt-preview',
    loadComponent: () => import('./pages/dashboard/pos/mobile_bak/mobile-receipt-preview.component').then(m => m.MobileReceiptPreviewBakComponent),
    canActivate: [authGuard, policyGuard, onboardingGuard, roleGuard],
    data: { roles: ['creator', 'store_manager', 'cashier', 'admin'] }
  },
  
  // Fallback route
  {
    path: '**',
    redirectTo: ''
  }
];