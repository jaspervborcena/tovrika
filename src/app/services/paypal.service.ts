import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  // Dev uses /paypal via proxy; prod can point directly to Cloud Functions base URL
  private baseUrl = environment.paypal.apiUrl;

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.auth.getFirebaseIdToken();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  async getClientConfig(): Promise<PaypalClientConfigResponse> {
    const headers = await this.getAuthHeaders();
    return await firstValueFrom(
      this.http.get<PaypalClientConfigResponse>(`${this.baseUrl}/paypal_client_config`, { headers })
    );
  }

  async createOrder(amount: number, currency = 'PHP', description?: string): Promise<CreateOrderResponse> {
    const headers = await this.getAuthHeaders();
    return await firstValueFrom(
      this.http.post<CreateOrderResponse>(`${this.baseUrl}/paypal_create_order`, { amount, currency, description }, { headers })
    );
  }

  async captureOrder(orderId: string): Promise<CaptureOrderResponse> {
    const headers = await this.getAuthHeaders();
    return await firstValueFrom(
      this.http.post<CaptureOrderResponse>(`${this.baseUrl}/paypal_capture_order`, { orderId }, { headers })
    );
  }
}
