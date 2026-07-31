import { Injectable, computed, signal, inject } from '@angular/core';
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
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';

export interface ProductCategory {
  id?: string;
  categoryId: string;
  categoryLabel: string;
  categoryDescription: string;
  categoryGroup: string;
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

  constructor(
    private authService: AuthService,
    private offlineDocService: OfflineDocumentService,
    private firestoreSecurityService: FirestoreSecurityService
  ) {}

  /**
   * Load categories for a specific store
   */
  async loadCategoriesByStore(storeId: string): Promise<ProductCategory[]> {
    if (this.isLoading) {
      console.log('⏳ Categories already loading, skipping...');
      return this.categoriesSignal();
    }

    try {
      this.isLoading = true;
      console.log('🏷️ CategoryService.loadCategoriesByStore called with storeId:', storeId);

      const categoriesRef = collection(db, 'categories');
      const q = query(
        categoriesRef,
        where('storeId', '==', storeId)
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
          isActive: data['isActive'] ?? true,
          sortOrder: data['sortOrder'] ?? 0,
          companyId: data['companyId'],
          storeId: data['storeId'],
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        });
      });

      // Sort categories by categoryLabel in JavaScript since we can't use orderBy in Firestore query
      categories.sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel));

      this.categoriesSignal.set(categories);
      this.loadTimestamp = Date.now();
      
      console.log('✅ Categories loaded and signal updated. Current categories:', categories.length);
      
      // Debug: Log category details for troubleshooting
      if (categories.length === 0) {
        console.log('⚠️ No categories found for storeId:', storeId);
        console.log('🔍 This could mean:');
        console.log('  - No categories exist in Firestore for this store');
        console.log('  - Firestore query failed');
        console.log('  - Data structure mismatch');
      }
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
      // Test Firestore connection first
      console.log('🔍 Testing Firestore connection...');
      const testRef = collection(db, 'test');
      console.log('🔍 Test collection reference created successfully');
      
      const now = new Date();
      const newCategory: Omit<ProductCategory, 'id'> = {
        ...categoryData,
        createdAt: now,
        updatedAt: now
      };

      console.log('🔍 Creating category with offline-safe document service...');
      // 🔥 NEW APPROACH: Use OfflineDocumentService for offline-safe creation
      const documentId = await this.offlineDocService.createDocument('categories', newCategory);
      
      // Refresh categories after creation
      console.log('🔍 Refreshing categories after creation...');
      if (categoryData.storeId) {
        await this.loadCategoriesByStore(categoryData.storeId);
      }
      
      console.log('✅ Category created with ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
      return documentId;

    } catch (error) {
      console.error('❌ Error creating category:', error);
      console.error('❌ Error name:', (error as any)?.name);
      console.error('❌ Error message:', (error as any)?.message);
      console.error('❌ Error code:', (error as any)?.code);
      console.error('❌ Error stack:', (error as any)?.stack);
      
      // Check if it's a permission error
      if ((error as any)?.code === 'permission-denied') {
        console.error('❌ PERMISSION DENIED: Check Firestore security rules');
        throw new Error('Permission denied: Unable to create category. Please check your Firestore security rules.');
      }
      
      // Check if it's a network error
      if ((error as any)?.code === 'unavailable') {
        console.error('❌ NETWORK ERROR: Firestore unavailable');
        throw new Error('Network error: Unable to connect to Firestore. Please check your internet connection.');
      }
      
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

      await this.offlineDocService.updateDocument('categories', categoryId, updateData);
      
      // Refresh categories after update
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.storeId) {
        await this.loadCategoriesByStore(currentPermission.storeId);
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
  await this.offlineDocService.deleteDocument('categories', categoryId);
      
      // Refresh categories after deletion
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.storeId) {
        await this.loadCategoriesByStore(currentPermission.storeId);
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

  findCategoryByStoreNameAndGroup(storeId: string, categoryLabel: string, categoryGroup: string): ProductCategory | undefined {
    const normalizedLabel = (categoryLabel || '').trim().toLowerCase();
    const normalizedGroup = (categoryGroup || 'General').trim().toLowerCase();

    return this.categoriesSignal().find(cat =>
      (cat.storeId || '').toLowerCase() === (storeId || '').toLowerCase() &&
      (cat.categoryLabel || '').trim().toLowerCase() === normalizedLabel &&
      (cat.categoryGroup || 'General').trim().toLowerCase() === normalizedGroup
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
   * Auto-save category if it doesn't exist (for product creation)
   */
  async ensureCategoryExists(categoryLabel: string, storeId: string): Promise<void> {
    await this.ensureCategoryExistsWithGroup(categoryLabel, 'General', storeId);
  }

  async ensureCategoryExistsWithGroup(
    categoryLabel: string,
    categoryGroup: string,
    storeId: string
  ): Promise<ProductCategory | undefined> {
    console.log('🔍 ensureCategoryExistsWithGroup called with:', { categoryLabel, categoryGroup, storeId });

    const normalizedLabel = (categoryLabel || '').trim();
    const normalizedGroup = (categoryGroup || 'General').trim() || 'General';

    if (!normalizedLabel) {
      console.log('❌ Category label is empty, returning');
      return undefined;
    }

    await this.loadCategoriesByStore(storeId);

    const exists = this.findCategoryByStoreNameAndGroup(storeId, normalizedLabel, normalizedGroup);
    if (exists) {
      console.log('✅ Category already exists, skipping creation');
      return exists;
    }

    try {
      console.log('🚀 Creating new category...');
      const categoryData: Omit<ProductCategory, 'id' | 'createdAt' | 'updatedAt'> = {
        categoryId: this.generateCategoryId(normalizedLabel),
        categoryLabel: normalizedLabel,
        categoryDescription: `Auto-created from product: ${normalizedLabel}`,
        categoryGroup: normalizedGroup,
        isActive: true,
        sortOrder: 0,
        companyId: '',
        storeId: storeId
      };

      const newCategoryId = await this.createCategory(categoryData);
      const categories = this.categoriesSignal();
      const created = categories.find(cat => cat.id === newCategoryId);
      console.log('✅ Auto-created category:', normalizedLabel, 'group:', normalizedGroup);
      return created;
    } catch (error) {
      console.error('❌ Error auto-creating category:', error);
      return undefined;
    }
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
    return { 
      categories, 
      activeCount: this.activeCategories().length, 
      totalCount: categories.length, 
      lastLoad: this.loadTimestamp, 
      isLoading: this.isLoading 
    };
  }
}