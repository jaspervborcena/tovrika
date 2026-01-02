import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService, Store } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="header-section">
          <h2 class="text-2xl font-semibold text-gray-900">Inventory</h2>
          
          <!-- Store Selection -->
          <div class="store-selection" *ngIf="stores().length > 0">
            <div *ngIf="hasMultipleStores(); else singleStore" class="store-selector">
              <label for="storeSelect">Store:</label>
              <select 
                id="storeSelect"
                [(ngModel)]="selectedStoreId"
                (change)="onStoreChange()"
                class="store-select">
                <option *ngFor="let store of stores()" [value]="store.id">
                  {{ store.storeName.toUpperCase() }}
                </option>
              </select>
            </div>
            <ng-template #singleStore>
              <div class="single-store">
                <label>Store:</label>
                <span class="store-name">{{ stores()[0].storeName.toUpperCase() }}</span>
              </div>
            </ng-template>
          </div>
        </div>
        
        <!-- TODO: Implement inventory management -->
        <div class="mt-6">
          <p class="text-gray-600">Selected Store: {{ getSelectedStoreName() }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .store-selection {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .store-selector {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .store-selector label {
      font-weight: 500;
      color: #374151;
    }

    .store-select {
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      color: #111827;
      background-color: white;
      cursor: pointer;
    }

    .store-select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .single-store {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .single-store label {
      font-weight: 500;
      color: #374151;
    }

    .store-name {
      font-weight: 600;
      color: #111827;
      padding: 0.5rem 1rem;
      background-color: #f3f4f6;
      border-radius: 0.375rem;
    }
  `]
})
export class InventoryComponent implements OnInit {
  private storeService = inject(StoreService);
  private authService = inject(AuthService);

  stores = signal<Store[]>([]);
  selectedStoreId = signal<string>('');

  hasMultipleStores = computed(() => {
    const storeCount = this.stores().length;
    const hasMultiple = storeCount > 1;
    console.log('🔢 hasMultipleStores computed:', { storeCount, hasMultiple, stores: this.stores().map(s => s.storeName) });
    return hasMultiple;
  });

  async ngOnInit() {
    await this.loadStores();
  }

  async loadStores(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentPermission?.companyId) {
        console.warn('No companyId found in current permission');
        return;
      }

      // Use centralized method from store.service
      const activeStores = await this.storeService.getActiveStoresForDropdown(currentPermission.companyId);
      
      this.stores.set(activeStores);
      console.log('🏪 Inventory: After setting stores signal', {
        storesLength: this.stores().length,
        hasMultiple: this.hasMultipleStores(),
        stores: this.stores().map(s => s.storeName)
      });

      // Set selected store - if user has storeId, use it, otherwise use first store
      if (currentPermission?.storeId) {
        this.selectedStoreId.set(currentPermission.storeId);
      } else if (activeStores.length > 0 && activeStores[0].id) {
        this.selectedStoreId.set(activeStores[0].id);
      }
      
      console.log('🏪 Inventory: Selected store ID:', this.selectedStoreId());
    } catch (error) {
      console.error('Error loading stores:', error);
      this.stores.set([]);
    }
  }

  onStoreChange(): void {
    console.log('Store changed to:', this.selectedStoreId());
    // TODO: Reload inventory data for selected store
  }

  getSelectedStoreName(): string {
    const store = this.stores().find(s => s.id === this.selectedStoreId());
    return store ? store.storeName : '';
  }
}