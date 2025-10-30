import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface CreateOrderResponse {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

interface CaptureOrderResponse {
  id: string;
  status: string;
  purchase_units?: any[];
}

@Injectable({ providedIn: 'root' })
export class PaypalService {
  private http = inject(HttpClient);
  // Functions base: https://<region>-<project>.cloudfunctions.net
  // Our endpoint is deployed under /paypal
  private baseUrl = `${environment.api.baseUrl}/paypal`;

  async createOrder(amount: number, currency = 'PHP', description?: string): Promise<CreateOrderResponse> {
    return await firstValueFrom(
      this.http.post<CreateOrderResponse>(`${this.baseUrl}/create-order`, { amount, currency, description })
    );
  }

  async captureOrder(orderId: string): Promise<CaptureOrderResponse> {
    return await firstValueFrom(
      this.http.post<CaptureOrderResponse>(`${this.baseUrl}/capture-order`, { orderId })
    );
  }
}
