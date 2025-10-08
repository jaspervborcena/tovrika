// Service Worker for Chunk Loading Error Prevention
// Register this in your main.ts if you want PWA capabilities

const CACHE_NAME = 'pos-app-v1';
const CHUNK_CACHE_NAME = 'pos-chunks-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(self.skipWaiting());
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Clear old caches
          if (cacheName !== CACHE_NAME && cacheName !== CHUNK_CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - handle chunk loading errors
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle chunk requests specially
  if (url.pathname.includes('chunk-') && url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request).catch((error) => {
        console.warn('📦 Chunk fetch failed, attempting cache fallback:', error);
        
        // If chunk fetch fails, try to get from cache
        return caches.match(event.request).then((response) => {
          if (response) {
            console.log('📦 Serving chunk from cache');
            return response;
          }
          
          // If not in cache, reload the app
          console.log('📦 Chunk not in cache, triggering app reload');
          return new Response(
            `window.location.reload();`,
            { 
              status: 200, 
              headers: { 'Content-Type': 'application/javascript' } 
            }
          );
        });
      })
    );
  }
});

export {};