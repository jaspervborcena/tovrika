import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * RoleGuard enforces route.data.roles against the user's current permission role.
 *
 * Behavior:
 * - If no roles specified on the route, allow.
 * - Determine role from AuthService.getCurrentPermission().roleId with safe fallbacks.
 * - If role allowed, allow; otherwise redirect by role:
 *   cashier -> /pos; creator/store_manager -> /dashboard; visitor -> /onboarding; default -> /dashboard/overview
 */
export const roleGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const requiredRoles = (route.data?.['roles'] as string[] | undefined) || [];
  if (requiredRoles.length === 0) {
    // No role restriction defined
    return true;
  }

  // Ensure auth state is ready (handles race right after login/policy flow)
  const user = (await authService.waitForAuth()) || authService.currentUser();
  if (!user) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const perm = authService.getCurrentPermission();

  // Normalization helper to map legacy/synonym role ids
  const normalizeRole = (r?: string): string => {
    if (!r) return '';
    const key = String(r).toLowerCase().replace(/\s+/g, '').replace(/-/g, '_');
    const map: Record<string, string> = {
      // Canonical
      creator: 'creator',
      store_manager: 'store_manager',
      storemanager: 'store_manager',
      cashier: 'cashier',
      visitor: 'visitor',
      admin: 'admin', // Add admin as its own role
      // Synonyms/legacy
      manager: 'store_manager',
      mgr: 'store_manager',
      supervisor: 'store_manager',
      owner: 'creator',
      administrator: 'admin',
      superadmin: 'admin',
      super_admin: 'admin'
    };
    return map[key] || r;
  };

  // Resolve role with safe fallbacks for legacy data/migrations
  let roleIdRaw = perm?.roleId as string | undefined;
  if (!roleIdRaw) {
    const perms = Array.isArray((user as any).permissions) ? (user as any).permissions : [];
    const nonVisitor = perms.find((p: any) => p?.roleId && p.roleId !== 'visitor');
    roleIdRaw = nonVisitor?.roleId || perms[0]?.roleId || (user as any).roleId || undefined;
  }
  // If still undefined but user has a company context, treat as creator for initial access
  if (!roleIdRaw) {
    roleIdRaw = perm?.companyId ? 'creator' : 'visitor';
  }

  const roleId = normalizeRole(roleIdRaw);
  const normalizedRequired = requiredRoles.map(normalizeRole);

  console.log('🛡️ RoleGuard:', {
    url: state.url,
    requiredRoles,
    normalizedRequired,
    resolvedRole: roleIdRaw,
    normalizedRole: roleId,
    companyId: perm?.companyId
  });

  // Admin has access to everything
  if (roleId === 'admin') {
    console.log('✅ RoleGuard: Admin access granted to all routes');
    return true;
  }

  if (normalizedRequired.includes(roleId)) {
    return true;
  }

  // Redirect based on role
  switch (roleId) {
    case 'cashier':
      router.navigate(['/pos']);
      break;
    case 'creator':
    case 'store_manager':
      router.navigate(['/dashboard']);
      break;
    case 'visitor':
      router.navigate(['/onboarding']);
      break;
    default:
      router.navigate(['/dashboard/overview']);
  }
  return false;
};
