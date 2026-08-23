import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface MayaCheckoutResponse {
  checkoutId: string;
  redirectUrl: string;
  status?: string;
}

export interface MayaCheckoutStatusResponse {
  checkoutId: string;
  status: string;
  subscriptionActivated?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MayaService {
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.maya.apiUrl;

  private async fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await this.auth.getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const response = await fetch(url, { ...(options || {}), headers });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Maya request failed: ${response.status} ${detail}`);
    }
    return response.json() as Promise<T>;
  }

  createCheckout(input: {
    companyId: string;
    storeId: string;
    tier: 'basic' | 'standard' | 'premium';
    durationMonths: number;
    amount: number;
    email?: string;
    payerName?: string;
  }): Promise<MayaCheckoutResponse> {
    return this.fetchJson<MayaCheckoutResponse>('/maya_create_checkout', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  verifyCheckout(checkoutId: string): Promise<MayaCheckoutStatusResponse> {
    return this.fetchJson<MayaCheckoutStatusResponse>('/maya_verify_checkout', {
      method: 'POST',
      body: JSON.stringify({ checkoutId })
    });
  }
}