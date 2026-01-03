import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ContentLayoutComponent } from '../../shared/components/content-layout/content-layout.component';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, HeaderComponent, ContentLayoutComponent],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.css']
})
export class HelpComponent {}

