import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChunkErrorService } from '../../../core/services/chunk-error.service';

@Component({
  selector: 'app-chunk-error-fallback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chunk-error-container">
      <div class="error-content">
        <div class="error-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-16 h-16">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h2 class="error-title">Update Required</h2>
        
        <p class="error-message">
          The application has been updated with new features and improvements. 
          Please refresh to get the latest version.
        </p>
        
        <div class="error-actions">
          <button 
            (click)="refresh()" 
            class="refresh-button">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Application
          </button>
          
          <button 
            (click)="hardRefresh()" 
            class="hard-refresh-button">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Cache & Refresh
          </button>
        </div>
        
        <div class="error-details">
          <details>
            <summary>Technical Details</summary>
            <p class="tech-details">
              This error occurs when the browser cache contains outdated application files. 
              Refreshing will download the latest version and resolve the issue.
            </p>
          </details>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chunk-error-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }
    
    .error-content {
      background: white;
      border-radius: 1rem;
      padding: 3rem;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }
    
    .error-icon {
      color: #f59e0b;
      margin-bottom: 2rem;
      display: flex;
      justify-content: center;
    }
    
    .error-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 1rem;
    }
    
    .error-message {
      color: #6b7280;
      font-size: 1.125rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    
    .error-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .refresh-button {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      padding: 0.875rem 2rem;
      border-radius: 0.75rem;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    
    .refresh-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
    }
    
    .hard-refresh-button {
      background: #6b7280;
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 0.75rem;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    
    .hard-refresh-button:hover {
      background: #4b5563;
    }
    
    .error-details {
      border-top: 1px solid #e5e7eb;
      padding-top: 1rem;
      margin-top: 1rem;
    }
    
    details {
      text-align: left;
    }
    
    summary {
      color: #6b7280;
      font-size: 0.875rem;
      cursor: pointer;
      margin-bottom: 0.5rem;
    }
    
    .tech-details {
      color: #6b7280;
      font-size: 0.75rem;
      line-height: 1.5;
      margin: 0;
    }
    
    @media (min-width: 640px) {
      .error-actions {
        flex-direction: row;
        justify-content: center;
      }
    }
  `]
})
export class ChunkErrorFallbackComponent {
  private chunkErrorService = inject(ChunkErrorService);

  refresh(): void {
    window.location.reload();
  }

  hardRefresh(): void {
    // Clear all caches and storage
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Clear storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear storage:', e);
    }
    
    // Hard refresh
    window.location.href = window.location.href;
  }
}