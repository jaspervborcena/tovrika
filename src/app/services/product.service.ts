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
import { Product } from '../interfaces/product.interface';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly products = signal<Product[]>([]);
  
  // Computed properties
  readonly totalProducts = computed(() => this.products().length);
  readonly productsByCategory = computed(() => {
    const categoryMap = new Map<string, Product[]>();
    this.products().forEach(product => {
      const products = categoryMap.get(product.category) || [];
      products.push(product);
      categoryMap.set(product.category, products);
    });
    return categoryMap;
  });

  constructor(private firestore: Firestore) {}

  private transformFirestoreDoc(doc: any): Product {
    const data = doc.data();
    return {
      id: doc.id,
      companyId: data['companyId'] || '',
      storeId: data['storeId'],
      branchId: data['branchId'],
      name: data['name'],
      description: data['description'],
      price: data['price'],
      category: data['category'],
      sku: data['sku'],
      barcode: data['barcode'],
      imageUrl: data['imageUrl'],
      status: data['status'] as 'active' | 'inactive' || 'active',
      productType: data['productType'] || 'product',
      inventorySettings: {
        trackInventory: data['trackInventory'] ?? true,
        stockQuantity: data['stockQuantity'] || 0,
        lowStockAlert: data['lowStockAlert'],
        unit: data['unit'] || 'pieces',
        cost: data['cost']
      },
      businessTypeSettings: {
        taxable: data['taxable'] ?? true,
        taxRate: data['taxRate'],
        ingredients: data['ingredients'] || [],
        isComboMeal: data['isComboMeal'],
        comboItems: data['comboItems'],
        duration: data['duration'],
        requiresEquipment: data['requiresEquipment']
      },
      createdAt: data['createdAt']?.toDate() || new Date(),
      updatedAt: data['updatedAt']?.toDate() || new Date()
    };
  }

  async loadProducts(companyId: string) {
    try {
      const productsRef = collection(
        this.firestore,
        `companies/${companyId}/products`
      );
      const querySnapshot = await getDocs(productsRef);
      const products = querySnapshot.docs.map(this.transformFirestoreDoc);
      
      this.products.set(products);
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const productsRef = collection(this.firestore, 'products');
      
      const newProduct: Omit<Product, 'id'> = {
        ...productData,
        status: productData.status || 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = doc(productsRef);
      await setDoc(docRef, newProduct);

      // Update the signal
      this.products.update(products => [
        ...products, 
        { ...newProduct, id: docRef.id }
      ]);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(companyId: string, productId: string, updates: Partial<Product>) {
    try {
      const productRef = doc(
        this.firestore,
        `companies/${companyId}/products/${productId}`
      );
      
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await updateDoc(productRef, updateData);

      // Update the signal
      this.products.update(products =>
        products.map(product =>
          product.id === productId
            ? { ...product, ...updateData }
            : product
        )
      );
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(companyId: string, productId: string) {
    try {
      const productRef = doc(
        this.firestore,
        `companies/${companyId}/products/${productId}`
      );
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

  // Get all products
  getProducts() {
    return this.products();
  }

  // Get products by category
  getProductsByCategory(category: string) {
    return this.products().filter(product => product.category === category);
  }

  // Get a specific product
  getProduct(productId: string) {
    return this.products().find(product => product.id === productId);
  }

  // Get products below minimum stock level
  getLowStockProducts(minStock: number) {
    return computed(() => 
      this.products().filter(product => 
        product.inventorySettings.stockQuantity < minStock
      )
    );
  }
}
