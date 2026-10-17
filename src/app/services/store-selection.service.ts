import { Injectable, signal, computed } from '@angular/core';
import { dedupeStoresForDropdown, formatStoreDisplayName, type Store } from './store.service';

export type ReportPeriod = 'all' | 'today' | 'yesterday' | 'this_week' | 'previous_week' | 'this_month' | 'previous_month' | 'date_range';

/**
 * Service to manage global store selection state across dashboard and child components
 * This ensures that when a store is selected in the dashboard header, all child components
 * (like product-management) are automatically synchronized with that selection.
 */
@Injectable({
  providedIn: 'root'
})
export class StoreSelectionService {
  // Global selected store ID
  private _selectedStoreId = signal<string>('');
  private _selectedPeriod = signal<ReportPeriod>('all');
  
  // Public read-only access to selected store ID
  readonly selectedStoreId = computed(() => this._selectedStoreId());
  readonly selectedPeriod = computed(() => this._selectedPeriod());
  readonly periodOptions = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'previous_week', label: 'Previous Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'previous_month', label: 'Previous Month' },
    { key: 'date_range', label: 'Date Range' }
  ] as const;

  getActiveStores(stores: Store[]): Store[] {
    return dedupeStoresForDropdown(stores.filter(store => store.status === 'active'));
  }
  
  /**
   * Set the currently selected store ID
   * This will trigger updates in all components that subscribe to selectedStoreId
   */
  setSelectedStore(storeId: string): void {
    this._selectedStoreId.set(storeId);
  }

  initializeStoreSelection(stores: Store[], fallbackStoreId?: string): void {
    const currentStoreId = this._selectedStoreId();
    if (currentStoreId && stores.some(store => store.id === currentStoreId)) return;

    const defaultStore = stores.find(
      store => formatStoreDisplayName(store).trim().toLowerCase() === 'tovrika - pasig branch'
    );
    const fallbackStore = stores.find(store => store.id === fallbackStoreId);
    this._selectedStoreId.set(defaultStore?.id || fallbackStore?.id || stores[0]?.id || '');
  }

  setSelectedPeriod(period: ReportPeriod): void {
    this._selectedPeriod.set(period);
  }
  
  /**
   * Clear the selected store (set to empty string)
   */
  clearSelection(): void {
    this._selectedStoreId.set('');
  }
  
  /**
   * Get the current selected store ID synchronously
   */
  getCurrentStoreId(): string {
    return this._selectedStoreId();
  }
}