import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Inventory Management</h1>
      
      <!-- Placeholder for inventory content -->
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-gray-600">Inventory management features coming soon...</p>
      </div>
    </div>
  `,
  styles: []
})
export class InventoryComponent {
  constructor() {}
}
