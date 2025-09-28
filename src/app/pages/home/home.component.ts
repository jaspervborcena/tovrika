import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { AppConstants } from '../../shared/enums';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Expose authentication state to template
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly currentUser = this.authService.currentUser;
  readonly userRole = this.authService.userRole;
  
  // Expose app constants to template
  readonly appName = AppConstants.APP_NAME;

  navigateToDashboard() {
    // Navigate based on user role
    const role = this.userRole();
    if (role === 'cashier') {
      this.router.navigate(['/pos']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  async logout() {
    await this.authService.logout();
  }
}
