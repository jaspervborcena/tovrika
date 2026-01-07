import { Component, HostBinding, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-content-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-100">
      <!-- Content with dynamic header spacing -->
      <main [class]="mainClass">
        <ng-content></ng-content>
      </main>
    </div>
  `
})
export class ContentLayoutComponent implements OnInit, OnDestroy {
  mainClass = 'mt-[70px] sm:mt-20';
  private storageListener?: () => void;

  ngOnInit() {
    // Check initial header state
    this.updateMargin();
    
    // Listen for header collapse changes
    this.storageListener = () => {
      this.updateMargin();
    };
    window.addEventListener('storage', this.storageListener);
    
    // Also listen for custom event (for same-tab updates)
    window.addEventListener('headerCollapsed', this.storageListener);
  }

  ngOnDestroy() {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
      window.removeEventListener('headerCollapsed', this.storageListener);
    }
  }

  private updateMargin() {
    const isCollapsed = localStorage.getItem('headerCollapsed') === 'true';
    this.mainClass = isCollapsed ? '' : 'mt-[70px] sm:mt-20';
  }
}
