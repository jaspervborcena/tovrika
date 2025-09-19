import { Injectable, signal, computed } from '@angular/core';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts = signal<ToastMessage[]>([]);
  
  // Public readonly signal for components to subscribe to
  toasts$ = computed(() => this.toasts());

  /**
   * Show a success toast message
   */
  success(message: string, duration?: number): void {
    this.addToast({ message, type: 'success', duration });
  }

  /**
   * Show an error toast message
   */
  error(message: string, duration?: number): void {
    this.addToast({ message, type: 'error', duration });
  }

  /**
   * Show a warning toast message
   */
  warning(message: string, duration?: number): void {
    this.addToast({ message, type: 'warning', duration });
  }

  /**
   * Show an info toast message
   */
  info(message: string, duration?: number): void {
    this.addToast({ message, type: 'info', duration });
  }

  /**
   * Add a toast with custom configuration
   */
  addToast(toast: Omit<ToastMessage, 'id'>): void {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const duration = toast.duration || this.getDefaultDuration(toast.type);
    
    const newToast: ToastMessage = {
      ...toast,
      id
    };

    this.toasts.update(toasts => [...toasts, newToast]);

    // Auto-remove after duration
    setTimeout(() => {
      this.removeToast(id);
    }, duration);
  }

  /**
   * Remove a specific toast by ID
   */
  removeToast(id: string): void {
    this.toasts.update(toasts => toasts.filter(toast => toast.id !== id));
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    this.toasts.set([]);
  }

  /**
   * Get default duration based on toast type
   */
  private getDefaultDuration(type: ToastMessage['type']): number {
    switch (type) {
      case 'error':
        return 6000; // 6 seconds for errors (longer to read)
      case 'warning':
        return 5000; // 5 seconds for warnings
      case 'success':
        return 4000; // 4 seconds for success
      case 'info':
        return 4000; // 4 seconds for info
      default:
        return 4000;
    }
  }
}