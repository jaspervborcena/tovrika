import { Component, OnInit, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { StoreService, Store } from '../../../services/store.service';
import { ProductService } from '../../../services/product.service';
import { AuthService } from '../../../services/auth.service';
import { CompanySetupService } from '../../../services/companySetup.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    FormsModule
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
  protected isUserMenuOpen = signal<boolean>(false);
  
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
    this.isUserMenuOpen.set(!this.isUserMenuOpen());
  }

  protected closeUserMenu() {
    this.isUserMenuOpen.set(false);
  }

  protected async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
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
  }

  private async loadDashboardData() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      // Fetch roleId from userRoles collection
      let roleId: string | undefined;
      if (user.companyId && user.uid && user.storeId) {
        const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
        const firestore = getFirestore();
        const userRolesRef = collection(firestore, 'userRoles');
        const userRolesQuery = query(
          userRolesRef,
          where('companyId', '==', user.companyId),
          where('userId', '==', user.uid),
          where('storeId', '==', user.storeId)
        );
        const userRolesSnap = await getDocs(userRolesQuery);
        if (!userRolesSnap.empty) {
          const userRoleData = userRolesSnap.docs[0].data();
          roleId = userRoleData['roleId'];
          console.log('Header UserRoles:', userRoleData);
        }
      }

      if (user.companyId) {
        // Load company-specific data
        await this.storeService.loadStoresByCompany(user.companyId);
        await this.productService.loadProducts(user.companyId);
        
        this.stores.set(this.storeService.getStores());
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
}
