import { Component, OnInit, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { StoreService, Store } from '../../services/store.service';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { CompanySetupService } from '../../services/companySetup.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    RouterOutlet
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private storeService = inject(StoreService);
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private companyService = inject(CompanySetupService);

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

  @HostListener('window:resize')
  onResize() {
    this.screenWidth = window.innerWidth;
    this.isMobile = this.screenWidth < 1024;
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
  this.screenWidth = window.innerWidth;
  this.isMobile = this.screenWidth < 1024;
  this.loadDashboardData();
  }

  protected onStoreChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedStoreId.set(target.value);
  }

  private async loadDashboardData() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      if (user.companyId) {
        // Load company-specific data
        await this.storeService.loadStoresByCompany(user.companyId);
        await this.productService.loadProducts(user.companyId);
        
        this.stores.set(this.storeService.getStores());
        this.totalStores.set(this.stores().length);
        this.totalProducts.set(this.productService.totalProducts());
      } else if ((user.roleId || user.role) === 'admin') {
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
}
