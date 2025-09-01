import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../../../interfaces/product.interface';
import { ProductViewType } from '../../../../../interfaces/pos.interface';

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.css'
})
export class ProductCatalogComponent {
  @Input() products: Product[] = [];
  @Input() categories: string[] = [];
  @Input() selectedCategory = '';
  @Input() searchQuery = '';
  @Input() currentView: ProductViewType = 'grid';
  @Input() accessTab = 'New';

  @Output() categorySelected = new EventEmitter<string>();
  @Output() searchChanged = new EventEmitter<string>();
  @Output() searchCleared = new EventEmitter<void>();
  @Output() viewChanged = new EventEmitter<ProductViewType>();
  @Output() accessTabChanged = new EventEmitter<string>();
  @Output() productSelected = new EventEmitter<Product>();

  readonly accessTabs = ['New', 'Featured'];
  
  private searchInputSignal = signal('');

  onCategoryClick(category: string): void {
    this.categorySelected.emit(category);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    this.searchInputSignal.set(value);
    this.searchChanged.emit(value);
  }

  onClearSearch(): void {
    this.searchInputSignal.set('');
    this.searchCleared.emit();
  }

  onViewChange(view: ProductViewType): void {
    this.viewChanged.emit(view);
  }

  onAccessTabChange(tab: string): void {
    this.accessTabChanged.emit(tab);
  }

  onProductClick(product: Product): void {
    this.productSelected.emit(product);
  }

  get searchInputValue(): string {
    return this.searchInputSignal();
  }

  set searchInputValue(value: string) {
    this.searchInputSignal.set(value);
  }
}
