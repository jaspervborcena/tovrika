// Dev-only helper: fetch companies from Firestore using the provided `firestore` instance
// and write them into SQLite via the provided `sqliteService`.
// This is safe to call only in development and should be invoked after the user
// has successfully logged in so client auth tokens are available.

import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { SqliteStorageService } from '../core/services/sqlite-storage.service';
import { CompanyService } from '../services/company.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Injector, runInInjectionContext } from '@angular/core';

// Accept an optional Injector so callers can run Firestore SDK calls inside
// Angular's injection context to avoid AngularFire warnings.
export async function seedCompaniesFromFirestoreIfEmpty(firestore: Firestore, sqliteService: SqliteStorageService, injector?: Injector) {
  if (environment.production) return;
  try {
    console.log('🧪 Dev seeder: checking SQLite via SqliteStorageService...');
    const existing = await sqliteService.getAllCompanies();
    if (existing && existing.length > 0) {
      console.log('🧪 Dev seeder: companies already present in SQLite, skipping seeding.');
      return;
    }

    console.log('🧪 Dev seeder: fetching companies (prefer CompanyService via Injector)...');
    try {
      if (injector) {
        try {
          const authService = injector.get(AuthService as any) as AuthService;
          const companyService = injector.get(CompanyService as any) as CompanyService;

          // Try to gather company IDs from the authenticated user's permissions
          const user = (typeof authService.getCurrentUser === 'function') ? authService.getCurrentUser() : (typeof authService.currentUser === 'function' ? authService.currentUser() : null);
          const ids: string[] = [];
          if (user?.permissions && Array.isArray(user.permissions)) {
            for (const p of user.permissions) {
              if (p && p.companyId) ids.push(p.companyId);
            }
          }

          // Also include currentCompanyId if present
          if (user?.currentCompanyId) ids.push(user.currentCompanyId);

          if (!ids || ids.length === 0) {
            console.warn('🧪 Dev seeder: no company IDs found on the authenticated user; skipping CompanyService fetch path to avoid collection-level reads.');
          } else {
            const companies: any[] = [];
            for (const id of Array.from(new Set(ids))) {
              try {
                const c = await companyService.getCompanyById(id);
                if (c) companies.push(c);
              } catch (cErr) {
                console.warn('🧪 Dev seeder: CompanyService.getCompanyById failed for id', id, cErr);
              }
            }
            console.log(`🧪 Dev seeder: fetched ${companies.length} companies via CompanyService. SQLite persistence handled by the service.`);
            return;
          }
        } catch (svcErr) {
          console.warn('🧪 Dev seeder: failed to resolve AuthService/CompanyService from injector, will fall back to collection read', svcErr);
        }
      }

      // Fallback: run collection read only if Injector path unavailable
      console.log('🧪 Dev seeder: falling back to collection read (may trigger permission errors)...');
      const getDocsCall = () => getDocs(collection(firestore, 'companies'));
      const snap = injector ? await runInInjectionContext(injector, getDocsCall) : await getDocsCall();
      if (!snap || snap.empty) {
        console.warn('🧪 Dev seeder: companies collection is empty or could not be read.');
        return;
      }

      const companies: any[] = snap.docs.map(d => {
        const data: any = d.data();
        const payload = data && data.company ? data.company : data;
        return {
          id: d.id,
          ...payload,
          createdAt: payload?.createdAt?.toDate ? payload.createdAt.toDate() : (payload?.createdAt ? new Date(payload.createdAt) : undefined),
          updatedAt: payload?.updatedAt?.toDate ? payload.updatedAt.toDate() : (payload?.updatedAt ? new Date(payload.updatedAt) : undefined)
        };
      });

      console.log(`🧪 Dev seeder: fetched ${companies.length} companies. Saving to SQLite via SqliteStorageService...`);
      await sqliteService.initDB();
      await sqliteService.saveCompanies(companies);
      const saved = await sqliteService.getAllCompanies();
      console.log(`🧪 Dev seeder: saved ${saved.length} companies to SQLite`);
    } catch (err: any) {
      // Log rich error details to help diagnose permission/token issues
      try {
        console.error('🧪 Dev seeder: Firestore read error', {
          message: err?.message,
          code: err?.code,
          name: err?.name,
          stack: err?.stack
        });

        // If we have an injector, attempt to read Firebase Auth currentUser and token claims
        if (injector) {
          try {
            await runInInjectionContext(injector, async () => {
              // Use injector to get AngularFire Auth instance
              const { Auth } = await import('@angular/fire/auth');
              const afAuth = injector.get(Auth as any) as any;
              const firebaseUser = afAuth?.currentUser;
              if (firebaseUser) {
                try {
                  const idToken = await firebaseUser.getIdToken();
                  const idTokenResult = await firebaseUser.getIdTokenResult();
                  console.log('🧪 Dev seeder: firebaseUser uid=', firebaseUser.uid, 'email=', firebaseUser.email);
                  console.log('🧪 Dev seeder: ID token length=', idToken ? idToken.length : 'null');
                  console.log('🧪 Dev seeder: ID token claims=', idTokenResult?.claims);
                } catch (tokenErr) {
                  console.warn('🧪 Dev seeder: failed to read ID token/claims', tokenErr);
                }
              } else {
                console.warn('🧪 Dev seeder: no firebase currentUser available');
              }
            });
          } catch (diagErr) {
            console.warn('🧪 Dev seeder: failed to run token diagnostics in injection context', diagErr);
          }
        }
      } catch (logErr) {
        console.warn('🧪 Dev seeder: error while logging Firestore error details', logErr);
      }

      console.warn('🧪 Dev seeder: failed to read companies from Firestore. This is often due to security rules or missing auth token. Original message:', err?.message || err);
    }
  } catch (e) {
    console.warn('🧪 Dev seeder: unexpected error', e);
  }
}
