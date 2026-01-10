import { Injectable, signal, computed } from '@angular/core';

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
  
  // Public read-only access to selected store ID
  readonly selectedStoreId = computed(() => this._selectedStoreId());
  
  /**
   * Set the currently selected store ID
   * This will trigger updates in all components that subscribe to selectedStoreId
   */
  setSelectedStore(storeId: string): void {
    this._selectedStoreId.set(storeId);
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