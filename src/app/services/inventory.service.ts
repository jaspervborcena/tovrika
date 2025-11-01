import { Injectable, computed, signal } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs 
} from '@angular/fire/firestore';
import { OfflineDocumentService } from '../core/services/offline-document.service';

export interface InventoryItem {
  productId: string;
  branchId: string;
  storeId: string;
  companyId: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  lastRestocked: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly inventory = signal<InventoryItem[]>([]);
  
  // Computed properties
  readonly lowStockItems = computed(() => 
    this.inventory().filter(item => item.quantity <= item.minStock)
  );
  
  readonly outOfStockItems = computed(() => 
    this.inventory().filter(item => item.quantity === 0)
  );

  constructor(private firestore: Firestore, private offlineDocService: OfflineDocumentService) {}

  async loadInventory(companyId: string, storeId: string, branchId: string) {
    try {
      const inventoryRef = collection(
        this.firestore,
        `companies/${companyId}/stores/${storeId}/branches/${branchId}/inventory`
      );
      const querySnapshot = await getDocs(inventoryRef);
      const inventory = querySnapshot.docs.map(doc => ({
        productId: doc.id,
        ...doc.data()
      } as InventoryItem));
      
      this.inventory.set(inventory);
    } catch (error) {
      console.error('Error loading inventory:', error);
      throw error;
    }
  }

  async updateStock(
  productId: string,
  quantity: number,
  companyId?: string,
  storeId?: string,
  branchId?: string,
  isIncrement: boolean = false
  ) {
    try {
      const safeCompanyId = companyId ?? '';
      const safeStoreId = storeId ?? '';
      const safeBranchId = branchId ?? '';
      const inventoryRef = doc(
        this.firestore,
        `companies/${safeCompanyId}/stores/${safeStoreId}/branches/${safeBranchId}/inventory/${productId}`
      );

      const currentItem = this.inventory().find(item => item.productId === productId);
      const newQuantity = isIncrement 
        ? (currentItem?.quantity || 0) + quantity
        : quantity;

      const updateData = {
        quantity: newQuantity,
        updatedAt: new Date()
      };

      if (!currentItem) {
        // Create new inventory item
        const newItem: InventoryItem = {
          productId,
          branchId: safeBranchId,
          storeId: safeStoreId,
          companyId: safeCompanyId,
          quantity: newQuantity,
          minStock: 10, // Default values, should be configurable
          maxStock: 100,
          lastRestocked: new Date(),
          updatedAt: new Date()
        };
        await this.offlineDocService.updateDocument(
          `companies/${safeCompanyId}/stores/${safeStoreId}/branches/${safeBranchId}/inventory`,
          productId,
          newItem
        );
        this.inventory.update(items => [...items, newItem]);
      } else {
        // Update existing item
        await this.offlineDocService.updateDocument(
          `companies/${safeCompanyId}/stores/${safeStoreId}/branches/${safeBranchId}/inventory`,
          productId,
          updateData
        );
        this.inventory.update(items =>
          items.map(item =>
            item.productId === productId
              ? { ...item, ...updateData }
              : item
          )
        );
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }

  async adjustInventory(
    companyId: string,
    storeId: string,
    branchId: string,
    adjustments: { productId: string; quantity: number }[]
  ) {
    try {
      // Use batched writes for multiple updates
      for (const adjustment of adjustments) {
        await this.updateStock(
          adjustment.productId,
          adjustment.quantity,
          companyId,
          storeId,
          branchId,
          true
        );
      }
    } catch (error) {
      console.error('Error adjusting inventory:', error);
      throw error;
    }
  }

  // Get current stock level for a product
  getProductStock(productId: string): number {
    const item = this.inventory().find(item => item.productId === productId);
    return item?.quantity || 0;
  }

  // Check if product is in stock
  isInStock(productId: string): boolean {
    return this.getProductStock(productId) > 0;
  }

  // Get all low stock items
  getLowStockItems() {
    return this.lowStockItems();
  }

  // Get all out of stock items
  getOutOfStockItems() {
    return this.outOfStockItems();
  }
}
