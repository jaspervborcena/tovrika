import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ChunkErrorService } from './core/services/chunk-error.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `
  <!-- Removed Toggle Sidebar (Global Test) button -->
    <main class="min-h-screen bg-gray-100">
      <router-outlet></router-outlet>
    </main>
    
    <!-- Global Toast Container -->
    <app-toast></app-toast>
  `,
  styles: []
})
export class AppComponent {
  title = 'POS System';
  
  // Initialize chunk error handling
  private chunkErrorService = inject(ChunkErrorService);
  
  constructor() {
    // Service auto-initializes when injected
    console.log('🛡️ Chunk error protection enabled');
  }
}
