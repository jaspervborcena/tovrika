import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

interface PaypalClientConfigResponse {
  clientId?: string;
  client_id?: string;
  sandbox?: boolean;
  currency?: string;
}

interface CreateOrderResponse {
  id?: string;
  orderID?: string;
  orderId?: string;
  status?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

interface CaptureOrderResponse {
  id?: string;
  status?: string;
  payer?: any;
  purchase_units?: any[];
}

@Injectable({ providedIn: 'root' })
export class PaypalService {
  private auth = inject(AuthService);
  // Dev uses /paypal via proxy; prod can point directly to Cloud Functions base URL
  private baseUrl = environment.paypal.apiUrl;

  private async getAuthToken(): Promise<string | null> {
    // Prefer the app's AuthService token getter (works with AngularFire)
    try {
      const token = await this.auth.getFirebaseIdToken();
      if (token) return token;
    } catch (e) {
      // ignore and try global firebase fallback
    }

    // Fallback to global firebase client if available (runtime environments)
    try {
      const win = window as any;
      if (win?.firebase?.auth && win.firebase.auth().currentUser?.getIdToken) {
        return await win.firebase.auth().currentUser.getIdToken();
      }
      if (win?.getAuth && win?.getAuth().currentUser?.getIdToken) {
        return await win.getAuth().currentUser.getIdToken();
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  private async fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${this.baseUrl}${path}`, { ...(options || {}), headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed ${path}: ${res.status} ${res.statusText} ${text}`);
    }
    return (await res.json()) as T;
  }

  async getClientConfig(): Promise<PaypalClientConfigResponse> {
    return await this.fetchJson<PaypalClientConfigResponse>('/paypal_client_config', { method: 'GET' });
  }

  async createOrder(amount: number, currency = 'PHP', description?: string): Promise<CreateOrderResponse> {
    return await this.fetchJson<CreateOrderResponse>('/paypal_create_order', {
      method: 'POST',
      body: JSON.stringify({ amount, currency, description })
    });
  }

  async captureOrder(orderId: string): Promise<CaptureOrderResponse> {
    return await this.fetchJson<CaptureOrderResponse>('/paypal_capture_order', {
      method: 'POST',
      body: JSON.stringify({ orderId })
    });
  }
}
