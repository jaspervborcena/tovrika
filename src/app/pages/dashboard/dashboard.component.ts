import { Component, OnInit, computed, inject, signal, HostListener } from '@angular/core';
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
import { NetworkService } from '../../core/services/network.service';
import { TranslationService, Language } from '../../services/translation.service';

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
  private networkService = inject(NetworkService);
  private translationService = inject(TranslationService);

  // Signals
  protected stores = signal<Store[]>([]);
  protected selectedStoreId = signal<string>('');
  protected selectedStore = computed(() => 
    this.stores().find(store => store.id === this.selectedStoreId())
  );
  
  // Header visibility control
  protected isHeaderVisible = signal<boolean>(false);
  protected isCompactMode = signal<boolean>(false);
  
  // Translation signals
  protected currentLanguage = computed(() => this.translationService.currentLanguage());
  protected availableLanguages = computed(() => this.translationService.availableLanguages);
  protected isLanguageMenuOpen = signal<boolean>(false);
  
  // App constants and network status
  protected isOnline = computed(() => this.networkService.isOnline());
  protected appName = computed(() => 
    this.isOnline() ? AppConstants.APP_NAME : AppConstants.APP_NAME_OFFLINE
  );
  protected headerClass = computed(() => 
    this.isOnline() ? 'dashboard-header' : 'dashboard-header offline'
  );
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
    
    // Check if BOTH companyId AND storeId exist
    if (!currentPermission?.companyId || !currentPermission?.storeId) {
      
      // If either companyId or storeId is missing, check user's role directly from permissions
      if (currentPermission?.roleId) {
        
        if (currentPermission.roleId === 'cashier') {
          this.accessService.setPermissions({}, 'cashier');
          return;
        } else if (currentPermission.roleId === 'store_manager') {
          this.accessService.setPermissions({}, 'store_manager');
          return;
        }
      }
      
      // If no specific role found or role is creator, default to creator (show all)
      this.accessService.setPermissions({}, 'creator');
      return;
    }


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
    if (!userRolesSnap.empty) {
      const userRoleData = userRolesSnap.docs[0].data();
      roleId = userRoleData['roleId'];
    } else {
      // Fallback: use roleId from permissions array if available
      if (currentPermission?.roleId) {
        roleId = currentPermission.roleId;
      } else {
        // Final fallback: get user doc from Firestore and check permission field
        const userDocRef = collection(this.firestore, 'users');
        const userDocSnap = await getDocs(query(userDocRef, where('uid', '==', user.uid)));
        if (!userDocSnap.empty) {
          const userDoc = userDocSnap.docs[0].data();
          if (userDoc['permission'] && userDoc['permission']['roleId']) {
            roleId = userDoc['permission']['roleId'];
          }
        }
      }
    }

    if (!roleId) {
      // If no roleId found, treat as creator
      this.accessService.setPermissions({}, 'creator');
      return;
    }

    if (roleId === 'cashier') {
      this.accessService.setPermissions({}, 'cashier');
    } else if (roleId === 'store_manager') {
      this.accessService.setPermissions({}, 'store_manager');
    } else if (roleId === 'creator') {
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
          this.accessService.setPermissions(roleDefData['permissions'], roleId);
        } else {
          this.accessService.setPermissions({}, 'creator');
        }
      } else {
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
      if (!user) {
        console.warn('📊 Dashboard: No user found for dashboard data loading');
        return;
      }

      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        // Load company-specific data with offline support
        console.log('📊 Dashboard: Loading data...', { 
          isOnline: this.isOnline(), 
          companyId: currentPermission.companyId 
        });
        
        try {
          await this.storeService.loadStoresByCompany(currentPermission.companyId);
          this.stores.set(this.storeService.getStores());
          this.totalStores.set(this.stores().length);
          console.log('✅ Dashboard: Stores loaded:', this.totalStores());
        } catch (storeError) {
          console.warn('⚠️ Dashboard: Failed to load stores (will use cached data):', storeError);
          // Still set the stores from service in case there's cached data
          this.stores.set(this.storeService.getStores());
          this.totalStores.set(this.stores().length);
        }
        
        try {
          // NOTE: productService.loadProducts expects a storeId for the BigQuery endpoint.
          // Passing companyId caused the Cloud Run BigQuery endpoint to receive an incorrect
          // storeId and return 403 when the token's store doesn't match the requested store.
          const targetStoreId = currentPermission.storeId || this.storeService.getStores()?.[0]?.id;
          if (targetStoreId) {
            await this.productService.loadProducts(targetStoreId as string);
            this.totalProducts.set(this.productService.totalProducts());
            console.log('✅ Dashboard: Products loaded:', this.totalProducts());
          } else {
            console.warn('⚠️ Dashboard: No storeId available to load products');
          }
        } catch (productError) {
          console.warn('⚠️ Dashboard: Failed to load products (will use cached data):', productError);
          // Still set the products count from service in case there's cached data
          this.totalProducts.set(this.productService.totalProducts());
        }
        
        console.log('📊 Dashboard: Data loading complete', {
          stores: this.totalStores(),
          products: this.totalProducts(),
          isOnline: this.isOnline()
        });
      }
    } catch (error) {
      console.error('❌ Dashboard: Error loading dashboard data:', error);
      // Don't throw - allow dashboard to render with whatever data is available
    }
  }

  get permissions() {
    const currentPermissions = this.accessService.permissions || {};
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
    } else if (url.includes('/dashboard/reconciliation')) {
      this.currentActivePage.set('reconciliation');
    } else {
      this.currentActivePage.set('');
    }
  }

  protected isActiveNavItem(pageName: string): boolean {
    return this.currentActivePage() === pageName;
  }

  // Header visibility methods
  protected toggleHeaderVisibility(): void {
    const newState = !this.isHeaderVisible();
    this.isHeaderVisible.set(newState);
    this.saveHeaderPreferences();
    console.log('🎯 Header visibility toggled to:', newState);
  }

  protected showHeader(): void {
    if (!this.isHeaderVisible()) {
      this.isHeaderVisible.set(true);
    }
  }

  protected hideHeader(): void {
    if (this.isHeaderVisible()) {
      this.isHeaderVisible.set(false);
    }
  }

  private saveHeaderPreferences(): void {
    try {
      const prefs = {
        manuallyHidden: !this.isHeaderVisible(),
        compactMode: this.isCompactMode(),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('headerPreferences', JSON.stringify(prefs));
    } catch (error) {
      console.error('Error saving header preferences:', error);
    }
  }

  // Language selection methods
  toggleLanguageMenu(): void {
    this.isLanguageMenuOpen.set(!this.isLanguageMenuOpen());
  }

  selectLanguage(language: Language): void {
    console.log('🌐 Switching to language:', language.code, language.name);
    this.translationService.setLanguage(language.code);
    this.isLanguageMenuOpen.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Toggle header with Ctrl+H or Cmd+H
    if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
      event.preventDefault();
      this.toggleHeaderVisibility();
    }
  }
}
