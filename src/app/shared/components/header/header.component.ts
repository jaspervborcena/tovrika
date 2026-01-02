import { Component, OnInit, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { StoreService, Store } from '../../../services/store.service';
import { ProductService } from '../../../services/product.service';
import { AuthService } from '../../../services/auth.service';
import { CompanySetupService } from '../../../services/companySetup.service';
import { LogoComponent } from '../logo/logo.component';
import { AppConstants } from '../../enums';
import { NetworkService } from '../../../core/services/network.service';
import { TranslationService, Language } from '../../../services/translation.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    FormsModule,
    LogoComponent,
    TranslateModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  private storeService = inject(StoreService);
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private companyService = inject(CompanySetupService);
  private router = inject(Router);
  private networkService = inject(NetworkService);
  private translationService = inject(TranslationService);

  // Signals
  protected stores = signal<Store[]>([]);
  protected selectedStoreId = signal<string>('');
  protected selectedStore = computed(() => 
    this.stores().find(store => store.id === this.selectedStoreId())
  );
  protected totalCompanies = signal<number>(0);
  protected totalStores = signal<number>(0);
  protected totalProducts = signal<number>(0);
  protected recentCompanies = signal<any[]>([]);
  
  // User-related signals
  protected currentUser = computed(() => this.authService.getCurrentUser());
  protected isAuthenticated = computed(() => !!this.currentUser());
  protected isUserMenuOpen = signal<boolean>(false);
  
  // Translation signals
  protected currentLanguage = computed(() => this.translationService.currentLanguage());
  protected availableLanguages = computed(() => this.translationService.availableLanguages);
  protected isLanguageMenuOpen = signal<boolean>(false);
  
  // Notification control - disabled when not logged in
  protected showNotifications = computed(() => !!this.currentUser());
  
  // App constants and network status
  protected isOnline = computed(() => {
    const status = this.networkService.isOnline();
    console.log('🎨 Header: Network status is:', status ? 'ONLINE' : 'OFFLINE');
    return status;
  });
  protected appName = computed(() => {
    const name = this.isOnline() ? AppConstants.APP_NAME : AppConstants.APP_NAME_OFFLINE;
    console.log('🏷️ Header: App name is:', name);
    return name;
  });
  protected headerClass = computed(() => {
    const cssClass = this.isOnline() ? 'dashboard-header' : 'dashboard-header offline';
    console.log('💄 Header: CSS class is:', cssClass);
    return cssClass;
  });
  
  // Device toggle for POS pages
  protected isPosPage = computed(() => {
    const url = this.router.url;
    return url.includes('/pos') || url.includes('/dashboard/pos');
  });
  
  protected isMobilePosPage = computed(() => {
    const url = this.router.url;
    return url.includes('/pos/mobile');
  });
  
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
    // Prevent opening the dropdown if not authenticated
    if (!this.currentUser()) return;
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }

  protected closeUserMenu() {
    this.isUserMenuOpen.set(false);
  }

  protected async logout() {
    await this.authService.logout();
  }

  // Debug method to test offline mode
  protected toggleOfflineMode() {
    const currentStatus = this.networkService.getCurrentStatus();
    console.log('🔄 Toggling offline mode. Current status:', currentStatus ? 'ONLINE' : 'OFFLINE');
    this.networkService.setOfflineMode(currentStatus);
    
    // Force change detection after a short delay
    setTimeout(() => {
      console.log('🔄 After toggle - isOnline():', this.isOnline());
      console.log('🔄 After toggle - headerClass():', this.headerClass());
      console.log('🔄 After toggle - appName():', this.appName());
    }, 200);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Close user menu when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('[data-user-menu]')) {
      this.isUserMenuOpen.set(false);
    }
  }

  ngOnInit() {
    this.loadDashboardData();
    
    // Subscribe to language changes for debugging
    this.translationService.getLanguageChange().subscribe(lang => {
      console.log('🌐 Header: Language changed to:', lang);
    });
  }

  private async loadDashboardData() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const currentPermission = this.authService.getCurrentPermission();
      
      // Fetch roleId from userRoles collection
      let roleId: string | undefined;
      if (currentPermission?.companyId && user.uid) {
        const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
        const firestore = getFirestore();
        const userRolesRef = collection(firestore, 'userRoles');
        const userRolesQuery = query(
          userRolesRef,
          where('companyId', '==', currentPermission.companyId),
          where('userId', '==', user.uid),
          where('storeId', '==', currentPermission.storeId)
        );
        const userRolesSnap = await getDocs(userRolesQuery);
        if (!userRolesSnap.empty) {
          const userRoleData = userRolesSnap.docs[0].data();
          roleId = userRoleData['roleId'];
          console.log('Header UserRoles:', userRoleData);
        }
      }

      if (currentPermission?.companyId) {
        // Load company-specific data
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        
        // NOTE: Loading products from BigQuery is deferred to product pages/components to
        // avoid background API calls from the header which can trigger Cloud Run 403s.
        // If you need a products count here, rely on cached/IndexedDB data or the
        // ProductService signal which is kept in sync by product pages.
        // (this.productService.loadProducts(currentPermission.storeId) intentionally omitted)
        
        this.stores.set(this.storeService.getStores().filter(store => store.status === 'active'));
        this.totalStores.set(this.storeService.totalStores());
        this.totalProducts.set(this.productService.totalProducts());
  } else if (roleId === 'admin') {
        // Load all data for admin
        this.totalCompanies.set(this.companyService.totalCompanies());
        
        const companies = this.companyService.getCompanies();
        this.recentCompanies.set(
          companies
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
        );
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  // Device toggle methods for POS pages
  switchToMobile(): void {
    this.router.navigate(['/pos/mobile']);
  }

  switchToDesktop(): void {
    this.router.navigate(['/pos']);
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

  @HostListener('document:click', ['$event'])
  closeLanguageMenu(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.language-selector')) {
      this.isLanguageMenuOpen.set(false);
    }
  }
}
