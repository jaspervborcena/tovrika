import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * HTTP Interceptor that automatically attaches the Firebase ID token to the app's
 * internal API and Cloud Function requests.
 *
 * Applies to:
 * - `/api/*` proxied requests
 * - Absolute Cloud Function URLs such as `*.cloudfunctions.net`
 *
 * Skips:
 * - Non-API external resources that do not require Firebase auth
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isApiRequest = req.url.startsWith('/api/') ||
    (req.url.startsWith('http') && req.url.includes('cloudfunctions.net'));

  if (!isApiRequest) {
    return next(req);
  }

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

      return next(req);
    })
  );
};
