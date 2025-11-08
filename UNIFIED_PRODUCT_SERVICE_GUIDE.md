# Unified Angular ProductService with Firestore Real-time Updates

## Overview

The `ProductService` has been completely rewritten to provide:
- **Real-time updates** using Firestore `onSnapshot()`
- **Offline support** with IndexedDB persistence
- **Signal-based reactive cache** for optimal performance
- **Automatic synchronization** across all components
- **Single source of truth** for product data

## Key Features

### ✅ Real-time Updates
- Uses Firestore `onSnapshot()` to listen for changes
- Automatically updates UI when products are added, modified, or deleted
- Handles both online and offline state changes

### ✅ Offline Support
- Enables Firestore persistence with IndexedDB
- Falls back to cached data when offline
- Automatically syncs when connection is restored

### ✅ Signal-based Reactive Cache
- Central signal-based product cache using Angular signals
- Computed properties for derived data (categories, low stock, etc.)
- Reactive access methods for components

### ✅ Performance Optimizations
- Loads products only once per store (≤100 items)
- Avoids duplicate reads
- Optimistic updates for immediate UI feedback
- Normalized and deduplicated data

## Migration Guide

### Before (Old BigQuery/Manual Loading)
```typescript
// Component initialization
async ngOnInit() {
  const count = await this.productService.loadProducts(storeId, pageSize, pageNumber);
  this.products = this.productService.getProducts();
}

// Manual refresh
async refreshProducts() {
  await this.productService.loadProductsFromFirestore(storeId);
}
```

### After (New Real-time Service)
```typescript
// Component initialization
async ngOnInit() {
  await this.productService.initializeProducts(storeId);
  // Products automatically update via signals - no manual refresh needed
}

// Access reactive data
products = this.productService.getProductsSignal();
isLoading = this.productService.getLoadingSignal();
error = this.productService.getErrorSignal();
```

## API Reference

### Initialization Methods
```typescript
// Main initialization method - call this once per store
await productService.initializeProducts(storeId: string, forceReload = false): Promise<void>

// Force refresh (rare - usually not needed due to real-time updates)
await productService.refreshProducts(storeId?: string): Promise<void>
```

### Reactive Access Methods
```typescript
// Get reactive signals (automatically update UI)
const products = productService.getProductsSignal();
const isLoading = productService.getLoadingSignal();
const error = productService.getErrorSignal();
const isOnline = productService.getOnlineStatusSignal();

// Check initialization status
const isInitialized = productService.isInitialized(): boolean;
```

### Legacy Compatibility Methods
```typescript
// Still available for backward compatibility
const products = productService.getProducts(): Product[];
const product = productService.getProduct(id): Product | undefined;
const categories = productService.getCategories(): string[];
```

## Component Usage Examples

### Basic Component Setup
```typescript
@Component({
  template: `
    <div *ngIf="isLoading()">Loading products...</div>
    <div *ngIf="error()">Error: {{ error() }}</div>
    <div *ngFor="let product of products()" class="product-card">
      {{ product.productName }} - {{ product.sellingPrice | currency }}
    </div>
  `
})
export class ProductListComponent implements OnInit {
  // Reactive signals - automatically update UI
  products = this.productService.getProductsSignal();
  isLoading = this.productService.getLoadingSignal();
  error = this.productService.getErrorSignal();

  constructor(private productService: ProductService) {}

  async ngOnInit() {
    const storeId = this.getCurrentStoreId();
    await this.productService.initializeProducts(storeId);
  }
}
```

### POS Component Example
```typescript
@Component({
  selector: 'app-pos',
  template: `
    <div class="pos-products">
      <div *ngFor="let product of activeProducts()" 
           (click)="addToCart(product)"
           class="product-item">
        <span>{{ product.productName }}</span>
        <span>{{ product.sellingPrice | currency }}</span>
        <span class="stock">Stock: {{ product.totalStock }}</span>
      </div>
    </div>
  `
})
export class POSComponent implements OnInit {
  // Use computed properties for filtered data
  activeProducts = computed(() => 
    this.productService.products().filter(p => p.status === 'active' && p.totalStock > 0)
  );

  constructor(private productService: ProductService) {}

  async ngOnInit() {
    // Products will be automatically shared if already initialized
    const storeId = this.getCurrentStoreId();
    await this.productService.initializeProducts(storeId);
  }

  addToCart(product: Product) {
    // Product data is always up-to-date due to real-time updates
    this.cartService.addItem(product);
  }
}
```

## Benefits

### For Developers
- **Simplified API**: Single initialization call per store
- **Reactive by default**: No manual state management
- **Type-safe**: Full TypeScript support with computed properties
- **Error handling**: Built-in error states and offline support

### For Users
- **Real-time updates**: See changes immediately across all screens
- **Offline support**: App works without internet connection
- **Better performance**: Faster load times and reduced network usage
- **Consistent data**: No stale data or sync issues

## Migration Checklist

### ✅ Update Component Initialization
- [ ] Replace `loadProducts()` calls with `initializeProducts()`
- [ ] Remove manual pagination logic (handled automatically)
- [ ] Update to use reactive signals instead of manual state

### ✅ Update Templates
- [ ] Use signal syntax: `products()` instead of `products`
- [ ] Add loading and error states using reactive signals
- [ ] Remove manual refresh buttons (auto-updates)

### ✅ Test Offline Functionality
- [ ] Test app works offline
- [ ] Verify data syncs when coming back online
- [ ] Check IndexedDB persistence

### ✅ Remove Deprecated Code
- [ ] Remove BigQuery-related environment variables in production
- [ ] Clean up old pagination components
- [ ] Remove manual refresh methods

## Troubleshooting

### Products not loading
1. Check if `initializeProducts()` was called
2. Verify user authentication and permissions
3. Check Firestore security rules
4. Look for console errors

### Real-time updates not working
1. Verify internet connection
2. Check Firestore indexes are deployed
3. Ensure proper authentication
4. Check browser console for errors

### Offline mode issues
1. Verify IndexedDB is enabled in browser
2. Check if initial data was cached
3. Test online → offline → online transition

## Performance Notes

- Service loads maximum 100 products per store
- Products are cached in memory and IndexedDB
- Real-time listener automatically handles additions/updates/deletions
- Optimistic updates provide immediate UI feedback
- Network requests are minimized through caching

## Future Enhancements

- Search and filtering optimizations
- Pagination for stores with >100 products
- Real-time inventory quantity updates
- Conflict resolution for concurrent edits