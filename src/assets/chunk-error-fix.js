// Aggressive chunk error fix - add this to index.html
(function() {
  'use strict';
  
  console.log('🛡️ Aggressive chunk error protection loading...');
  
  let hasReloaded = false;
  let reloadTimeout = null;
  
  function forceReload() {
    if (hasReloaded) {
      console.log('⚠️ Already reloaded once, skipping to prevent loop');
      return;
    }
    hasReloaded = true;
    // Safe reload: do NOT clear storage or CacheStorage to preserve offline data
    performHardReload();
  }
  
  function performHardReload() {
    // Force reload with cache bust (preserves history minimalism)
    const url = new URL(window.location.href);
    url.searchParams.set('_t', Date.now().toString());
    // Use replace so we don't stack history entries
    window.location.replace(url.toString());
  }
  
  function isChunkError(error) {
    if (!error) return false;
    const message = error.message || error.toString() || '';
    const stack = error.stack || '';
    
    return (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('ChunkLoadError') ||
      message.includes('chunk-52OI3TR5.js') ||
      stack.includes('chunk-') ||
      (error.name === 'ChunkLoadError')
    );
  }
  
  function handleError(error, source) {
    if (isChunkError(error)) {
      console.warn(`🔄 ${source} chunk error detected:`, error);
      
      // Debounce reload attempts
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      
      reloadTimeout = setTimeout(() => {
        forceReload();
      }, 100);
      
      return true;
    }
    return false;
  }
  
  // Global error handler
  window.addEventListener('error', function(event) {
    const error = event.error || event;
    if (handleError(error, 'Global')) {
      event.preventDefault();
    }
  });
  
  // Promise rejection handler
  window.addEventListener('unhandledrejection', function(event) {
    if (handleError(event.reason, 'Promise')) {
      event.preventDefault();
    }
  });
  
  // Route change error handler
  let originalPushState = history.pushState;
  let originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    try {
      return originalPushState.apply(this, args);
    } catch (error) {
      if (handleError(error, 'Navigation')) {
        return;
      }
      throw error;
    }
  };
  
  history.replaceState = function(...args) {
    try {
      return originalReplaceState.apply(this, args);
    } catch (error) {
      if (handleError(error, 'Navigation')) {
        return;
      }
      throw error;
    }
  };
  
  console.log('✅ Aggressive chunk error protection active');
})();