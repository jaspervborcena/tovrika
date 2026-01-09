import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { authInterceptor } from './interceptors/auth.interceptor';
import { getApp, getApps } from 'firebase/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { ChunkErrorService } from './core/services/chunk-error.service';
import { RouterErrorService } from './core/services/router-error.service';
import { TranslateModule } from '@ngx-translate/core';
import { importProvidersFrom } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    // Translation module
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'en'
      })
    ),
    provideFirebaseApp(() => {
      try {
        // Reuse existing app if already initialized elsewhere
        const app = getApps().length > 0 ? getApp() : initializeApp(environment.firebase);
        //console.log('✅ Firebase App initialized:', app.name);
        return app;
      } catch (error) {
        //console.error('❌ Firebase App initialization failed:', error);
        // Attempt to fallback to existing app if available
        try {
          return getApp();
        } catch {
          throw error;
        }
      }
    }),
    provideAuth(() => {
      try {
        const app = getApp(); // Get the Firebase app instance
        const auth = getAuth(app); // Pass app to ensure proper linking
        // Firebase Auth automatically uses IndexedDB for persistence on web
        // This ensures user sessions persist across browser tabs and page refreshes
        return auth;
      } catch (error) {
        //console.error('❌ Firebase Auth initialization failed:', error);
        throw error;
      }
    }),
    provideFirestore(() => {
      try {
        const app = getApp(); // Get the Firebase app instance
        const firestore = getFirestore(app); // Pass app to ensure proper linking with Auth
        //console.log('✅ Firebase Firestore initialized with app');
        return firestore;
      } catch (error) {
        //console.error('❌ Firebase Firestore initialization failed:', error);
        throw error;
      }
    }),
    // Initialize chunk error handling
    {
      provide: APP_INITIALIZER,
      useFactory: (chunkErrorService: ChunkErrorService, routerErrorService: RouterErrorService) => {
        return async () => {
          // Attempt to enable Firestore IndexedDB persistence (multi-tab preferred)
          try {
            const db = getFirestore();
            try {
              await enableMultiTabIndexedDbPersistence(db);
              console.log('📦 Firestore multi-tab persistence enabled');
            } catch (multiErr: any) {
              // If multi-tab fails (e.g., multiple tabs open or unimplemented), try single-tab
              if (multiErr?.code === 'failed-precondition') {
                try {
                  await enableIndexedDbPersistence(db);
                  console.log('📦 Firestore single-tab persistence enabled (fallback)');
                } catch (singleErr) {
                  console.warn('⚠️ Failed to enable single-tab Firestore persistence:', singleErr);
                }
              } else if (multiErr?.code === 'unimplemented') {
                console.warn('⚠️ Firestore persistence is not available in this browser/runtime');
              } else {
                console.warn('⚠️ Failed to enable multi-tab Firestore persistence:', multiErr);
              }
            }
          } catch (err) {
            // Silently handle persistence initialization errors
          }

          // Services will initialize their error handlers when created
          return Promise.resolve();
        };
      },
      deps: [ChunkErrorService, RouterErrorService],
      multi: true
    }
  ]
};
