
import { Component } from '@angular/core';
import { EndingTopbarComponent } from '../../ending-components/topbar/ending-topbar.component';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule,EndingTopbarComponent], // ✅ Add CommonModule here
  selector: 'app-ending',
  templateUrl: './ending.component.html',
  styleUrl: './ending.component.less'
})
export class EndingComponent {
  activeSection: string = 'play'; // Default active section

  // Method to update active section when sidebar emits a change
  setActiveSection(section: string): void {
    this.activeSection = section; // Update active section
    console.log(`Active section set to: ${section}`);
  }

}
  