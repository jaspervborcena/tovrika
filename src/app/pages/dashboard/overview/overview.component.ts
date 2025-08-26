import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService, Store } from '../../../services/store.service';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../interfaces/product.interface';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="py-6">
      <div class="px-4 sm:px-6 lg:px-8">
        <h2 class="text-lg font-medium text-gray-900">Dashboard Overview</h2>
        
        <!-- Stats Grid -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <!-- Total Stores -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <!-- Store Icon -->
                  <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Total Stores</dt>
                    <dd class="flex items-baseline">
                      <div class="text-2xl font-semibold text-gray-900">{{ totalStores() }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Total Products -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <!-- Product Icon -->
                  <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Total Products</dt>
                    <dd class="flex items-baseline">
                      <div class="text-2xl font-semibold text-gray-900">{{ totalProducts() }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Low Stock Alert -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <!-- Alert Icon -->
                  <svg class="h-4 w-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">Low Stock Items</dt>
                    <dd class="flex items-baseline">
                      <div class="text-2xl font-semibold text-gray-900">{{ lowStockCount() }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="mt-8">
          <h3 class="text-lg font-medium text-gray-900">Recent Activity</h3>
          <div class="mt-4 bg-white shadow rounded-lg">
            @if (recentProducts().length > 0) {
              <ul role="list" class="divide-y divide-gray-200">
                @for (product of recentProducts(); track product.id) {
                  <li class="px-6 py-4">
                    <div class="flex items-center space-x-4">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ product.productName }}</p>
                        <p class="text-sm text-gray-500">Added to {{ product.storeId }}</p>
                      </div>
                      <div>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                              [class.bg-green-100]="product.totalStock > 10"
                              [class.text-green-800]="product.totalStock > 10"
                              [class.bg-yellow-100]="product.totalStock <= 10"
                              [class.text-yellow-800]="product.totalStock <= 10">
                          Stock: {{ product.totalStock }}
                        </span>
                      </div>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <div class="p-6 text-center text-gray-500">
                No recent activity to display
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class OverviewComponent {
  private storeService = inject(StoreService);
  private productService = inject(ProductService);

  // Signals
  private stores = signal<Store[]>([]);
  private products = signal<Product[]>([]);

  // Computed values
  protected totalStores = computed(() => this.stores().length);
  protected totalProducts = computed(() => this.products().length);
  protected lowStockCount = computed(() => 
    this.products().filter(p => p.totalStock <= 10).length
  );
  protected recentProducts = computed(() => 
    [...this.products()]
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, 5)
  );

  constructor() {
    this.loadData();
  }

  private async loadData() {
    try {
      // Load stores
      const stores = await this.storeService.getStores();
      this.stores.set(stores);

      // Load products
      const products = await this.productService.getProducts();
      this.products.set(products);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }
}
