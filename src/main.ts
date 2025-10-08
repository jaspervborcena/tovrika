import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Immediate chunk error protection - runs before Angular starts
function setupImmediateChunkErrorHandler() {
  console.log('🛡️ Setting up immediate chunk error protection...');
  
  // Global error handler
  window.addEventListener('error', (event) => {
    const error = event.error || event;
    if (isChunkError(error)) {
      console.warn('🔄 Chunk error detected during app bootstrap, reloading...', error);
      event.preventDefault();
      setTimeout(() => window.location.reload(), 100);
    }
  });

  // Promise rejection handler  
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkError(event.reason)) {
      console.warn('🔄 Promise chunk error detected, reloading...', event.reason);
      event.preventDefault();
      setTimeout(() => window.location.reload(), 100);
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

bootstrapApplication(AppComponent, appConfig)
  .catch(err => {
    console.error('❌ Bootstrap error:', err);
    if (isChunkError(err)) {
      console.log('🔄 Bootstrap failed due to chunk error, reloading...');
      setTimeout(() => window.location.reload(), 100);
    }
  });
