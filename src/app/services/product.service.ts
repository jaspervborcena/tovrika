import { Injectable, computed, signal } from '@angular/core';
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

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly products = signal<Product[]>([]);
  
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
    private authService: AuthService
  ) {}

  private transformFirestoreDoc(doc: any): Product {
    const data = doc.data();
    return {
      id: doc.id,
      productName: data['productName'] || '',
      skuId: data['skuId'] || '',
      category: data['category'] || '',
      totalStock: data['totalStock'] || 0,
      sellingPrice: data['sellingPrice'] || 0,
      companyId: data['companyId'] || '',
      storeId: data['storeId'] || '',
      isMultipleInventory: data['isMultipleInventory'] || false,
      barcodeId: data['barcodeId'] || '',
      qrCode: data['qrCode'] || '',
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
      receivedAt: item.receivedAt?.toDate() || new Date(),
      status: item.status || 'active'
    }));
  }

  private async waitForAuth(): Promise<string> {
    return new Promise((resolve, reject) => {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.companyId) {
        resolve(currentUser.companyId);
        return;
      }

      // Use effect to watch for auth changes
      let attempts = 0;
      const checkAuth = () => {
        const user = this.authService.getCurrentUser();
        if (user?.companyId) {
          resolve(user.companyId);
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
      console.log("loadProductsByCompanyAndStore",products)
      this.products.set(products);
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  }
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const companyId = await this.waitForAuth();
      const productsRef = collection(this.firestore, 'products');
      
      const newProduct = {
        ...productData,
        companyId,
        status: productData.status || 'active',
        inventory: productData.inventory.map(inv => ({
          ...inv,
          receivedAt: Timestamp.fromDate(inv.receivedAt)
        })),
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };

      const docRef = await addDoc(productsRef, newProduct);

      // Update the signal
      this.products.update(products => [
        ...products, 
        { ...productData, id: docRef.id, companyId, createdAt: new Date(), updatedAt: new Date() }
      ]);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    try {
      const productRef = doc(this.firestore, 'products', productId);
      
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

      // Handle inventory array updates
      if (updates.inventory) {
        updateData.inventory = updates.inventory.map(inv => ({
          ...inv,
          receivedAt: Timestamp.fromDate(inv.receivedAt)
        }));
      }
      
      await updateDoc(productRef, updateData);

      // Update the signal
      this.products.update(products =>
        products.map(product =>
          product.id === productId
            ? { ...product, ...updates, updatedAt: new Date() }
            : product
        )
      );
    } catch (error) {
      console.error('Error updating product:', error);
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
