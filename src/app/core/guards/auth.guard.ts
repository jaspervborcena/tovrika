import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service'; // Import AuthService

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);  // Inject the AuthService
  const isAuthenticated = authService.isAuthenticated;  // Access the signal's value directly (no parentheses)
  
  return isAuthenticated ? true : router.parseUrl('/');  // Redirect to login if not authenticated
};
