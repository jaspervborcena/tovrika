import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// Immediate chunk error protection - runs before Angular starts
function setupImmediateChunkErrorHandler() {
  console.log('🛡️ Setting up immediate chunk error protection...');
  
  // Global error handler
  window.addEventListener('error', (event) => {
    const error = event.error || event;
    if (isChunkError(error)) {
      console.warn('🔄 Chunk error detected during app bootstrap, reloading with cache-bust...', error);
      event.preventDefault();
      setTimeout(softReloadWithBust, 100);
    }
  });

  // Promise rejection handler  
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkError(event.reason)) {
      console.warn('🔄 Promise chunk error detected, reloading with cache-bust...', event.reason);
      event.preventDefault();
      setTimeout(softReloadWithBust, 100);
    }
  });
}

function isChunkError(error: any): boolean {
  if (!error) return false;
  const message = error.message || error.toString() || '';
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError') ||
    message.includes('chunk-52OI3TR5.js') // Specific problematic chunk
  );
}

// Setup protection before Angular bootstrap
setupImmediateChunkErrorHandler();

function softReloadWithBust() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_t', Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // Dev-only: do NOT automatically seed at bootstrap. Seeding is performed post-login
    // so that client auth tokens are available for Firestore reads. Keeping startup
    // seeding can cause permission errors if it runs before login.
    if (!environment.production) {
      console.log('🧪 Dev seeder disabled at startup; will run post-login if requested');
    }
  })
  .catch(err => {
    console.error('❌ Bootstrap error:', err);
    if (isChunkError(err)) {
      console.log('🔄 Bootstrap failed due to chunk error, reloading with cache-bust...');
      setTimeout(softReloadWithBust, 100);
    }
  });
