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
    <div class="flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    *ngFor="let col of columns"
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {{ col.label }}
                  </th>
                  <th
                    *ngIf="showActions"
                    scope="col"
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let item of data">
                  <td
                    *ngFor="let col of columns"
                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {{ col.format ? col.format(item[col.key]) : item[col.key] }}
                  </td>
                  <td *ngIf="showActions" class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="flex justify-end space-x-2">
                      <ui-button
                        variant="secondary"
                        (click)="onEdit.emit(item)"
                      >
                        Edit
                      </ui-button>
                      <ui-button
                        variant="danger"
                        (click)="onDelete.emit(item)"
                      >
                        Delete
                      </ui-button>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="data.length === 0">
                  <td
                    [attr.colspan]="showActions ? columns.length + 1 : columns.length"
                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                  >
                    No data available
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() showActions = true;

  @Output() onEdit = new EventEmitter<any>();
  @Output() onDelete = new EventEmitter<any>();
}
