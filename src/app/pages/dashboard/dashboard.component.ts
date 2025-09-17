import { Component, OnInit, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { StoreService, Store } from '../../services/store.service';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { CompanySetupService } from '../../services/companySetup.service';
import { AccessService, Permissions } from '../../core/services/access.service';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

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
  private accessService = inject(AccessService);
  private firestore = inject(Firestore);

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

  async ngOnInit() {
    this.screenWidth = window.innerWidth;
    this.isMobile = this.screenWidth < 1024;
    this.loadDashboardData();
    // Step 1: Get userRoles for current user
    const user = this.currentUser();
    console.log('User:', user);
    if (user && user.companyId && user.uid && user.storeId) {
      const userRolesRef = collection(this.firestore, 'userRoles');
      const userRolesQuery = query(
        userRolesRef,
        where('companyId', '==', user.companyId),
        where('userId', '==', user.uid),
        where('storeId', '==', user.storeId)
      );
      const userRolesSnap = await getDocs(userRolesQuery);
      if (!userRolesSnap.empty) {
        const userRoleData = userRolesSnap.docs[0].data();
        console.log('UserRoles:', userRoleData);
        const roleId = userRoleData['roleId'];
        console.log('roleId from userRoles:', roleId);
        // Step 2: Get permissions from roledefinition
        if (roleId) {
          const roleDefRef = collection(this.firestore, 'roledefinition');
          const roleDefQuery = query(
            roleDefRef,
            where('companyId', '==', user.companyId),
            where('roleId', '==', roleId)
          );
          const roleDefSnap = await getDocs(roleDefQuery);
          if (!roleDefSnap.empty) {
            const roleDefData = roleDefSnap.docs[0].data();
            console.log('RoleDefinition:', roleDefData);
            console.log('roleId from roleDefinition:', roleDefData['roleId']);
            if (roleDefData['permissions']) {
              this.accessService.setPermissions(roleDefData['permissions']);
            }
          }
        }
      }
    }
    // If no userRole found, keep default permissions (see everything)
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
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  get permissions() {
    return this.accessService.permissions || {};
  }
}
