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
      
      status: data['status'] || 'active',
      createdAt: data['createdAt']?.toDate() || new Date(),
      updatedAt: data['updatedAt']?.toDate() || new Date()
    };
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
}
