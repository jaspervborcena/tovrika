import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // Check for specific role requirements if specified in route data
  if (route.data?.['roles']) {
    const userRole = authService.userRole();
    if (!route.data['roles'].includes(userRole)) {
      router.navigate(['/dashboard']);
      return false;
    }
  }

  return true;
};
