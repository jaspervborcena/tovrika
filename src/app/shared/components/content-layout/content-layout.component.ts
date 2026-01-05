import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-content-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-100">
      <!-- Content with proper header spacing -->
      <main class="mt-[70px] sm:mt-20">
        <ng-content></ng-content>
      </main>
    </div>
  `
})
export class ContentLayoutComponent {
}
