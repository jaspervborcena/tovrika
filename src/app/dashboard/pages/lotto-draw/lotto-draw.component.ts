import { Component } from '@angular/core';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { PlayComponent } from '../../components/play/play.component';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-lotto-draw',
  imports: [CommonModule, RouterModule,SidebarComponent], // ✅ Add CommonModule here
  templateUrl: './lotto-draw.component.html',
  styleUrls: ['./lotto-draw.component.less']
})
export class LottoDrawComponent {
  activeSection: string = 'play'; // Default active section

  // Method to update active section when sidebar emits a change
  setActiveSection(section: string): void {
    this.activeSection = section; // Update active section
    console.log(`Active section set to: ${section}`);
  }

}
  // updateWinCombi(drawId: string, newCombi: string) {
  //   this.lottoService.updateBetWinCombi(drawId, newCombi)
  //     .then(() => console.log('Win combination updated!'))
  //     .catch(error => console.error('Error updating:', error));
  // }
