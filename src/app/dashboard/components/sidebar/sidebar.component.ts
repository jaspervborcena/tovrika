import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  activeSection: string = 'play'; // Default active section
  isMinimized: boolean = false; // Track if the screen is minimized
  breadcrumbs: string[] = []; // Store breadcrumb trail

  constructor(private route:Router) {}
  navigateTo(section: string): void {
    this.activeSection = section; // Update the active section
   
    console.log(`Navigated to: ${section}`);
    this.route.navigate([section]);
    // Add routing logic here if needed
  }

}
