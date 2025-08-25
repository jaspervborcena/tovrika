import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, MainLayoutComponent],
  template: `
    <app-main-layout>
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          <div class="bg-white shadow sm:rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h2 class="text-lg font-medium text-gray-900">Notifications</h2>
              <div class="mt-4">
                <p class="text-gray-500">No new notifications</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-main-layout>
  `
})
export class NotificationsComponent {}
