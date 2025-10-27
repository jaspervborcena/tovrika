import { Routes, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { authGuard } from './guards/auth.guard';
import { onboardingGuard, companyProfileGuard } from './guards/onboarding.guard';
import { policyGuard } from './guards/policy.guard';
import { cashierGuard } from './guards/cashier.guard';
import { visitorGuard } from './guards/visitor.guard';
import { AuthService } from './services/auth.service';

export const routes: Routes = [
  // Public Routes - but visitors should go to onboarding
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
      const authService = inject(AuthService);
      const router = inject(Router);
      
      // If user is authenticated, check if they're a visitor
      if (authService.isAuthenticated()) {
        const currentPermission = authService.getCurrentPermission();
        const isVisitor = !currentPermission || 
                         !currentPermission.companyId || 
                         currentPermission.companyId.trim() === '' || 
                         currentPermission.roleId === 'visitor';
        
        if (isVisitor) {
          console.log('🏠 HomeGuard: Visitor trying to access home, redirecting to onboarding');
          router.navigate(['/onboarding']);
          return false;
        }
      }
      
      return true;
    }]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent)
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
    canActivate: [authGuard, policyGuard, cashierGuard,visitorGuard],
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
  canActivate: [onboardingGuard],
  data: { roles: ['creator', 'store_manager'] }
      },
      {
  path: 'stores',
  loadComponent: () => import('./pages/dashboard/stores-management/stores-management.component').then(m => m.StoresManagementComponent),
  canActivate: [onboardingGuard],
  data: { roles: ['creator', 'store_manager'] }
      },
      {
  path: 'branches',
  loadComponent: () => import('./pages/dashboard/branches/branches.component').then(m => m.BranchesComponent),
  canActivate: [onboardingGuard],
  data: { roles: ['creator', 'store_manager'] }
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
  canActivate: [onboardingGuard],
  data: { roles: ['creator'] }
      },
      {
  path: 'invoice-setup',
  loadComponent: () => import('./pages/dashboard/invoice-setup/invoice-setup.component').then(m => m.InvoiceSetupComponent),
  data: { roles: ['creator', 'store_manager'] }
      },
      {
  path: 'products',
  loadComponent: () => import('./pages/dashboard/products/product-management.component').then(m => m.ProductManagementComponent),
  canActivate: [onboardingGuard],
  data: { roles: ['creator', 'store_manager'] }
      },
      {
  path: 'inventory',
  loadComponent: () => import('./pages/dashboard/inventory/inventory.component').then(m => m.InventoryComponent),
  canActivate: [onboardingGuard],
  data: { roles: ['creator', 'store_manager'] }
      },

      {
        path: 'sales/summary',
        loadComponent: () => import('./pages/dashboard/sales/sales-summary/sales-summary.component').then(m => m.SalesSummaryComponent),
        canActivate: [onboardingGuard],
        data: { roles: ['creator', 'store_manager'] }
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
    canActivate: [authGuard, policyGuard, onboardingGuard],
    data: { roles: ['creator', 'store_manager', 'cashier'] }
  },

  // Mobile POS Route - Accessible by creator, store_manager, and cashier
  {
    path: 'pos/mobile',
    loadComponent: () => import('./pages/dashboard/pos/mobile/pos-mobile.component').then(m => m.PosMobileComponent),
    canActivate: [authGuard, policyGuard, onboardingGuard],
    data: { roles: ['creator', 'store_manager', 'cashier'] }
  },

  // Mobile Receipt Preview Route - Accessible by creator, store_manager, and cashier
  {
    path: 'pos/mobile/receipt-preview',
    loadComponent: () => import('./pages/dashboard/pos/mobile/mobile-receipt-preview.component').then(m => m.MobileReceiptPreviewComponent),
    canActivate: [authGuard, policyGuard, onboardingGuard],
    data: { roles: ['creator', 'store_manager', 'cashier'] }
  },
  
  // Fallback route
  {
    path: '**',
    redirectTo: ''
  }
];