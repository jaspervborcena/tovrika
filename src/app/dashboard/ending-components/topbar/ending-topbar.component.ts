import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';
@Component({
  standalone: true,
  selector: 'app-ending-topbar',
  imports: [CommonModule],
  templateUrl: './ending-topbar.component.html',
  styleUrls: ['./ending-topbar.component.less']
})
export class EndingTopbarComponent {
  activeSection: string = 'cards'; // Default active section
  isMinimized: boolean = false; // Track if the screen is minimized
  breadcrumbs: string[] = []; // Store breadcrumb trail

  constructor(@Inject(PLATFORM_ID) private platformId: Object,private route:Router) {}
  navigateTo(section: string): void {
    this.activeSection = section; // Update the active section
   
    if (isPlatformBrowser(this.platformId)) {
      this.route.navigate([`/ending/${section}`]); // ✅ Executes navigation only in the browser
    }
  }

}
