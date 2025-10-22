import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageStorageService, StorageUsageInfo } from '../../services/image-storage.service';

@Component({
  selector: 'app-storage-monitor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="storage-monitor-container">
      <div class="header">
        <h2>📊 Storage Usage Monitor</h2>
        <button 
          class="refresh-btn" 
          (click)="refreshUsage()"
          [disabled]="isLoading()">
          {{ isLoading() ? 'Loading...' : '🔄 Refresh' }}
        </button>
      </div>

      <div class="usage-summary">
        <div class="summary-card">
          <h3>Total Storage</h3>
          <p class="total-size">{{ formatBytes(totalUsage()) }}</p>
        </div>
        <div class="summary-card">
          <h3>Total Stores</h3>
          <p class="store-count">{{ storeUsages().length }}</p>
        </div>
        <div class="summary-card">
          <h3>Total Product Images</h3>
          <p class="product-count">{{ totalProducts() }}</p>
        </div>
      </div>

      <div class="stores-list">
        <h3>Storage by Store</h3>
        
        @if (isLoading()) {
          <div class="loading">Loading storage information...</div>
        } @else if (storeUsages().length === 0) {
          <div class="no-data">No storage usage data found</div>
        } @else {
          <div class="stores-grid">
            @for (usage of sortedStoreUsages(); track usage.storeId) {
              <div class="store-card" [class.high-usage]="usage.totalSize > 10 * 1024 * 1024">
                <div class="store-header">
                  <h4>🏪 {{ usage.storeId }}</h4>
                  <span class="total-size">{{ formatBytes(usage.totalSize) }}</span>
                </div>
                
                <div class="usage-breakdown">
                  <div class="usage-item">
                    <span class="label">Logo:</span>
                    <span class="value">{{ formatBytes(usage.logoSize) }}</span>
                  </div>
                  <div class="usage-item">
                    <span class="label">Products:</span>
                    <span class="value">{{ formatBytes(usage.productsSize) }} ({{ usage.productCount }} images)</span>
                  </div>
                </div>

                <div class="usage-bar">
                  <div class="bar-container">
                    <div 
                      class="bar-fill logo" 
                      [style.width.%]="getLogoPercentage(usage)">
                    </div>
                    <div 
                      class="bar-fill products" 
                      [style.width.%]="getProductsPercentage(usage)"
                      [style.left.%]="getLogoPercentage(usage)">
                    </div>
                  </div>
                  <div class="bar-legend">
                    <span class="legend-item logo">Logo</span>
                    <span class="legend-item products">Products</span>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .storage-monitor-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    .header h2 {
      margin: 0;
      color: #333;
    }

    .refresh-btn {
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.3s;
    }

    .refresh-btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .refresh-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .usage-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .summary-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      border: 2px solid #e9ecef;
    }

    .summary-card h3 {
      margin: 0 0 10px 0;
      color: #666;
      font-size: 14px;
      text-transform: uppercase;
    }

    .total-size {
      font-size: 24px;
      font-weight: bold;
      color: #007bff;
      margin: 0;
    }

    .store-count, .product-count {
      font-size: 24px;
      font-weight: bold;
      color: #28a745;
      margin: 0;
    }

    .stores-list h3 {
      margin-bottom: 20px;
      color: #333;
    }

    .loading, .no-data {
      text-align: center;
      padding: 40px;
      color: #666;
      font-style: italic;
    }

    .stores-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }

    .store-card {
      background: white;
      border: 1px solid #e9ecef;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .store-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .store-card.high-usage {
      border-color: #ffc107;
      background: #fff9e6;
    }

    .store-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .store-header h4 {
      margin: 0;
      color: #333;
    }

    .store-header .total-size {
      font-size: 16px;
      color: #007bff;
      font-weight: bold;
    }

    .usage-breakdown {
      margin-bottom: 15px;
    }

    .usage-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }

    .usage-item .label {
      color: #666;
    }

    .usage-item .value {
      font-weight: 500;
      color: #333;
    }

    .usage-bar {
      margin-top: 15px;
    }

    .bar-container {
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      position: absolute;
      top: 0;
    }

    .bar-fill.logo {
      background: #28a745;
    }

    .bar-fill.products {
      background: #007bff;
    }

    .bar-legend {
      display: flex;
      gap: 15px;
      margin-top: 8px;
      font-size: 12px;
    }

    .legend-item {
      display: flex;
      align-items: center;
    }

    .legend-item::before {
      content: '';
      width: 12px;
      height: 12px;
      border-radius: 2px;
      margin-right: 5px;
    }

    .legend-item.logo::before {
      background: #28a745;
    }

    .legend-item.products::before {
      background: #007bff;
    }
  `]
})
export class StorageMonitorComponent implements OnInit {
  private imageStorageService = inject(ImageStorageService);
  
  storeUsages = signal<StorageUsageInfo[]>([]);
  isLoading = signal(false);

  // Computed properties
  totalUsage = computed(() => 
    this.storeUsages().reduce((sum, usage) => sum + usage.totalSize, 0)
  );

  totalProducts = computed(() => 
    this.storeUsages().reduce((sum, usage) => sum + usage.productCount, 0)
  );

  sortedStoreUsages = computed(() => 
    [...this.storeUsages()].sort((a, b) => b.totalSize - a.totalSize)
  );

  ngOnInit() {
    this.refreshUsage();
  }

  async refreshUsage() {
    this.isLoading.set(true);
    try {
      const usages = await this.imageStorageService.getAllStoresStorageUsage();
      this.storeUsages.set(usages);
    } catch (error) {
      console.error('Error loading storage usage:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  formatBytes(bytes: number): string {
    return this.imageStorageService.formatBytes(bytes);
  }

  getLogoPercentage(usage: StorageUsageInfo): number {
    if (usage.totalSize === 0) return 0;
    return (usage.logoSize / usage.totalSize) * 100;
  }

  getProductsPercentage(usage: StorageUsageInfo): number {
    if (usage.totalSize === 0) return 0;
    return (usage.productsSize / usage.totalSize) * 100;
  }
}