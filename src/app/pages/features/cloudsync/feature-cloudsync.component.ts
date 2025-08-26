import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MainLayoutComponent } from '../../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-feature-cloudsync',
  standalone: true,
  imports: [CommonModule, RouterLink, MainLayoutComponent],
  template: `
    <app-main-layout>
      <div class="bg-gradient-to-br from-sky-50 to-blue-100 min-h-screen py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- Header -->
          <div class="text-center mb-12">
            <div class="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 text-white mb-6">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h1 class="heading-font text-4xl font-bold text-gray-900 mb-4">Cloud Sync</h1>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">Automatic, secure cloud synchronization keeps your data safe and accessible from anywhere, anytime.</p>
          </div>

          <!-- Features Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <!-- Real-time Sync -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Real-time Sync</h3>
              <p class="text-gray-600 mb-4">Changes are instantly synchronized across all devices and locations in real-time.</p>
              <ul class="space-y-2 text-sm text-gray-500">
                <li>• Instant updates</li>
                <li>• Cross-device sync</li>
                <li>• Multi-location support</li>
                <li>• Conflict resolution</li>
              </ul>
            </div>

            <!-- Secure Backup -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Secure Backup</h3>
              <p class="text-gray-600 mb-4">Your data is automatically backed up with enterprise-grade security and encryption.</p>
              <ul class="space-y-2 text-sm text-gray-500">
                <li>• 256-bit encryption</li>
                <li>• Multiple backup locations</li>
                <li>• Versioned backups</li>
                <li>• GDPR compliant</li>
              </ul>
            </div>

            <!-- Access Anywhere -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Access Anywhere</h3>
              <p class="text-gray-600 mb-4">Access your data from any device, anywhere in the world with internet connection.</p>
              <ul class="space-y-2 text-sm text-gray-500">
                <li>• Web browser access</li>
                <li>• Mobile apps</li>
                <li>• Tablet support</li>
                <li>• Offline sync</li>
              </ul>
            </div>
          </div>

          <!-- Benefits Section -->
          <div class="bg-white rounded-xl p-8 mb-12 shadow-lg">
            <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">Cloud Sync Benefits</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Business Continuity</h3>
                <div class="space-y-3">
                  <div class="flex items-center space-x-3">
                    <div class="h-5 w-5 rounded-full bg-sky-100 flex items-center justify-center">
                      <svg class="h-3 w-3 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-gray-700">99.9% uptime guarantee</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <div class="h-5 w-5 rounded-full bg-sky-100 flex items-center justify-center">
                      <svg class="h-3 w-3 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-gray-700">Disaster recovery included</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <div class="h-5 w-5 rounded-full bg-sky-100 flex items-center justify-center">
                      <svg class="h-3 w-3 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-gray-700">Automatic failover</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Data Protection</h3>
                <div class="space-y-3">
                  <div class="flex items-center space-x-3">
                    <div class="h-5 w-5 rounded-full bg-sky-100 flex items-center justify-center">
                      <svg class="h-3 w-3 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-gray-700">End-to-end encryption</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <div class="h-5 w-5 rounded-full bg-sky-100 flex items-center justify-center">
                      <svg class="h-3 w-3 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-gray-700">Point-in-time recovery</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <div class="h-5 w-5 rounded-full bg-sky-100 flex items-center justify-center">
                      <svg class="h-3 w-3 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-gray-700">Audit trail logging</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CTA Section -->
          <div class="bg-gradient-to-r from-sky-600 to-sky-700 rounded-2xl p-8 text-center">
            <h2 class="heading-font text-3xl font-bold text-white mb-4">Your Data, Always Safe & Accessible</h2>
            <p class="text-sky-100 text-lg mb-6">Experience the peace of mind that comes with enterprise-grade cloud synchronization.</p>
            <div class="space-x-4">
              <a routerLink="/register" class="inline-flex items-center px-8 py-3 bg-white text-sky-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
                Start Cloud Sync
              </a>
              <a routerLink="/" class="inline-flex items-center px-8 py-3 border border-white text-white rounded-lg hover:bg-white hover:text-sky-600 transition-colors font-semibold">
                Back to Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </app-main-layout>
  `
})
export class FeatureCloudSyncComponent {}
