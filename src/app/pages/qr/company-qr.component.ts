import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toDataURL } from 'qrcode';
import { CompanyService } from '../../services/company.service';
import { Company } from '../../interfaces/company.interface';
import { environment } from '../../../environments/environment';

export function buildRewardsApkStoragePath(): string {
  return 'android/rewards/Rewards.apk';
}

export function buildRewardsApkDownloadUrl(slug: string): string {
  const sanitizedSlug = (slug || 'rewards').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'rewards';
  const baseUrl = (environment.api?.baseUrl || '').trim();
  const functionBaseUrl = baseUrl || (environment.production ? (environment as any)?.paypal?.apiUrl || '' : '');
  const path = `/downloadRewardsApk?slug=${encodeURIComponent(sanitizedSlug)}`;

  return functionBaseUrl ? `${functionBaseUrl}${path}` : path;
}

@Component({
  selector: 'app-company-qr',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="company-qr-page">
      <div class="header">
        <h1>Rewards</h1>
        <p class="subtitle">Download and Install this app to unlock exclusive rewards—earn more points, enjoy special bonuses, and get exciting freebies every time you shop!</p>
      </div>

      <div *ngIf="loading()" class="loading-state">
        <p>Loading company details...</p>
      </div>

      <div *ngIf="error()" class="error-alert">
        <p>{{ error() }}</p>
      </div>

      <div *ngIf="company() && !loading()" class="content-grid">
        <div class="profile-card">
          <h2>{{ company()?.name }}</h2>
          <p class="company-tagline">Company profile details</p>
          <div class="profile-row"><span>Company link</span><strong>app.tovrika.com/qr/{{ company()?.slug }}</strong></div>
          <div class="profile-row" *ngIf="company()?.email"><span>Email</span><strong>{{ company()?.email }}</strong></div>
          <div class="profile-row" *ngIf="company()?.phone"><span>Phone</span><strong>{{ company()?.phone }}</strong></div>
          <div class="download-button-block">
            <button
              type="button"
              class="btn download-android-btn"
              [disabled]="isDownloading()"
              (click)="downloadRewardsApk()"
            >
              🤖 Download Android Rewards
            </button>
          </div>
          <div class="profile-row" *ngIf="company()?.website"><span>Website</span><strong>{{ company()?.website }}</strong></div>
          <div class="profile-row" *ngIf="company()?.address"><span>Address</span><strong>{{ company()?.address }}</strong></div>
        </div>

      </div>

      <div *ngIf="message()" class="success-alert">
        <p>{{ message() }}</p>
      </div>
    </div>
  `,
  styles: [`
    .company-qr-page {
      max-width: 1040px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #6b7280;
      margin: 0;
    }
    .loading-state,
    .error-alert,
    .success-alert {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 1rem 1.25rem;
      border-radius: 12px;
      margin-bottom: 1rem;
      text-align: center;
    }
    .error-alert {
      border-color: #fecaca;
      color: #b91c1c;
    }
    .success-alert {
      border-color: #bbf7d0;
      color: #166534;
    }
    .content-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
      gap: 1.5rem;
    }
    .profile-card,
    .qr-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
      padding: 1.5rem;
    }
    .profile-card h2,
    .qr-card-header h2 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
    }
    .company-tagline,
    .form-note {
      color: #6b7280;
      margin: 0 0 1rem;
    }
    .profile-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 0;
      border-top: 1px solid #f3f4f6;
    }
    .profile-row:first-of-type {
      border-top: none;
    }
    .profile-row span {
      color: #6b7280;
      font-size: 0.9rem;
    }
    .profile-row strong {
      color: #111827;
      text-align: right;
    }
    .qr-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .download-button-block {
      margin-top: 1.5rem;
    }
    .download-android-btn {
      background: #16a34a;
      color: white !important;
      border: none;
      padding: 0.95rem 1.4rem;
      font-size: 1rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 10px 25px rgba(22, 163, 74, 0.18);
    }
    .download-android-btn:hover {
      background: #15803d;
    }
    .qr-image {
      width: 100%;
      max-width: 280px;
      border: 1px solid #e5e7eb;
      border-radius: 1rem;
      background: white;
    }
    .qr-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.85rem 1.25rem;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      text-decoration: none;
    }
    .btn-primary {
      background: #4338ca;
      color: white;
    }
    .btn-secondary {
      background: #f8fafc;
      color: #1f2937;
      border: 1px solid #e5e7eb;
    }
    .qr-missing {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      text-align: center;
    }
    @media (max-width: 900px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CompanyQrComponent {
  private route = inject(ActivatedRoute);
  private companyService = inject(CompanyService);

  protected company = signal<Company | undefined>(undefined);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected message = signal<string>('');
  protected isDownloading = signal(false);
  protected qrDataUrl = signal<string | null>(null);
  protected generatedQrPayload = signal<string>('');

  constructor() {
    void this.loadCompany();
  }

  private async loadCompany() {
    const companySlug = this.route.snapshot.paramMap.get('companySlug') || '';
    if (!companySlug) {
      this.error.set('Invalid QR link. No company identifier was provided.');
      this.loading.set(false);
      return;
    }

    try {
      const company = await this.companyService.getCompanyBySlug(companySlug);
      if (!company) {
        this.error.set('Company not found.');
        return;
      }

      this.company.set(company);
      const payload = company.qrPayload?.startsWith('https://app.tovrika.com/qr/')
        ? company.qrPayload!
        : this.buildCompanyQrPayload(company);
      await this.refreshQrCode(payload);
      if (!company.qrPayload?.startsWith('https://app.tovrika.com/qr/') && company.id) {
        await this.companyService.updateCompany(company.id, { qrPayload: payload });
      }
    } catch (err) {
      console.error('Company QR load failed:', err);
      this.error.set('Unable to load company profile.');
    } finally {
      this.loading.set(false);
    }
  }

  private buildCompanyQrPayload(company: Company) {
    const slug = company.slug?.trim() || '';
    return `https://app.tovrika.com/qr/${slug}`;
  }

  protected async downloadRewardsApk() {
    const company = this.company();
    if (!company?.slug) {
      this.message.set('Cannot download APK because company slug is missing.');
      return;
    }

    this.isDownloading.set(true);
    this.message.set('Preparing APK download...');

    try {
      const downloadUrl = buildRewardsApkDownloadUrl(company.slug);
      const downloadFilename = this.buildDownloadFilename(company.slug);
      const response = await fetch(downloadUrl, { method: 'GET', credentials: 'omit' });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = downloadFilename;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.setAttribute('download', downloadFilename);
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }, 100);
      this.message.set(`APK download started as ${downloadFilename}.`);
    } catch (error) {
      console.error('APK download failed:', error);
      this.message.set('Unable to download the APK. Please try again later.');
    } finally {
      this.isDownloading.set(false);
    }
  }

  private buildDownloadFilename(slug: string): string {
    const baseName = (slug || 'rewards').trim().toLowerCase();
    const sanitized = baseName
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `${sanitized || 'rewards'}.apk`;
  }

  private async refreshQrCode(payload: string) {
    if (!payload) {
      this.qrDataUrl.set(null);
      this.generatedQrPayload.set('');
      return;
    }

    this.generatedQrPayload.set(payload);
    try {
      const dataUrl = await toDataURL(payload, { width: 300, margin: 2 });
      this.qrDataUrl.set(dataUrl);
    } catch (error) {
      console.error('QR generation failed:', error);
      this.qrDataUrl.set(null);
      this.error.set('Unable to generate QR code.');
    }
  }

  protected async copyQrPayload() {
    const payload = this.generatedQrPayload();
    if (!payload) {
      this.message.set('QR payload is not available at the moment.');
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      this.message.set('QR payload copied to clipboard.');
    } catch (error) {
      console.error('Copy failed:', error);
      this.message.set('Could not copy QR payload.');
    }
  }

  protected async generateCompanyQr() {
    const company = this.company();
    if (!company?.id) {
      this.error.set('No company loaded to generate QR code.');
      return;
    }

    const payload = this.buildCompanyQrPayload(company);
    await this.refreshQrCode(payload);
    this.message.set('Company QR code generated successfully.');
  }
}
