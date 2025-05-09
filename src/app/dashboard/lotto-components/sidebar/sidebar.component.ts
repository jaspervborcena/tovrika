import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';
@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.less']
})
export class SidebarComponent {
  activeSection: string = 'play'; // Default active section
  isMinimized: boolean = false; // Track if the screen is minimized
  breadcrumbs: string[] = []; // Store breadcrumb trail

  constructor(@Inject(PLATFORM_ID) private platformId: Object,private route:Router) {}
  navigateTo(section: string): void {
    this.activeSection = section; // Update the active section
   
    if (isPlatformBrowser(this.platformId)) {
      this.route.navigate([`/draw/${section}`]); // ✅ Executes navigation only in the browser
    }
  }

}
