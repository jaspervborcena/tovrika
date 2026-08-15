import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

interface PaypalClientConfigResponse {
  clientId?: string;
  client_id?: string;
  sandbox?: boolean;
  currency?: string;
  // Optional full URLs returned by the backend
  createOrderUrl?: string;
  captureOrderUrl?: string;
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
  private cachedConfig: PaypalClientConfigResponse | null = null;
  private createOrderUrl: string | null = null;
  private captureOrderUrl: string | null = null;

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
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const res = await fetch(url, { ...(options || {}), headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed ${path}: ${res.status} ${res.statusText} ${text}`);
    }
    return (await res.json()) as T;
  }

  async getClientConfig(): Promise<PaypalClientConfigResponse> {
    if (this.cachedConfig) return this.cachedConfig;
    const cfg = await this.fetchJson<PaypalClientConfigResponse>('/paypal_client_config', { method: 'GET' });
    this.cachedConfig = cfg;
    // prefer createOrderUrl/captureOrderUrl when provided by backend
    this.createOrderUrl = (cfg.createOrderUrl || (cfg as any).create_order_url || null) as string | null;
    this.captureOrderUrl = (cfg.captureOrderUrl || (cfg as any).capture_order_url || null) as string | null;
    return cfg;
  }

  async createOrder(amount: number, currency = 'PHP', description?: string): Promise<CreateOrderResponse> {
    const url = this.createOrderUrl || `${this.baseUrl}/paypal_create_order`;
    return await this.fetchJson<CreateOrderResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ amount, currency, description })
    });
  }

  async captureOrder(orderId: string): Promise<CaptureOrderResponse> {
    const url = this.captureOrderUrl || `${this.baseUrl}/paypal_capture_order`;
    return await this.fetchJson<CaptureOrderResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ orderId })
    });
  }
}
