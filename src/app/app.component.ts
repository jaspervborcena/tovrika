import { Component,OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../app/core/components/navbar/navbar.component';
import { SignInComponent } from '../app/authentication/sign-in/sign-in.component';
import { HomeComponent } from './dashboard/pages/home/home.component';
import { RouterModule } from '@angular/router'; // Import RouterModule

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ RouterOutlet, RouterModule,NavbarComponent],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.less'],
})
export class AppComponent {}