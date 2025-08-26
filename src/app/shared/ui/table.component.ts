import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button.component';

export interface TableColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
}

@Component({
  selector: 'ui-table',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <!-- Table Header -->
          <thead class="bg-gray-50">
            <tr>
              <th
                *ngFor="let col of columns"
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                [class.w-full]="col.key === 'name' || col.key === 'title'"
                [class.text-right]="col.key === 'price' || col.key === 'amount' || col.key === 'total'"
              >
                {{ col.label }}
              </th>
              <th
                *ngIf="showActions"
                scope="col"
                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
              >
                Actions
              </th>
            </tr>
          </thead>
          
          <!-- Table Body -->
          <tbody class="bg-white divide-y divide-gray-200">
            <tr *ngFor="let item of data; trackBy: trackByFn" class="hover:bg-gray-50 transition-colors duration-150">
              <td
                *ngFor="let col of columns"
                class="px-6 py-4 whitespace-nowrap"
                [class.text-right]="col.key === 'price' || col.key === 'amount' || col.key === 'total'"
                [class.font-medium]="col.key === 'name' || col.key === 'title'"
                [class.text-gray-900]="col.key === 'name' || col.key === 'title'"
                [class.text-gray-500]="col.key !== 'name' && col.key !== 'title'"
              >
                <ng-container [ngSwitch]="col.key">
                  <!-- Status badges -->
                  <span *ngSwitchCase="'status'" 
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [ngClass]="getStatusClass(item[col.key])">
                    {{ col.format ? col.format(item[col.key]) : item[col.key] }}
                  </span>
                  
                  <!-- Currency formatting -->
                  <span *ngSwitchCase="'price'" class="text-sm font-mono">
                    {{ col.format ? col.format(item[col.key]) : (item[col.key] | currency) }}
                  </span>
                  <span *ngSwitchCase="'total'" class="text-sm font-mono font-medium">
                    {{ col.format ? col.format(item[col.key]) : (item[col.key] | currency) }}
                  </span>
                  
                  <!-- Default content -->
                  <span *ngSwitchDefault class="text-sm">
                    {{ col.format ? col.format(item[col.key]) : item[col.key] }}
                  </span>
                </ng-container>
              </td>
              
              <!-- Actions column -->
              <td *ngIf="showActions" class="px-6 py-4 whitespace-nowrap text-right">
                <div class="flex justify-end space-x-2">
                  <ui-button
                    variant="ghost"
                    size="sm"
                    (click)="onEdit.emit(item)"
                    title="Edit"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </ui-button>
                  <ui-button
                    variant="danger"
                    size="sm"
                    (click)="onDelete.emit(item)"
                    title="Delete"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </ui-button>
                </div>
              </td>
            </tr>
            
            <!-- Empty state -->
            <tr *ngIf="data.length === 0">
              <td
                [attr.colspan]="showActions ? columns.length + 1 : columns.length"
                class="px-6 py-12 text-center"
              >
                <div class="flex flex-col items-center justify-center text-gray-500">
                  <svg class="icon-xl mb-4 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p class="text-sm font-medium">{{ emptyMessage }}</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class TableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() showActions = true;
  @Input() emptyMessage = 'No data available';

  @Output() onEdit = new EventEmitter<any>();
  @Output() onDelete = new EventEmitter<any>();

  trackByFn(index: number, item: any): any {
    return item.id || index;
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'available':
      case 'success':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'inactive':
      case 'unavailable':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'failed':
      case 'disabled':
        return 'bg-red-100 text-red-800';
      case 'draft':
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}
