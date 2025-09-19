import { Injectable, computed, signal } from '@angular/core';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  orderBy,
  addDoc,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { AuthService } from './auth.service';

export interface ProductCategory {
  id?: string;
  categoryId: string;
  categoryLabel: string;
  categoryDescription: string;
  categoryGroup: string;
  categoryIcon?: string;
  isActive: boolean;
  sortOrder?: number;
  companyId: string;
  storeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private categoriesSignal = signal<ProductCategory[]>([]);
  private isLoading = false;
  private loadTimestamp: number | null = null;

  // Computed properties
  categories = computed(() => this.categoriesSignal());
  activeCategories = computed(() => 
    this.categoriesSignal().filter(cat => cat.isActive)
  );

  constructor(private authService: AuthService) {}

  /**
   * Load categories for a specific company
   */
  async loadCategoriesByCompany(companyId: string): Promise<ProductCategory[]> {
    if (this.isLoading) {
      console.log('⏳ Categories already loading, skipping...');
      return this.categoriesSignal();
    }

    try {
      this.isLoading = true;
      console.log('🏷️ CategoryService.loadCategoriesByCompany called with companyId:', companyId);

      const categoriesRef = collection(db, 'categories');
      const q = query(
        categoriesRef,
        where('companyId', '==', companyId),
        orderBy('sortOrder'),
        orderBy('categoryLabel')
      );

      const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
      const categories: ProductCategory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        categories.push({
          id: doc.id,
          categoryId: data['categoryId'],
          categoryLabel: data['categoryLabel'],
          categoryDescription: data['categoryDescription'],
          categoryGroup: data['categoryGroup'],
          categoryIcon: data['categoryIcon'],
          isActive: data['isActive'] ?? true,
          sortOrder: data['sortOrder'] ?? 0,
          companyId: data['companyId'],
          storeId: data['storeId'],
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        });
      });

      this.categoriesSignal.set(categories);
      this.loadTimestamp = Date.now();
      
      console.log('✅ Categories loaded and signal updated. Current categories:', categories.length);
      return categories;

    } catch (error) {
      console.error('❌ Error loading categories:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Create a new category
   */
  async createCategory(categoryData: Omit<ProductCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date();
      const newCategory: Omit<ProductCategory, 'id'> = {
        ...categoryData,
        createdAt: now,
        updatedAt: now
      };

      const categoriesRef = collection(db, 'categories');
      const docRef = await addDoc(categoriesRef, newCategory);
      
      // Refresh categories after creation
      await this.loadCategoriesByCompany(categoryData.companyId);
      
      console.log('✅ Category created with ID:', docRef.id);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error creating category:', error);
      throw error;
    }
  }

  /**
   * Update an existing category
   */
  async updateCategory(categoryId: string, categoryData: Partial<ProductCategory>): Promise<void> {
    try {
      const categoryRef = doc(db, 'categories', categoryId);
      const updateData = {
        ...categoryData,
        updatedAt: new Date()
      };

      await updateDoc(categoryRef, updateData);
      
      // Refresh categories after update
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        await this.loadCategoriesByCompany(currentPermission.companyId);
      }
      
      console.log('✅ Category updated:', categoryId);

    } catch (error) {
      console.error('❌ Error updating category:', error);
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const categoryRef = doc(db, 'categories', categoryId);
      await deleteDoc(categoryRef);
      
      // Refresh categories after deletion
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        await this.loadCategoriesByCompany(currentPermission.companyId);
      }
      
      console.log('✅ Category deleted:', categoryId);

    } catch (error) {
      console.error('❌ Error deleting category:', error);
      throw error;
    }
  }

  /**
   * Generate a category ID from label
   */
  generateCategoryId(label: string): string {
    return 'cat_' + label.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Auto-create category from user input
   */
  async createCategoryFromInput(
    categoryLabel: string, 
    companyId: string, 
    storeId?: string
  ): Promise<ProductCategory> {
    const categoryId = this.generateCategoryId(categoryLabel);
    
    const categoryData: Omit<ProductCategory, 'id' | 'createdAt' | 'updatedAt'> = {
      categoryId,
      categoryLabel: categoryLabel.trim(),
      categoryDescription: `Auto-created category for ${categoryLabel.trim()}`,
      categoryGroup: 'General',
      isActive: true,
      sortOrder: 0,
      companyId,
      storeId
    };

    const newCategoryId = await this.createCategory(categoryData);
    
    // Return the created category
    const categories = this.categoriesSignal();
    const newCategory = categories.find(cat => cat.id === newCategoryId);
    
    if (!newCategory) {
      throw new Error('Failed to retrieve created category');
    }
    
    return newCategory;
  }

  /**
   * Search categories by label
   */
  searchCategories(searchTerm: string): ProductCategory[] {
    if (!searchTerm.trim()) {
      return this.activeCategories();
    }

    const term = searchTerm.toLowerCase();
    return this.activeCategories().filter(category =>
      category.categoryLabel.toLowerCase().includes(term) ||
      category.categoryDescription.toLowerCase().includes(term) ||
      category.categoryGroup.toLowerCase().includes(term)
    );
  }

  /**
   * Get categories as simple string array for autocomplete
   */
  getCategoryLabels(): string[] {
    return this.activeCategories().map(cat => cat.categoryLabel);
  }

  /**
   * Check if category exists by label
   */
  categoryExists(label: string): boolean {
    return this.activeCategories().some(cat => 
      cat.categoryLabel.toLowerCase() === label.toLowerCase()
    );
  }

  /**
   * Get category by label
   */
  getCategoryByLabel(label: string): ProductCategory | undefined {
    return this.activeCategories().find(cat => 
      cat.categoryLabel.toLowerCase() === label.toLowerCase()
    );
  }

  /**
   * Get all categories
   */
  getCategories(): ProductCategory[] {
    return this.categoriesSignal();
  }

  /**
   * Get active categories only
   */
  getActiveCategories(): ProductCategory[] {
    return this.activeCategories();
  }

  /**
   * Debug method to check category status
   */
  debugCategoryStatus() {
    const categories = this.getCategories();
    console.log('🔍 CategoryService Debug Status:');
    console.log('  - Total categories:', categories.length);
    console.log('  - Active categories:', this.activeCategories().length);
    console.log('  - Last load time:', this.loadTimestamp ? new Date(this.loadTimestamp).toLocaleTimeString() : 'Never');
    console.log('  - Is loading:', this.isLoading);
    console.log('  - Categories:', categories.map(c => ({ 
      id: c.id, 
      label: c.categoryLabel, 
      group: c.categoryGroup,
      active: c.isActive 
    })));
    return { 
      categories, 
      activeCount: this.activeCategories().length, 
      totalCount: categories.length, 
      lastLoad: this.loadTimestamp, 
      isLoading: this.isLoading 
    };
  }
}