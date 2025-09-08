import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
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

  navigateToDashboard() {
    // Navigate based on user role
    const role = this.userRole();
    if (role === 'cashier') {
      this.router.navigate(['/dashboard/pos']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  async logout() {
    try {
      await this.authService.logout();
      // User will automatically be redirected by the auth state change
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
