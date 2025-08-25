import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { onboardingGuard, companyProfileGuard } from './guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  // Customer Display Route (no guards needed)
  {
    path: 'customer-view/:sessionId',
    loadComponent: () => import('./pages/customer-view/customer-view.component').then(m => m.CustomerViewComponent)
  },
  // Auth Routes
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent)
  },
  // Main Dashboard Routes
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
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
      // These routes require onboarding completion
      {
        path: 'overview',
        loadComponent: () => import('./pages/dashboard/overview/overview.component').then(m => m.OverviewComponent),
        canActivate: [onboardingGuard]
      },
      {
        path: 'stores',
        loadComponent: () => import('./pages/dashboard/stores/stores.component').then(m => m.StoresComponent),
        canActivate: [onboardingGuard]
      },
      {
        path: 'branches',
        loadComponent: () => import('./pages/dashboard/branches/branches.component').then(m => m.BranchesComponent),
        canActivate: [onboardingGuard]
      },
      {
        path: 'access',
        loadComponent: () => import('./pages/dashboard/access/access.component').then(m => m.AccessComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/dashboard/products/products.component').then(m => m.ProductsComponent)
      },
      {
        path: 'inventory',
        loadComponent: () => import('./pages/dashboard/inventory/inventory.component').then(m => m.InventoryComponent)
      },
      {
        path: 'pos',
        loadComponent: () => import('./pages/pos/pos.component').then(m => m.PosComponent)
      }
    ]
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'help',
    loadComponent: () => import('./pages/help/help.component').then(m => m.HelpComponent)
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
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    data: { roles: ['admin', 'manager'] }
  },
  {
    path: 'stores',
    loadComponent: () => import('./pages/stores/stores.component').then(m => m.StoresComponent),
    canActivate: [authGuard],
    data: { roles: ['admin', 'manager'] }
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent),
    canActivate: [authGuard],
    data: { roles: ['admin', 'manager'] }
  },
  {
    path: 'inventory',
    loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent),
    canActivate: [authGuard],
    data: { roles: ['admin', 'manager'] }
  },
  {
    path: 'pos',
    loadComponent: () => import('./pages/pos/pos.component').then(m => m.PosComponent),
    canActivate: [authGuard],
    data: { roles: ['admin', 'manager', 'cashier'] }
  }
];