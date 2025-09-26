import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { environment } from '../environments/environment';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    provideFirebaseApp(() => {
      console.log('🔥 Initializing Firebase App...');
      try {
        const app = initializeApp(environment.firebase);
        console.log('✅ Firebase App initialized successfully');
        return app;
      } catch (error) {
        console.error('❌ Firebase App initialization failed:', error);
        throw error;
      }
    }),
    provideAuth(() => {
      console.log('🔐 Initializing Firebase Auth...');
      try {
        const auth = getAuth();
        // Firebase Auth automatically uses IndexedDB for persistence on web
        // This ensures user sessions persist across browser tabs and page refreshes
        console.log('✅ Firebase Auth initialized successfully');
        return auth;
      } catch (error) {
        console.error('❌ Firebase Auth initialization failed:', error);
        throw error;
      }
    }),
    provideFirestore(() => getFirestore())
  ]
};
