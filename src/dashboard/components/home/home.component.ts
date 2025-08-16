import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {  FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
export interface TemplateCard {
  id: string;
  title: string;
  description: string;
  imageUrl?: string; // Optional image
}
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule,  FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent {
  defaultImage = 'https://via.placeholder.com/80?text=Form'; // Change as needed
 constructor(private router: Router) {}
  templates: TemplateCard[] = [
    {
      id: 'contact-info',
      title: 'Contact Info',
      description: 'Collect name, email, and phone number.',
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/906/906794.png'
    },
    {
      id: 'party-invite',
      title: 'Party Invite',
      description: 'Let guests RSVP and choose preferences.',
      imageUrl: '/assets/images/no_image_template.png'
      // No image, will use default
    },
    {
      id: 'event-registration',
      title: 'Event Register',
      description: 'Gather attendees and schedule details.',
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/270/270014.png'
    }
  ];

  createBlankTemplate() {
  this.router.navigate(['/create-template']);
}

  loadTemplate(templateId: string) {
    console.log(`Load template: ${templateId}`);
  }
  onGetStarted(): void {
   this.router.navigate(['/get-started']);
  // Replace with: this.router.navigate(['/tutorial']);
}

onCheckTemplates(): void {
  this.router.navigate(['/launch-template']);
}

}
