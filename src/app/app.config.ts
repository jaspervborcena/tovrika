import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { ChunkErrorService } from './core/services/chunk-error.service';
import { RouterErrorService } from './core/services/router-error.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    provideFirebaseApp(() => {
      try {
        return initializeApp(environment.firebase);
      } catch (error) {
        console.error('❌ Firebase App initialization failed:', error);
        throw error;
      }
    }),
    provideAuth(() => {
      try {
        const auth = getAuth();
        // Firebase Auth automatically uses IndexedDB for persistence on web
        // This ensures user sessions persist across browser tabs and page refreshes
        return auth;
      } catch (error) {
        console.error('❌ Firebase Auth initialization failed:', error);
        throw error;
      }
    }),
    provideFirestore(() => getFirestore()),
    // Initialize chunk error handling
    {
      provide: APP_INITIALIZER,
      useFactory: (chunkErrorService: ChunkErrorService, routerErrorService: RouterErrorService) => {
        return () => {
          console.log('🛡️ Initializing chunk error protection...');
          // Services will initialize their error handlers when created
          return Promise.resolve();
        };
      },
      deps: [ChunkErrorService, RouterErrorService],
      multi: true
    }
  ]
};
