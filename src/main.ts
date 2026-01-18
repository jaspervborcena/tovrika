import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// Immediate chunk error protection - runs before Angular starts
function setupImmediateChunkErrorHandler() {
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

// Wrap bootstrap in an async IIFE so we can conditionally ensure the JIT compiler
// is available in development when components may require runtime compilation.
(async () => {
  try {
    if (!environment.production) {
      // Load compiler in dev to allow runtime/JIT compilation when necessary.
      // This avoids the runtime error: "The component 'X' needs to be compiled using the JIT compiler"
      // Keep this in development only; production should use AOT and not include the compiler.
      // Note: '@angular/compiler' is declared in package.json dependencies.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      await import('@angular/compiler');
    }

    await bootstrapApplication(AppComponent, appConfig);
  } catch (err) {
    console.error('❌ Bootstrap error:', err);
    if (isChunkError(err)) {
      console.log('🔄 Bootstrap failed due to chunk error, reloading with cache-bust...');
      setTimeout(softReloadWithBust, 100);
    }
  }
})();
