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
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule,  FormsModule],
  template: `
    <div class="tutorial-section">
  <h2>🚀 Getting Started with Templates</h2>
  <p>
    Templates in Tovrika help you jumpstart your planning—whether you're organizing an event, managing a project, or streamlining daily tasks. 
    With just a few clicks, you can customize layouts, reuse formats, and save time.
  </p>
  <p>
    Watch the quick tutorial below to learn how to use or create templates effectively:
  </p>

  <div class="video-wrapper">

    <iframe width="500px" height="400px" src="https://www.youtube.com/embed/ATp_l82uubI?si=FB1C5OPLTijBG74r" 
      title="How To Use Templates" frameborder="0" ></iframe>
  </div>
</div>

<style>
  .tutorial-section {
    background-color: #ffffff;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    margin-top: 2rem;
  }

  .tutorial-section h2 {
    color: #4a90e2;
    margin-bottom: 1rem;
  }

  .tutorial-section p {
    font-size: 1rem;
    line-height: 1.6;
    margin-bottom: 1rem;
  }

  .video-wrapper {
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    overflow: hidden;
    border-radius: 8px;
  }

  .video-wrapper iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>

  `,
  styles: ``
})
export class GetStartedComponent {
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
}
