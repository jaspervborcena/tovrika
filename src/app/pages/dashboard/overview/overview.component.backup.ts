import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService, Store } from '../../../services/store.service';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../interfaces/product.interface';
import { Order } from '../../../interfaces/pos.interface';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="px-6 py-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900">Welcome, Josiah 🎉</h1>
            <p class="text-sm text-gray-600 mt-1">Here's what's happening in your store.</p>
          </div>
          <div class="flex items-center gap-4">
            <button class="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </button>
            <button class="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
            </button>
            <div class="relative">
              <button class="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5-5-5 5h5zm0 0v-5"/>
                </svg>
              </button>
              <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">1</span>
            </div>
          </div>
        </div>

        <!-- Main Layout: Sidebar + Main Content -->
        <div class="grid grid-cols-4 gap-6">
          <!-- Left Sidebar: 1/4 width -->
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Sales Overview</h2>
            
            <!-- Total Revenue Card -->
            <div class="rounded-2xl p-6 shadow-sm" style="background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/>
                  </svg>
                </div>
                <span class="text-sm text-gray-700">Total Sales</span>
              </div>
              <div class="text-3xl font-bold text-gray-900 mb-2">₱{{ totalRevenue() | number:'1.2-2' }}</div>
              <div class="flex items-center gap-1 text-sm">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
                <span class="text-green-500 font-semibold">{{ revenueChangePercent() | number:'1.0-1' }}%</span>
                <span class="text-gray-500">From Last Day</span>
              </div>
            </div>

            <!-- Total Orders Card -->
            <div class="rounded-2xl p-6 shadow-sm" style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                </div>
                <span class="text-sm text-gray-700">Total Orders</span>
              </div>
              <div class="text-3xl font-bold text-gray-900 mb-2">{{ totalOrders() }}</div>
              <div class="flex items-center gap-1 text-sm">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
                <span class="text-green-500 font-semibold">{{ ordersChangePercent() | number:'1.0-1' }}%</span>
                <span class="text-gray-500">From Last Day</span>
              </div>
            </div>

            <!-- Total Customers Card -->
            <div class="rounded-2xl p-6 shadow-sm" style="background: linear-gradient(135deg, #cffafe 0%, #bfdbfe 100%);">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                  </svg>
                </div>
                <span class="text-sm text-gray-700">Total Customers</span>
              </div>
              <div class="text-3xl font-bold text-gray-900 mb-2">{{ totalCustomers() }}</div>
              <div class="flex items-center gap-1 text-sm">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
                <span class="text-green-500 font-semibold">{{ customersChangePercent() | number:'1.0-1' }}%</span>
                <span class="text-gray-500">From Last Day</span>
              </div>
            </div>

            <!-- Sales Summary Card -->
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 class="text-md font-semibold text-gray-900 mb-3">Quick Stats</h3>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-sm text-gray-600">Total Sales</span>
                  <span class="font-semibold text-gray-900">{{ totalOrders() }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm text-gray-600">This Month</span>
                  <span class="font-semibold text-gray-900">{{ monthOrders() }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm text-gray-600">Today</span>
                  <span class="font-semibold text-gray-900">{{ todayOrders() }}</span>
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-sm">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
                <span class="text-green-500 font-semibold">{{ ordersChangePercent() | number:'1.0-1' }}%</span>
                <span class="text-gray-500">increased</span>
              </div>
            </div>
          </div>

          <!-- Right Main Content: 3/4 width -->
          <div class="col-span-3 space-y-6">
            <!-- Main Charts Area -->
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-96">
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-semibold text-gray-900">Sales & Orders Overview</h3>
                <div class="flex items-center gap-4 text-sm">
                  @if (isLoading()) {
                    <div class="flex items-center gap-2 text-blue-600">
                      <div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading data...</span>
                    </div>
                  } @else {
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span class="text-gray-600">Orders: {{ orders().length }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full bg-green-500"></div>
                      <span class="text-gray-600">Revenue: ₱{{ totalRevenue() | number:'1.2-2' }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-gray-500">
                      <span>Store: {{ selectedStoreId() }}</span>
                    </div>
                  }
                </div>
              </div>
              
              <!-- Big Chart Area -->
              <div class="h-80">
                <div class="w-full h-full bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-8">
                  @if (isLoading()) {
                    <div class="flex items-center justify-center h-20">
                      <div class="flex items-center gap-3 text-gray-600">
                        <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span class="text-lg">Loading your sales data...</span>
                      </div>
                    </div>
                  } @else {
                    <!-- Chart Header Stats -->
                    <div class="grid grid-cols-4 gap-6 mb-8">
                      <div class="text-center">
                        <div class="text-3xl font-bold text-blue-600">₱{{ totalRevenue() | number:'1.2-2' }}</div>
                        <div class="text-sm text-gray-600 mt-1">Total Sales</div>
                      </div>
                      <div class="text-center">
                        <div class="text-3xl font-bold text-green-600">{{ totalOrders() }}</div>
                        <div class="text-sm text-gray-600 mt-1">Total Orders</div>
                      </div>
                      <div class="text-center">
                        <div class="text-3xl font-bold text-purple-600">{{ todayOrders() }}</div>
                        <div class="text-sm text-gray-600 mt-1">Today's Orders</div>
                      </div>
                      <div class="text-center">
                        <div class="text-3xl font-bold text-orange-600">{{ totalCustomers() }}</div>
                        <div class="text-sm text-gray-600 mt-1">Customers</div>
                      </div>
                    </div>
                  }
                  
                  <!-- Visual Bar Chart -->
                  <div class="flex items-end justify-center h-48 gap-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6">
                    <div class="flex flex-col items-center">
                      <div class="w-24 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg mb-3 flex items-end justify-center text-white text-sm font-bold pb-2 shadow-lg" 
                           style="height: {{ totalOrdersHeight() }}px;">
                        {{ totalOrders() }}
                      </div>
                      <span class="text-sm font-medium text-gray-700">Total Orders</span>
                      <span class="text-xs text-gray-500">{{ totalOrders() }} orders</span>
                    </div>
                    <div class="flex flex-col items-center">
                      <div class="w-24 bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg mb-3 flex items-end justify-center text-white text-sm font-bold pb-2 shadow-lg" 
                           style="height: {{ todayOrdersHeight() }}px;">
                        {{ todayOrders() }}
                      </div>
                      <span class="text-sm font-medium text-gray-700">Today</span>
                      <span class="text-xs text-gray-500">{{ todayOrders() }} orders</span>
                    </div>
                    <div class="flex flex-col items-center">
                      <div class="w-24 bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-lg mb-3 flex items-end justify-center text-white text-sm font-bold pb-2 shadow-lg" 
                           style="height: {{ monthOrdersHeight() }}px;">
                        {{ monthOrders() }}
                      </div>
                      <span class="text-sm font-medium text-gray-700">This Month</span>
                      <span class="text-xs text-gray-500">{{ monthOrders() }} orders</span>
                    </div>
                    <div class="flex flex-col items-center">
                      <div class="w-24 bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-lg mb-3 flex items-end justify-center text-white text-sm font-bold pb-2 shadow-lg" 
                           style="height: {{ customersHeight() }}px;">
                        {{ totalCustomers() }}
                      </div>
                      <span class="text-sm font-medium text-gray-700">Customers</span>
                      <span class="text-xs text-gray-500">{{ totalCustomers() }} unique</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bottom Row: Analytics and Products -->
            <div class="grid grid-cols-2 gap-6">
              <!-- Sale Analytics -->
              <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div class="flex items-center justify-between mb-6">
                  <h3 class="text-xl font-semibold text-gray-900">Sale Analytics</h3>
                </div>
                
                <div class="flex items-center justify-center">
                  <div class="relative w-40 h-40">
                    <svg viewBox="0 0 120 120" class="w-full h-full transform -rotate-90">
                      <!-- Background circle -->
                      <circle cx="60" cy="60" r="35" fill="none" stroke="#f3f4f6" stroke-width="10"/>
                      <!-- Completed segment (70%) -->
                      <circle cx="60" cy="60" r="35" fill="none" stroke="#06b6d4" stroke-width="10" 
                              stroke-dasharray="153.94 219.91" stroke-dashoffset="0" stroke-linecap="round"/>
                      <!-- Returned segment (20%) -->
                      <circle cx="60" cy="60" r="35" fill="none" stroke="#f97316" stroke-width="10" 
                              stroke-dasharray="43.98 219.91" stroke-dashoffset="-153.94" stroke-linecap="round"/>
                      <!-- Distributed segment (10%) -->
                      <circle cx="60" cy="60" r="35" fill="none" stroke="#8b5cf6" stroke-width="10" 
                              stroke-dasharray="21.99 219.91" stroke-dashoffset="-197.92" stroke-linecap="round"/>
                    </svg>
                    <!-- Center text -->
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                      <div class="text-2xl font-bold text-gray-900">100%</div>
                      <div class="text-xs text-gray-500">Completed</div>
                    </div>
                  </div>
                </div>
                
                <!-- Legend below chart -->
                <div class="mt-6 space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full bg-cyan-500"></div>
                      <span class="text-sm text-gray-700">Completed</span>
                    </div>
                    <div class="text-sm text-gray-900 font-medium">70%</div>
                  </div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span class="text-sm text-gray-700">Returned</span>
                    </div>
                    <div class="text-sm text-gray-900 font-medium">20%</div>
                  </div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span class="text-sm text-gray-700">Distributed</span>
                    </div>
                    <div class="text-sm text-gray-900 font-medium">10%</div>
                  </div>
                </div>
              </div>

              <!-- Top Products -->
              <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 class="text-xl font-semibold text-gray-900 mb-4">Top Products</h3>
                
                <!-- Table Header -->
                <div class="grid grid-cols-2 gap-4 text-xs text-gray-500 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
                  <span>Product</span>
                  <span class="text-right">Code</span>
                </div>
                
                <!-- Product List -->
                <div class="space-y-4">
                  <div class="grid grid-cols-2 gap-4 items-center">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span class="text-purple-600 text-xs">R</span>
                      </div>
                      <span class="text-sm text-gray-900">Realistic</span>
                    </div>
                    <span class="text-sm text-gray-600 text-right">8812</span>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-4 items-center">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                        <span class="text-white text-xs">M</span>
                      </div>
                      <span class="text-sm text-gray-900">Monstera</span>
                    </div>
                    <span class="text-sm text-gray-600 text-right">8832</span>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-4 items-center">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <span class="text-orange-600 text-xs">P</span>
                      </div>
                      <span class="text-sm text-gray-900">Product</span>
                    </div>
                    <span class="text-sm text-gray-600 text-right">8871</span>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-4 items-center">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <span class="text-green-600 text-xs">P</span>
                      </div>
                      <span class="text-sm text-gray-900">Product</span>
                    </div>
                    <span class="text-sm text-gray-600 text-right">2211</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Purchase Analytics Section -->
        <div class="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 class="text-xl font-semibold text-gray-900 mb-6">Purchase Analytics</h3>
          <div class="flex items-center gap-6 text-sm">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span class="text-gray-600">Sold</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-cyan-500"></div>
              <span class="text-gray-600">Purchased</span>
            </div>
          </div>
          <!-- Add chart content here if needed -->
        </div>
      </div>
    </div>
  `
})
export class OverviewComponent implements OnInit {
  private storeService = inject(StoreService);
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);

  // Signals
  protected stores = signal<Store[]>([]);
  protected products = signal<Product[]>([]);
  protected orders = signal<Order[]>([]);
  protected selectedStoreId = signal<string>('all');
  protected isLoading = signal<boolean>(true);

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
  protected storeList = computed(() => this.stores());
  protected totalOrders = computed(() => this.orders().length);
  protected totalRevenue = computed(() => this.orders().reduce((s, o) => s + (Number(o.netAmount ?? o.totalAmount ?? 0) || 0), 0));
  protected totalCustomers = computed(() => {
    const set = new Set<string>();
    this.orders().forEach(o => { if (o.soldTo && String(o.soldTo).trim()) set.add(String(o.soldTo)); });
    return set.size;
  });
  protected todayOrders = computed(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return this.orders().filter(o => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      if (!d) return false;
      const dd = new Date(d); dd.setHours(0,0,0,0);
      return dd.getTime() === today.getTime();
    }).length;
  });
  protected monthOrders = computed(() => {
    const now = new Date();
    const m = now.getMonth(); const y = now.getFullYear();
    return this.orders().filter(o => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      return d && d.getMonth() === m && d.getFullYear() === y;
    }).length;
  });

  // Day-over-day deltas
  protected yesterdayOrders = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0,0,0,0);
    return this.orders().filter(o => {
      const od = o.createdAt ? new Date(o.createdAt) : undefined;
      if (!od) return false;
      const dd = new Date(od); dd.setHours(0,0,0,0);
      return dd.getTime() === d.getTime();
    }).length;
  });

  protected todayRevenue = computed(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    return this.orders().reduce((sum, o) => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      if (!d) return sum;
      const dd = new Date(d); dd.setHours(0,0,0,0);
      if (dd.getTime() !== t.getTime()) return sum;
      return sum + (Number(o.netAmount ?? o.totalAmount ?? 0) || 0);
    }, 0);
  });

  protected yesterdayRevenue = computed(() => {
    const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0,0,0,0);
    return this.orders().reduce((sum, o) => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      if (!d) return sum;
      const dd = new Date(d); dd.setHours(0,0,0,0);
      if (dd.getTime() !== y.getTime()) return sum;
      return sum + (Number(o.netAmount ?? o.totalAmount ?? 0) || 0);
    }, 0);
  });

  protected todayCustomers = computed(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    const set = new Set<string>();
    this.orders().forEach(o => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      if (!d) return;
      const dd = new Date(d); dd.setHours(0,0,0,0);
      if (dd.getTime() === t.getTime() && o.soldTo) set.add(String(o.soldTo));
    });
    return set.size;
  });

  protected yesterdayCustomers = computed(() => {
    const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0,0,0,0);
    const set = new Set<string>();
    this.orders().forEach(o => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      if (!d) return;
      const dd = new Date(d); dd.setHours(0,0,0,0);
      if (dd.getTime() === y.getTime() && o.soldTo) set.add(String(o.soldTo));
    });
    return set.size;
  });

  protected ordersChangePercent = computed(() => this.calcChangePercent(this.todayOrders(), this.yesterdayOrders()));
  protected revenueChangePercent = computed(() => this.calcChangePercent(this.todayRevenue(), this.yesterdayRevenue()));
  protected customersChangePercent = computed(() => this.calcChangePercent(this.todayCustomers(), this.yesterdayCustomers()));

  // Chart height calculations
  protected totalOrdersHeight = computed(() => Math.max(60, this.totalOrders() * 12));
  protected todayOrdersHeight = computed(() => Math.max(40, this.todayOrders() * 15));
  protected monthOrdersHeight = computed(() => Math.max(80, this.monthOrders() * 8));
  protected customersHeight = computed(() => Math.max(50, this.totalCustomers() * 20));

  // Status mapping and counts
  protected statusCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = { success: 0, cancelled: 0, refunded: 0, damaged: 0, returned: 0 };
    for (const o of this.orders()) {
      const key = this.mapStatus(o.status);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  });

  // Chart categories with Tailwind classes
  protected readonly statusCategories = [
    { key: 'success', label: 'Completed / Success', dotClass: 'bg-green-500', barClass: 'bg-green-500' },
    { key: 'cancelled', label: 'Cancelled', dotClass: 'bg-red-500', barClass: 'bg-red-500' },
    { key: 'refunded', label: 'Refunded', dotClass: 'bg-purple-500', barClass: 'bg-purple-500' },
    { key: 'damaged', label: 'Damaged', dotClass: 'bg-amber-500', barClass: 'bg-amber-500' },
    { key: 'returned', label: 'Returned', dotClass: 'bg-sky-500', barClass: 'bg-sky-500' }
  ] as const;

  constructor() {
    this.loadData();
  }

  private async loadData() {
    try {
      this.isLoading.set(true);
      console.log('🚀 Dashboard: Starting data load...');
      
      // EXACT same approach as sales-summary
      await this.loadStores();
      
      // Wait a bit for stores to be set, then load today's data
      setTimeout(() => {
        this.loadCurrentDateData();
      }, 100);

    } catch (error) {
      console.error('❌ Dashboard error loading data:', error);
      this.isLoading.set(false);
    }
  }

  async loadStores(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      console.log('🔐 Dashboard permission:', currentPermission);
      
      if (!currentPermission?.companyId) {
        console.warn('No companyId found in current permission');
        return;
      }

      const stores = await this.storeService.getStoresByCompany(currentPermission.companyId);
      this.stores.set(stores);
      console.log('🏪 Dashboard stores loaded:', stores?.length || 0);

      // Set selected store - EXACT same logic as sales-summary
      if (currentPermission?.storeId) {
        this.selectedStoreId.set(currentPermission.storeId);
        console.log('🎯 Using permission store ID:', currentPermission.storeId);
      } else if (stores.length > 0 && stores[0].id) {
        this.selectedStoreId.set(stores[0].id);
        console.log('🎯 Using first store ID:', stores[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      this.stores.set([]);
    }
  }

  async loadCurrentDateData(): Promise<void> {
    console.log('🔄 Dashboard: Loading current date data from Firebase');
    
    try {
      // Use selected store ID or get from permission - EXACT same logic
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      console.log('🏪 Dashboard Store ID resolution:', {
        selectedStoreId: this.selectedStoreId(),
        permissionStoreId: this.authService.getCurrentPermission()?.storeId,
        finalStoreId: storeId,
        allStores: this.stores().map(s => ({ id: s.id, name: s.storeName }))
      });
      
      if (!storeId) {
        console.warn('❌ Dashboard: No storeId found - cannot load data');
        this.orders.set([]);
        return;
      }

      // Load TODAY's data - same as sales-summary
      const today = new Date();
      const startDate = new Date(today.toISOString().split('T')[0]); // Start of today
      const endDate = new Date(today.toISOString().split('T')[0]); // End of today
      endDate.setHours(23, 59, 59, 999);

      console.log('📅 Dashboard loading sales data for store:', storeId, 'from:', startDate, 'to:', endDate);

      // Use the EXACT same method as sales-summary
      const orders = await this.orderService.getOrdersByDateRange(storeId, startDate, endDate);

      console.log('📊 Dashboard Order Service returned:', orders?.length || 0, 'orders');
      if (orders && orders.length > 0) {
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        console.log('💰 Dashboard total revenue:', totalRevenue);
        console.log('📋 Dashboard sample order:', orders[0]);
      }

      // Transform to match interface - same as sales-summary
      const transformedOrders = (orders || []).map((order: any) => ({
        ...order,
        id: order.id || '',
        customerName: order.soldTo || 'Cash Sale',
        items: [],
        paymentMethod: 'cash'
      }));

      this.orders.set(transformedOrders);

      // Load products
      const products = await this.productService.getProducts();
      this.products.set(products || []);

    } catch (error) {
      console.error('❌ Dashboard error loading current date data:', error);
      this.orders.set([]);
    } finally {
      this.isLoading.set(false);
      console.log('✅ Dashboard data loading complete');
    }
  }

  private async loadOrders(companyId?: string, storeId?: string) {
    // This method is now handled in loadData() for consistency with sales-summary
    console.log('� loadOrders called - now handled in loadData()');
  }

  protected onStoreChange(value: string) {
    this.selectedStoreId.set(value);
    const permission = this.authService.getCurrentPermission();
    const companyId = permission?.companyId;
    this.loadOrders(companyId || undefined, value);
  }

  protected percentage(key: string): number {
    const total = this.totalOrders();
    if (!total) return 0;
    const count = this.statusCounts()[key] || 0;
    return Math.round((count / total) * 100);
  }

  private mapStatus(status: string): 'success' | 'cancelled' | 'refunded' | 'damaged' | 'returned' {
    const s = (status || '').toLowerCase();
    if (['completed', 'success', 'paid'].includes(s)) return 'success';
    if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
    if (['refunded', 'refund'].includes(s)) return 'refunded';
    if (['damaged', 'damage', 'broken'].includes(s)) return 'damaged';
    if (['returned', 'return'].includes(s)) return 'returned';
    // Default unknowns to success for now
    return 'success';
  }

  // Helper: percent change with protection for zero and negatives
  private calcChangePercent(current: number, previous: number): number {
    const prev = Number(previous) || 0;
    const curr = Number(current) || 0;
    if (prev === 0) {
      // If no previous, show 100% when current > 0, else 0
      return curr > 0 ? 100 : 0;
    }
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  ngOnInit(): void {
    // Initialize data loading on component init - same as sales-summary
    this.loadData();
  }
}