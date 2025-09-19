import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AccessService } from '../core/services/access.service';

@Injectable({ providedIn: 'root' })
export class AccessGuard implements CanActivate {
  constructor(private accessService: AccessService, private router: Router) {}

  canActivate(route: import('@angular/router').ActivatedRouteSnapshot): boolean {
    const permissionKey = route.data['permissionKey'] as string;
    if (!permissionKey || this.accessService.canView(permissionKey as any)) {
      return true;
    }
    // Redirect to dashboard or error page if not allowed
    this.router.navigate(['/dashboard']);
    return false;
  }
}
