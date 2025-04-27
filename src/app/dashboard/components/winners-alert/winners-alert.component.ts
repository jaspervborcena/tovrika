import { Component, Input, Output, EventEmitter,CUSTOM_ELEMENTS_SCHEMA  } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule for ngFor

@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'app-winners-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './winners-alert.component.html',
  styleUrls: ['./winners-alert.component.scss'] // Fixed the property name
})
export class WinnersAlertComponent {
  @Input() isModalOpen: boolean = false;
  @Input() modalTitle: string = 'Confirm Removal'; // Changed default title
  @Input() modalWinner: string = ''; // Winner name to remove
  @Input() prize: string = ''; // Winner name to remove
  
  @Output() playerRemoved = new EventEmitter<string>(); // Emit event when a player is removed

  closeModal() {
    this.isModalOpen = false;
  }

  removePlayer() {
    this.playerRemoved.emit(this.modalWinner); // Emit the winner name to be removed
    this.closeModal(); // Close the modal after removing
  }

  openModal(winner: string) {
    this.modalWinner = winner;
    this.isModalOpen = true;
  }
}
