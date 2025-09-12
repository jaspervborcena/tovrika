import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
  <!-- Removed Toggle Sidebar (Global Test) button -->
    <main class="min-h-screen bg-gray-100">
      <router-outlet></router-outlet>
    </main> 
  `,
  styles: []
})
export class AppComponent {
  title = 'POS System';
}
