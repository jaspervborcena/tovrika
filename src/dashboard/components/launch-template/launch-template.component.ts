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
  selector: 'app-launch-template',
  standalone: true,
  imports: [CommonModule,  FormsModule],
  template: `
    <div class="min-h-screen bg-background px-6 py-10">
       <div
        class="z-10 bg-background flex flex-col gap-1 items-center justify-center py-10 [view-transition-name:top-header]"
      >
        <h1 class="text-2xl tracking-wide text-primary font-medium">
          Tools, Optimization, Visuals, Report, Innovation, Knowledge, Automation
        </h1>
        <p class="text-gray-500">
          Tovrika = A smart, no-code platform to build forms, collect signatures, run events, and manage workflows — designed for modern teams, educators, organizers, and service providers.
          CSS
        </p>
      </div>
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-10">
          <h2 class="text-2xl font-semibold text-primary">Choose a Template</h2>
          <p class="text-gray-500 text-sm">Start from scratch or pick a prebuilt layout</p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 justify-center">
          <!-- Blank Template Card -->
          <div
            class="bg-white w-[180px] aspect-square rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center p-4 hover:shadow-md cursor-pointer transition"
            (click)="createBlankTemplate()"
          >
            <div class="text-5xl text-primary mb-3 leading-none">➕</div>
            <div class="font-medium text-base text-primary">Blank Template</div>
          </div>

          <!-- Dynamic Cards -->
          <ng-container *ngIf="templates.length > 0">
            <div
              *ngFor="let template of templates"
              class="bg-white w-[180px] aspect-square rounded-xl shadow-sm p-4 hover:shadow-md transition cursor-pointer flex flex-col items-center justify-between text-center"
              (click)="loadTemplate(template.id)"
            >
              <!-- Image or Placeholder -->
              <img
                class="w-20 h-20 object-cover rounded-md mb-2"
                [src]="template.imageUrl || defaultImage"
                [alt]="template.title"
              />

              <!-- Title and Description -->
              <div>
                <div class="font-semibold text-primary text-base">{{ template.title }}</div>
                <p class="text-gray-500 text-sm mt-1 leading-tight line-clamp-2">
                  {{ template.description }}
                </p>
              </div>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: ``
})
export class LaunchTemplateComponent {
  defaultImage = 'https://via.placeholder.com/80?text=Form'; // Change as needed
 constructor(private router: Router) {}
  templates: TemplateCard[] = [
    {
      id: 'contact-info',
      title: 'Contact Info',
      description: 'c',
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
