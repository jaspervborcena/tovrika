import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { onboardingGuard, companyProfileGuard } from './guards/onboarding.guard';

export const routes: Routes = [
  // Public Routes
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
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
    path: 'help',
    loadComponent: () => import('./pages/help/help.component').then(m => m.HelpComponent)
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
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'company-profile',
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
        data: { roles: ['admin', 'manager'] }
      },
      {
        path: 'stores',
        loadComponent: () => import('./pages/dashboard/stores-management/stores-management.component').then(m => m.StoresManagementComponent),
        canActivate: [onboardingGuard],
        data: { roles: ['admin', 'manager'] }
      },
      {
        path: 'branches',
        loadComponent: () => import('./pages/dashboard/branches/branches.component').then(m => m.BranchesComponent),
        canActivate: [onboardingGuard],
        data: { roles: ['admin', 'manager'] }
      },
      {
        path: 'access',
        loadComponent: () => import('./pages/dashboard/access/access.component').then(m => m.AccessComponent),
        canActivate: [onboardingGuard],
        data: { roles: ['admin', 'manager'] }
      },
      {
        path: 'user-roles',
        loadComponent: () => import('./pages/dashboard/user-roles/user-roles.component').then(m => m.UserRolesComponent),
        canActivate: [onboardingGuard],
        data: { roles: ['admin', 'manager'] }
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/dashboard/products/product-management.component').then(m => m.ProductManagementComponent),
        canActivate: [onboardingGuard],
        data: { roles: ['admin', 'manager'] }
      },
      {
        path: 'inventory',
        loadComponent: () => import('./pages/dashboard/inventory/inventory.component').then(m => m.InventoryComponent),
        canActivate: [onboardingGuard],
        data: { roles: ['admin', 'manager'] }
      },
      {
        path: 'pos',
        loadComponent: () => import('./pages/dashboard/pos/pos.component').then(m => m.PosComponent)
        // Temporarily removed guards for testing: canActivate: [onboardingGuard],
        // data: { roles: ['admin', 'manager', 'cashier'] }
      },
      {
        path: 'pos/mobile',
        loadComponent: () => import('./pages/dashboard/pos/mobile/pos-mobile.component').then(m => m.PosMobileComponent)
        // Temporarily removed guards for testing: canActivate: [onboardingGuard],
        // data: { roles: ['admin', 'manager', 'cashier'] }
      }
    ]
  },
  
  // Protected standalone routes
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [authGuard]
  },
  
  
  
  // Standalone POS Route (originally existed)
  {
    path: 'pos',
    loadComponent: () => import('./pages/dashboard/pos/pos.component').then(m => m.PosComponent)
    // Temporarily removed guards: canActivate: [authGuard],
    // data: { roles: ['admin', 'manager', 'cashier'] }
  },
  
  // Mobile POS Route
  {
    path: 'pos/mobile',
    loadComponent: () => import('./pages/dashboard/pos/mobile/pos-mobile.component').then(m => m.PosMobileComponent)
    // Temporarily removed guards: canActivate: [authGuard],
    // data: { roles: ['admin', 'manager', 'cashier'] }
  },
  
  // Fallback route
  {
    path: '**',
    redirectTo: ''
  }
];