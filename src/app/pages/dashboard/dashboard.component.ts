import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { StoreService, Store } from '../../services/store.service';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { StoreSelectionService } from '../../services/store-selection.service';

import { AccessService } from '../../core/services/access.service';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { AppConstants } from '../../shared/enums';
import { NetworkService } from '../../core/services/network.service';
import { TranslationService, Language } from '../../services/translation.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    RouterOutlet,
    LogoComponent,
    TranslateModule
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
  private storeSelectionService = inject(StoreSelectionService);

  // Signals
  protected stores = signal<Store[]>([]);
  // Use the global store selection service instead of local selectedStoreId
  protected selectedStoreId = computed(() => this.storeSelectionService.selectedStoreId());
  protected selectedStore = computed(() => 
    this.stores().find(store => store.id === this.selectedStoreId())
  );
  
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
  protected isAuthenticated = computed(() => !!this.currentUser());
  protected isUserMenuOpen = signal<boolean>(false);
  protected userRole = signal<string>('');
  
  // Translation signals
  protected currentLanguage = computed(() => this.translationService.currentLanguage());
  protected availableLanguages = computed(() => this.translationService.availableLanguages);
  protected isLanguageMenuOpen = signal<boolean>(false);
  
  // Header collapse/expand
  protected isHeaderCollapsed = signal<boolean>(false);
  
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
    // Only one dropdown at a time
    this.isLanguageMenuOpen.set(false);
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }
  public screenWidth = 0;
  public isMobile = window.innerWidth < 1024;

  constructor() {
    this.updateScreenWidth();
  }

  private updateScreenWidth() {
    this.screenWidth = window.innerWidth;
    this.isMobile = this.screenWidth < 1024;
  }

  async ngOnInit() {
    // Initialize header collapsed state from localStorage
    const savedHeaderState = localStorage.getItem('headerCollapsed');
    if (savedHeaderState === 'true') {
      this.isHeaderCollapsed.set(true);
    }
    
    this.loadDashboardData();
    
    // Track current route for active menu item
    this.updateCurrentPage();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateCurrentPage();
    });    
    // Listen for window resize events
    window.addEventListener('resize', () => {
      this.updateScreenWidth();
    });
    
    const user = this.currentUser();
    if (!user) return;

    // Check if user's email exists in the 'admin' collection
    await this.checkAdminStatus(user.email);
    
    // Set default permissions based on role
    const currentPermission = this.authService.getCurrentPermission();
    if (this.userRole() !== 'admin') {
      // For non-admin users, determine permissions based on their role
      const roleId = currentPermission?.roleId;
      if (roleId === 'cashier') {
        this.accessService.setPermissions({}, 'cashier');
      } else if (roleId === 'store_manager') {
        this.accessService.setPermissions({}, 'store_manager');
      } else {
        this.accessService.setPermissions({}, 'creator');
      }
    }
  }

  /**
   * Check if user's email exists in the 'admin' collection
   * If found, set userRole to 'admin' and grant admin permissions
   */
  private async checkAdminStatus(email: string): Promise<void> {
    try {
      const adminRef = collection(this.firestore, 'admin');
      const adminQuery = query(adminRef, where('email', '==', email));
      const adminSnap = await getDocs(adminQuery);
      
      if (!adminSnap.empty) {
        console.log('✅ Dashboard: Admin detected from admin collection for email:', email);
        this.userRole.set('admin');
        this.accessService.setPermissions({}, 'admin');
      } else {
        console.log('📌 Dashboard: User is not an admin:', email);
      }
    } catch (error) {
      console.error('❌ Dashboard: Error checking admin status:', error);
    }
  }

  protected async onStoreChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newStoreId = target.value;
    
    console.log('🔄 Dashboard: Store changed to:', newStoreId);
    // Update the global store selection service instead of local signal
    this.storeSelectionService.setSelectedStore(newStoreId);
    
    // If a store is selected, trigger data reloading for that store
    if (newStoreId) {
      try {
        // Reload products for the new store
        await this.productService.loadProducts(newStoreId);
        this.totalProducts.set(this.productService.totalProducts());
        
        console.log('✅ Dashboard: Data reloaded for store:', newStoreId);
      } catch (error) {
        console.error('❌ Dashboard: Error reloading data for store:', error);
      }
    }
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
        try {
          await this.storeService.loadStoresByCompany(currentPermission.companyId);
          this.stores.set(this.storeService.getStores().filter(store => store.status === 'active'));
          this.totalStores.set(this.stores().length);
          
          // Set initial selected store from current permission or first store
          const initialStoreId = currentPermission.storeId || this.stores()[0]?.id;
          if (initialStoreId) {
            this.storeSelectionService.setSelectedStore(initialStoreId);
          }
        } catch (storeError) {
          console.warn('⚠️ Dashboard: Failed to load stores (will use cached data):', storeError);
          // Still set the stores from service in case there's cached data
          this.stores.set(this.storeService.getStores().filter(store => store.status === 'active'));
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
          } else {
            console.warn('⚠️ Dashboard: No storeId available to load products');
          }
        } catch (productError) {
          console.warn('⚠️ Dashboard: Failed to load products (will use cached data):', productError);
          // Still set the products count from service in case there's cached data
          this.totalProducts.set(this.productService.totalProducts());
        }
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

    if (url.includes('/dashboard/overview') || url === '/dashboard' || url === '/dashboard/') {
      this.currentActivePage.set('overview');
    } else if (url.includes('/dashboard/company-profile')) {
      this.currentActivePage.set('company-profile');
    } else if (url.includes('/dashboard/stores')) {
      this.currentActivePage.set('stores');
    } else if (url.includes('/dashboard/access')) {
      this.currentActivePage.set('access');
    } else if (url.includes('/dashboard/user-roles')) {
      this.currentActivePage.set('user-roles');
    } else if (url.includes('/dashboard/admin')) {
      this.currentActivePage.set('admin');
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

  // Language selection methods
  protected toggleLanguageMenu(): void {
    // Only one dropdown at a time
    this.isUserMenuOpen.set(false);
    this.isLanguageMenuOpen.set(!this.isLanguageMenuOpen());
  }

  protected selectLanguage(language: Language): void {
    console.log('🌐 Switching to language:', language.code, language.name);
    this.translationService.setLanguage(language.code);
    this.isLanguageMenuOpen.set(false);
  }

  // Header collapse/expand methods
  protected toggleHeaderCollapse(): void {
    const newState = !this.isHeaderCollapsed();
    this.isHeaderCollapsed.set(newState);
    localStorage.setItem('headerCollapsed', String(newState));
    window.dispatchEvent(new Event('headerCollapsed'));
  }

  protected showHeader(): void {
    this.isHeaderCollapsed.set(false);
    localStorage.setItem('headerCollapsed', 'false');
    window.dispatchEvent(new Event('headerCollapsed'));
  }
}
