import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * HTTP Interceptor that automatically attaches Firebase ID token to all API requests.
 * 
 * Applies to:
 * - All requests starting with `/api/` (proxied Cloud Functions and Cloud Run endpoints)
 * 
 * Skips:
 * - External URLs (non-relative paths)
 * - Non-API requests
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Only attach token to API requests (proxied endpoints)
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  // Get Firebase ID token and clone request with Authorization header
  return from(authService.getFirebaseIdToken()).pipe(
    switchMap((token) => {
      if (token) {
        const clonedReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next(clonedReq);
      }
      
      // No token available - proceed without auth header
      // (backend will return 401 if auth is required)
      return next(req);
    })
  );
};
