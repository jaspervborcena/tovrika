import { Injectable, computed, signal, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from '@angular/fire/firestore';
import { Product, ProductInventory } from '../interfaces/product.interface';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly products = signal<Product[]>([]);
  private readonly offlineDocService = inject(OfflineDocumentService);
  
  // Computed properties
  readonly totalProducts = computed(() => this.products().length);
  readonly activeProducts = computed(() => 
    this.products().filter(product => product.status === 'active')
  );
  readonly lowStockProducts = computed(() => 
    this.products().filter(product => product.totalStock <= 10)
  );
  readonly productsByCategory = computed(() => {
    const categoryMap = new Map<string, Product[]>();
    this.products().forEach(product => {
      const products = categoryMap.get(product.category) || [];
      products.push(product);
      categoryMap.set(product.category, products);
    });
    return categoryMap;
  });

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private securityService: FirestoreSecurityService
  ) {}

  private transformFirestoreDoc(doc: any): Product {
    const data = doc.data();
    return {
      id: doc.id,
      productName: data['productName'] || '',
      description: data['description'] || undefined,
      skuId: data['skuId'] || '',
      unitType: data['unitType'] || 'pieces',
      category: data['category'] || '',
      totalStock: data['totalStock'] || 0,
      sellingPrice: data['sellingPrice'] || 0,
      companyId: data['companyId'] || '',
      storeId: data['storeId'] || '',
      isMultipleInventory: data['isMultipleInventory'] || false,
      barcodeId: data['barcodeId'] || '',
      imageUrl: data['imageUrl'] || '',
      inventory: this.transformInventoryArray(data['inventory'] || []),
      
      // Tax and Discount Fields with defaults
      isVatApplicable: data['isVatApplicable'] || false,
      vatRate: data['vatRate'] || 0,
      hasDiscount: data['hasDiscount'] || false,
      discountType: data['discountType'] || 'percentage',
      discountValue: data['discountValue'] || 0,
      
      // Price and Quantity Tracking
      priceHistory: this.transformPriceHistory(data['priceHistory'] || []),
      quantityAdjustments: this.transformQuantityAdjustments(data['quantityAdjustments'] || []),
      
      status: data['status'] || 'active',
      createdAt: data['createdAt']?.toDate() || new Date(),
      updatedAt: data['updatedAt']?.toDate() || new Date(),
      lastUpdated: data['lastUpdated']?.toDate() || new Date()
    };
  }

  private transformPriceHistory(historyData: any[]): any[] {
    if (!Array.isArray(historyData)) return [];
    return historyData.map(item => ({
      oldPrice: item.oldPrice || 0,
      newPrice: item.newPrice || 0,
      changeType: item.changeType || 'initial',
      changeAmount: item.changeAmount || 0,
      changePercentage: item.changePercentage || 0,
      changedAt: item.changedAt?.toDate() || new Date(),
      changedBy: item.changedBy || '',
      changedByName: item.changedByName || '',
      reason: item.reason || '',
      batchId: item.batchId || undefined
    }));
  }

  private transformQuantityAdjustments(adjustmentsData: any[]): any[] {
    if (!Array.isArray(adjustmentsData)) return [];
    return adjustmentsData.map(item => ({
      batchId: item.batchId || '',
      oldQuantity: item.oldQuantity || 0,
      newQuantity: item.newQuantity || 0,
      adjustmentType: item.adjustmentType || 'manual',
      adjustedAt: item.adjustedAt?.toDate() || new Date(),
      adjustedBy: item.adjustedBy || '',
      adjustedByName: item.adjustedByName || '',
      reason: item.reason || '',
      notes: item.notes || ''
    }));
  }

  private transformInventoryArray(inventoryData: any[]): ProductInventory[] {
    return inventoryData.map(item => ({
      batchId: item.batchId || '',
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      costPrice: item.costPrice || 0,
      receivedAt: item.receivedAt?.toDate() || new Date(),
      expiryDate: item.expiryDate?.toDate() || undefined,
      supplier: item.supplier || undefined,
      status: item.status || 'active'
    }));
  }

  private async waitForAuth(): Promise<string> {
    return new Promise((resolve, reject) => {
      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      if (currentUser && currentPermission?.companyId) {
        resolve(currentPermission.companyId);
        return;
      }

      // Use effect to watch for auth changes
      let attempts = 0;
      const checkAuth = () => {
        const user = this.authService.getCurrentUser();
        const permission = this.authService.getCurrentPermission();
        if (user && permission?.companyId) {
          resolve(permission.companyId);
          return;
        }
        
        attempts++;
        if (attempts >= 50) { // 5 seconds with 100ms intervals
          reject(new Error('Authentication timeout'));
          return;
        }
        
        setTimeout(checkAuth, 100);
      };
      
      checkAuth();
    });
  }

  async loadProducts(storeId?: string): Promise<void> {
    try {
      const companyId = await this.waitForAuth();
      const productsRef = collection(this.firestore, 'products');
      
      let q;
      if (storeId) {
        q = query(productsRef, 
          where('companyId', '==', companyId),
          where('storeId', '==', storeId)
        );
      } else {
        q = query(productsRef, where('companyId', '==', companyId));
      }
      
      const querySnapshot = await getDocs(q);
      const products = querySnapshot.docs.map(doc => this.transformFirestoreDoc(doc));
      
      this.products.set(products);
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  }
async loadProductsByCompanyAndStore(companyId?: string, storeId?: string): Promise<void> {
    try {
      // Validate required companyId
      if (!companyId) {
        console.error('❌ CompanyId is required for loading products');
        return;
      }

      console.log('📦 Loading products for:', { companyId, storeId });
      
      // Debug: Check current UID context for security
      try {
        const currentUID = await this.securityService.getCurrentUserUID();
        console.log('🔐 Current UID for product loading:', currentUID);
        
        // Check if we have offline UID available
        const offlineUID = await this.securityService.getCurrentUserUID();
        console.log('💾 UID from security service (includes IndexedDB):', offlineUID);
      } catch (uidError) {
        console.warn('⚠️ Could not get UID for product loading:', uidError);
      }
      
      const productsRef = collection(this.firestore, 'products');
      
      let q;
      if (storeId) {
        // Load products for specific company and store
        q = query(productsRef, 
          where('companyId', '==', companyId),
          where('storeId', '==', storeId)
        );
        console.log('🎯 Querying products for company + store:', { companyId, storeId });
      } else {
        // Load all products for the company
        q = query(productsRef, where('companyId', '==', companyId));
        console.log('🎯 Querying all products for company:', companyId);
      }
      
      const querySnapshot = await getDocs(q);
      const products = querySnapshot.docs.map(doc => this.transformFirestoreDoc(doc));
      
      console.log(`✅ Loaded ${products.length} products:`, {
        companyId,
        storeId,
        productsFound: products.length,
        productNames: products.map(p => p.productName).slice(0, 5), // Show first 5 product names
        hasUID: products.map(p => !!(p as any).uid).slice(0, 5), // Check if products have UID fields
        sampleProduct: products.length > 0 ? {
          id: products[0].id,
          name: products[0].productName,
          hasUID: !!(products[0] as any).uid,
          companyId: products[0].companyId,
          storeId: products[0].storeId
        } : null
      });
      
      // Validate that we actually have products before setting
      if (products.length === 0) {
        console.warn('⚠️ No products found for query:', { companyId, storeId });
        console.warn('⚠️ This could be due to:');
        console.warn('   1. No products exist for this company/store');
        console.warn('   2. Products lack proper UID fields (security filtering)');
        console.warn('   3. Firestore security rules blocking access');
      }
      
      this.products.set(products);
    } catch (error) {
      console.error('❌ Error loading products:', error);
      console.error('Query parameters:', { companyId, storeId });
      throw error;
    }
  }
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const companyId = await this.waitForAuth();
      
      // Prepare product data with required fields
      const productToCreate = {
        ...productData,
        companyId,
        status: productData.status || 'active',
        inventory: productData.inventory.map(inv => ({
          ...inv,
          receivedAt: Timestamp.fromDate(inv.receivedAt)
        }))
      };

      // 🔥 NEW APPROACH: Pre-generate documentId, then create with that ID
      const documentId = await this.offlineDocService.createDocument('products', productToCreate);

      // Update the signal with the new product (works with both real and temp IDs)
      this.products.update(products => [
        ...products, 
        { 
          ...productData, 
          id: documentId, 
          companyId, 
          createdAt: new Date(), 
          updatedAt: new Date(),
          // Add offline flag if it's a temporary ID
          isOfflineCreated: documentId.startsWith('temp_')
        }
      ]);
      
      console.log('✅ Product created with pre-generated ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
      return documentId;
    } catch (error) {
      console.error('❌ Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    try {
      // Prepare update data with proper Timestamp conversion
      const updateData: any = { ...updates };

      // Handle inventory array updates
      if (updates.inventory) {
        updateData.inventory = updates.inventory.map(inv => ({
          ...inv,
          receivedAt: Timestamp.fromDate(inv.receivedAt)
        }));
      }

      // 🔥 NEW APPROACH: Use OfflineDocumentService for consistent online/offline updates
      await this.offlineDocService.updateDocument('products', productId, updateData);

      // Update the signal
      this.products.update(products =>
        products.map(product =>
          product.id === productId
            ? { ...product, ...updates, updatedAt: new Date() }
            : product
        )
      );

      console.log('✅ Product updated with ID:', productId, navigator.onLine ? '(online)' : '(offline)');
    } catch (error) {
      console.error('❌ Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      const productRef = doc(this.firestore, 'products', productId);
      await deleteDoc(productRef);

      // Update the signal
      this.products.update(products =>
        products.filter(product => product.id !== productId)
      );
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Inventory management methods
  async updateProductStock(productId: string, newStock: number): Promise<void> {
    await this.updateProduct(productId, { totalStock: newStock });
  }

  async addInventoryBatch(productId: string, batch: ProductInventory): Promise<void> {
    const product = this.getProduct(productId);
    if (product) {
      // Insert new batch at the top
      let updatedInventory: ProductInventory[] = [batch, ...product.inventory];
      // If the new batch is active, mark other batches inactive so only one active exists
      if (batch.status === 'active') {
        updatedInventory = updatedInventory.map((inv, idx) => idx === 0 ? inv : { ...inv, status: 'inactive' });
      }
      // totalStock should be calculated from active batches only
      const totalStock = updatedInventory.reduce((sum, inv) => sum + ((inv.status === 'active') ? inv.quantity : 0), 0);
      await this.updateProduct(productId, { 
        inventory: updatedInventory,
        totalStock 
      });
    }
  }

  async removeInventoryBatch(productId: string, batchId: string): Promise<void> {
    const product = this.getProduct(productId);
    if (product) {
  const updatedInventory = product.inventory.filter(inv => inv.batchId !== batchId);
  // totalStock from active batches only
  const totalStock = updatedInventory.reduce((sum, inv) => sum + ((inv.status === 'active') ? inv.quantity : 0), 0);
      await this.updateProduct(productId, { 
        inventory: updatedInventory,
        totalStock 
      });
    }
  }

  // Getter methods
  getProducts(): Product[] {
    return this.products();
  }

  getProductsByCategory(category: string): Product[] {
    return this.products().filter(product => product.category === category);
  }

  getProduct(productId: string): Product | undefined {
    return this.products().find(product => product.id === productId);
  }

  getProductBySku(sku: string): Product | undefined {
    return this.products().find(product => product.skuId === sku);
  }

  getProductByBarcode(barcode: string): Product | undefined {
    return this.products().find(product => product.barcodeId === barcode);
  }

  searchProducts(searchTerm: string): Product[] {
    const term = searchTerm.toLowerCase();
    return this.products().filter(product => 
      product.productName.toLowerCase().includes(term) ||
      product.skuId.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term) ||
      product.barcodeId?.toLowerCase().includes(term)
    );
  }

  getCategories(): string[] {
    const categories = new Set(this.products().map(p => p.category));
    return Array.from(categories).sort();
  }

  // ============================================
  // PRICE AND QUANTITY TRACKING METHODS
  // ============================================

  /**
   * Update product price and log the change
   */
  async updateProductPrice(
    productId: string, 
    newPrice: number, 
    reason?: string, 
    batchId?: string
  ): Promise<void> {
    try {
      const product = this.getProduct(productId);
      if (!product) throw new Error('Product not found');

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');

      const oldPrice = batchId 
        ? product.inventory.find(inv => inv.batchId === batchId)?.unitPrice || 0
        : product.sellingPrice;

      const changeAmount = newPrice - oldPrice;
      const changePercentage = oldPrice > 0 ? (changeAmount / oldPrice) * 100 : 0;
      const changeType = changeAmount > 0 ? 'increase' : changeAmount < 0 ? 'decrease' : 'initial';

      const priceChange = {
        oldPrice,
        newPrice,
        changeType: changeType as 'increase' | 'decrease' | 'initial',
        changeAmount,
        changePercentage,
        changedAt: new Date(),
        changedBy: currentUser.uid,
        changedByName: currentUser.displayName || currentUser.email || 'Unknown',
        reason: reason || 'Manual price update',
        batchId: batchId || undefined
      };

      const currentHistory = product.priceHistory || [];
      const updatedHistory = [...currentHistory, priceChange];

      if (batchId) {
        // Update batch price
        const updatedInventory = product.inventory.map(inv => 
          inv.batchId === batchId ? { ...inv, unitPrice: newPrice } : inv
        );
        await this.updateProduct(productId, {
          inventory: updatedInventory,
          priceHistory: updatedHistory,
          lastUpdated: new Date()
        });
      } else {
        // Update main selling price
        await this.updateProduct(productId, {
          sellingPrice: newPrice,
          priceHistory: updatedHistory,
          lastUpdated: new Date()
        });
      }

      console.log('✅ Price updated and logged:', priceChange);
    } catch (error) {
      console.error('❌ Error updating price:', error);
      throw error;
    }
  }

  /**
   * Adjust batch quantity and log the change
   */
  async adjustBatchQuantity(
    productId: string,
    batchId: string,
    newQuantity: number,
    adjustmentType: 'manual' | 'sale' | 'return' | 'damage' | 'restock' | 'transfer',
    reason?: string,
    notes?: string
  ): Promise<void> {
    try {
      const product = this.getProduct(productId);
      if (!product) throw new Error('Product not found');

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated');

      const batch = product.inventory.find(inv => inv.batchId === batchId);
      if (!batch) throw new Error('Batch not found');

      const oldQuantity = batch.quantity;

      const quantityAdjustment = {
        batchId,
        oldQuantity,
        newQuantity,
        adjustmentType: adjustmentType as 'manual' | 'sale' | 'return' | 'damage' | 'restock' | 'transfer',
        adjustedAt: new Date(),
        adjustedBy: currentUser.uid,
        adjustedByName: currentUser.displayName || currentUser.email || 'Unknown',
        reason: reason || `${adjustmentType} adjustment`,
        notes: notes || ''
      };

      const currentAdjustments = product.quantityAdjustments || [];
      const updatedAdjustments = [...currentAdjustments, quantityAdjustment];

      // Update batch quantity
      const updatedInventory = product.inventory.map(inv =>
        inv.batchId === batchId ? { ...inv, quantity: newQuantity } : inv
      );

      // Recalculate total stock from active batches
      const totalStock = updatedInventory.reduce(
        (sum, inv) => sum + (inv.status === 'active' ? inv.quantity : 0), 
        0
      );

      await this.updateProduct(productId, {
        inventory: updatedInventory,
        totalStock,
        quantityAdjustments: updatedAdjustments,
        lastUpdated: new Date()
      });

      console.log('✅ Quantity adjusted and logged:', quantityAdjustment);
    } catch (error) {
      console.error('❌ Error adjusting quantity:', error);
      throw error;
    }
  }

  /**
   * Split batch: reduce quantity from existing batch and create new batch
   * Example: "Move 40 units from batch A to new batch B at new price"
   */
  async splitBatch(
    productId: string,
    sourceBatchId: string,
    quantityToMove: number,
    newBatchPrice: number,
    reason?: string
  ): Promise<void> {
    try {
      const product = this.getProduct(productId);
      if (!product) throw new Error('Product not found');

      const sourceBatch = product.inventory.find(inv => inv.batchId === sourceBatchId);
      if (!sourceBatch) throw new Error('Source batch not found');

      if (quantityToMove > sourceBatch.quantity) {
        throw new Error('Cannot move more quantity than available in source batch');
      }

      // Step 1: Reduce quantity in source batch
      const newSourceQuantity = sourceBatch.quantity - quantityToMove;
      await this.adjustBatchQuantity(
        productId,
        sourceBatchId,
        newSourceQuantity,
        'transfer',
        reason || `Moved ${quantityToMove} units to new batch at updated price`,
        `Split from batch ${sourceBatchId}`
      );

      // Step 2: Create new batch
      const newBatchId = `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString().slice(-2)}`;
      const newBatch: ProductInventory = {
        batchId: newBatchId,
        quantity: quantityToMove,
        unitPrice: newBatchPrice,
        costPrice: sourceBatch.costPrice, // Keep same cost price
        receivedAt: new Date(),
        expiryDate: sourceBatch.expiryDate,
        supplier: sourceBatch.supplier,
        status: 'active'
      };

      await this.addInventoryBatch(productId, newBatch);

      // Step 3: Log price change for new batch
      if (newBatchPrice !== sourceBatch.unitPrice) {
        await this.updateProductPrice(
          productId,
          newBatchPrice,
          reason || `New batch created from split with updated price`,
          newBatchId
        );
      }

      console.log(`✅ Batch split: ${quantityToMove} units moved from ${sourceBatchId} to ${newBatchId}`);
    } catch (error) {
      console.error('❌ Error splitting batch:', error);
      throw error;
    }
  }

  /**
   * Get price history for a product
   */
  getPriceHistory(productId: string) {
    const product = this.getProduct(productId);
    return product?.priceHistory || [];
  }

  /**
   * Get quantity adjustment history for a product
   */
  getQuantityAdjustments(productId: string) {
    const product = this.getProduct(productId);
    return product?.quantityAdjustments || [];
  }

  /**
   * Get quantity adjustments for a specific batch
   */
  getBatchAdjustments(productId: string, batchId: string) {
    const adjustments = this.getQuantityAdjustments(productId);
    return adjustments.filter(adj => adj.batchId === batchId);
  }
}
