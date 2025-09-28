import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { StoreService, Store } from '../../services/store.service';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';

import { AccessService } from '../../core/services/access.service';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { AppConstants } from '../../shared/enums';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    RouterOutlet,
    LogoComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  // Closes the user menu dropdown
  protected closeUserMenu() {
    this.isUserMenuOpen.set(false);
  }

  // Logs out the current user
  protected async logout() {
    await this.authService.logout();
  }
  private storeService = inject(StoreService);
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private accessService = inject(AccessService);
  private firestore = inject(Firestore);
  private router = inject(Router);

  // Signals
  protected stores = signal<Store[]>([]);
  protected selectedStoreId = signal<string>('');
  protected selectedStore = computed(() => 
    this.stores().find(store => store.id === this.selectedStoreId())
  );
  
  // App constants
  protected appName = AppConstants.APP_NAME;
  protected totalCompanies = signal<number>(0);
  protected totalStores = signal<number>(0);
  protected totalProducts = signal<number>(0);
  protected currentActivePage = signal<string>('');
  protected recentCompanies = signal<any[]>([]);
  
  // User-related signals
  protected currentUser = computed(() => this.authService.getCurrentUser());
  protected isUserMenuOpen = signal<boolean>(false);
  
  // Computed properties
  protected userInitial = computed(() => {
    const user = this.currentUser();
    if (!user) return 'U';
    
    if (user.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  });

  protected toggleUserMenu() {
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }
  public screenWidth = 0;
  public isMobile = window.innerWidth < 1024;

  constructor() {}

  async ngOnInit() {
    this.screenWidth = window.innerWidth;
    this.isMobile = this.screenWidth < 1024;
    this.loadDashboardData();
    
    // Track current route for active menu item
    this.updateCurrentPage();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateCurrentPage();
    });
    const user = this.currentUser();
    if (!user) return;

    const currentPermission = this.authService.getCurrentPermission();
    console.log('🔍 [Dashboard Debug] currentPermission:', currentPermission);
    console.log('🔍 [Dashboard Debug] user.permissions:', user.permissions);
    
    // Check if BOTH companyId AND storeId exist
    if (!currentPermission?.companyId || !currentPermission?.storeId) {
      console.log('🔍 [Dashboard Debug] Missing companyId or storeId, checking user permissions for role');
      
      // If either companyId or storeId is missing, check user's role directly from permissions
      if (currentPermission?.roleId) {
        console.log('🔍 [Dashboard Debug] Found roleId in permissions:', currentPermission.roleId);
        
        if (currentPermission.roleId === 'cashier') {
          console.log('🔍 [Dashboard Debug] Setting cashier permissions (no storeId/companyId required)');
          this.accessService.setPermissions({}, 'cashier');
          return;
        } else if (currentPermission.roleId === 'store_manager') {
          console.log('🔍 [Dashboard Debug] Setting store_manager permissions (no storeId/companyId required)');
          this.accessService.setPermissions({}, 'store_manager');
          return;
        }
      }
      
      // If no specific role found or role is creator, default to creator (show all)
      console.log('🔍 [Dashboard Debug] No specific role or creator role, setting as creator (show all)');
      this.accessService.setPermissions({}, 'creator');
      return;
    }

    console.log('🔍 [Dashboard Debug] Both companyId and storeId exist, proceeding with userRoles lookup');

    // Try to get roleId from userRoles collection
    const userRolesRef = collection(this.firestore, 'userRoles');
    const userRolesQuery = query(
      userRolesRef,
      where('companyId', '==', currentPermission.companyId),
      where('userId', '==', user.uid),
      where('storeId', '==', currentPermission.storeId || '')
    );
    const userRolesSnap = await getDocs(userRolesQuery);
    let roleId: string | undefined;
    console.log('🔍 [Dashboard Debug] userRolesSnap.empty:', userRolesSnap.empty);
    if (!userRolesSnap.empty) {
      const userRoleData = userRolesSnap.docs[0].data();
      roleId = userRoleData['roleId'];
      console.log('🔍 [Dashboard Debug] Found roleId from userRoles:', roleId);
    } else {
      // Fallback: use roleId from permissions array if available
      if (currentPermission?.roleId) {
        roleId = currentPermission.roleId;
        console.log('🔍 [Dashboard Debug] Using roleId from permissions array:', roleId);
      } else {
        // Final fallback: get user doc from Firestore and check permission field
        const userDocRef = collection(this.firestore, 'users');
        const userDocSnap = await getDocs(query(userDocRef, where('uid', '==', user.uid)));
        if (!userDocSnap.empty) {
          const userDoc = userDocSnap.docs[0].data();
          if (userDoc['permission'] && userDoc['permission']['roleId']) {
            roleId = userDoc['permission']['roleId'];
            console.log('🔍 [Dashboard Debug] Found roleId from user doc:', roleId);
          }
        }
      }
    }

    if (!roleId) {
      // If no roleId found, treat as creator
      console.log('🔍 [Dashboard Debug] No roleId found, setting as creator');
      this.accessService.setPermissions({}, 'creator');
      return;
    }

    console.log('🔍 [Dashboard Debug] Final roleId:', roleId);
    if (roleId === 'cashier') {
      console.log('🔍 [Dashboard Debug] Setting cashier permissions');
      this.accessService.setPermissions({}, 'cashier');
    } else if (roleId === 'store_manager') {
      console.log('🔍 [Dashboard Debug] Setting store_manager permissions');
      this.accessService.setPermissions({}, 'store_manager');
    } else if (roleId === 'creator') {
      console.log('🔍 [Dashboard Debug] Setting creator permissions (built-in role)');
      this.accessService.setPermissions({}, 'creator');
    } else {
      // For other custom roles, use roledefinition permissions
      const roleDefRef = collection(this.firestore, 'roledefinition');
      const roleDefQuery = query(
        roleDefRef,
        where('companyId', '==', currentPermission.companyId),
        where('roleId', '==', roleId)
      );
      const roleDefSnap = await getDocs(roleDefQuery);
      if (!roleDefSnap.empty) {
        const roleDefData = roleDefSnap.docs[0].data();
        if (roleDefData['permissions']) {
          console.log('🔍 [Dashboard Debug] Setting custom role permissions for:', roleId);
          this.accessService.setPermissions(roleDefData['permissions'], roleId);
        } else {
          console.log('🔍 [Dashboard Debug] No custom permissions found, setting as creator');
          this.accessService.setPermissions({}, 'creator');
        }
      } else {
        console.log('🔍 [Dashboard Debug] No role definition found, setting as creator');
        this.accessService.setPermissions({}, 'creator');
      }
    }
  }

  protected onStoreChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedStoreId.set(target.value);
  }

  private async loadDashboardData() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        // Load company-specific data
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        await this.productService.loadProducts(currentPermission.companyId);
        
        this.stores.set(this.storeService.getStores());
        this.totalStores.set(this.stores().length);
        this.totalProducts.set(this.productService.totalProducts());
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  get permissions() {
    const currentPermissions = this.accessService.permissions || {};
    console.log('🔍 [Dashboard] Current permissions getter called:', currentPermissions);
    console.log('🔍 [Dashboard] canViewProducts:', currentPermissions.canViewProducts);
    console.log('🔍 [Dashboard] canViewPOS:', currentPermissions.canViewPOS);
    return currentPermissions;
  }

  private updateCurrentPage() {
    const url = this.router.url;
    
    if (url.includes('/dashboard/company-profile')) {
      this.currentActivePage.set('company-profile');
    } else if (url.includes('/dashboard/stores')) {
      this.currentActivePage.set('stores');
    } else if (url.includes('/dashboard/access')) {
      this.currentActivePage.set('access');
    } else if (url.includes('/dashboard/user-roles')) {
      this.currentActivePage.set('user-roles');
    } else if (url.includes('/dashboard/products')) {
      this.currentActivePage.set('products');
    } else if (url === '/pos' || url.startsWith('/pos/')) {
      this.currentActivePage.set('pos');
    } else if (url.includes('/dashboard/sales/summary')) {
      this.currentActivePage.set('sales-summary');
    } else if (url.includes('/dashboard/inventory')) {
      this.currentActivePage.set('inventory');
    } else {
      this.currentActivePage.set('');
    }
  }

  protected isActiveNavItem(pageName: string): boolean {
    return this.currentActivePage() === pageName;
  }
}
