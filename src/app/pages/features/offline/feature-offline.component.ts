import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MainLayoutComponent } from '../../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-feature-offline',
  standalone: true,
  imports: [CommonModule, RouterLink, MainLayoutComponent],
  template: `
    <app-main-layout>
      <div class="bg-gradient-to-br from-orange-50 to-red-100 min-h-screen py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- Header -->
          <div class="text-center mb-12">
            <div class="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white mb-6">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h1 class="heading-font text-4xl font-bold text-gray-900 mb-4">Offline Mode</h1>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">Never lose a sale due to internet outages. Our POS works seamlessly offline and syncs when reconnected.</p>
          </div>

          <!-- Key Features -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <!-- Offline Capabilities -->
            <div class="bg-white rounded-xl p-8 shadow-lg">
              <h2 class="text-2xl font-bold text-gray-900 mb-6">What Works Offline</h2>
              <div class="space-y-4">
                <div class="flex items-center space-x-3">
                  <div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg class="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="text-lg text-gray-700">Process sales transactions</span>
                </div>
                <div class="flex items-center space-x-3">
                  <div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg class="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="text-lg text-gray-700">Accept all payment methods</span>
                </div>
                <div class="flex items-center space-x-3">
                  <div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg class="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="text-lg text-gray-700">Update inventory levels</span>
                </div>
                <div class="flex items-center space-x-3">
                  <div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg class="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="text-lg text-gray-700">Generate receipts</span>
                </div>
                <div class="flex items-center space-x-3">
                  <div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg class="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="text-lg text-gray-700">Access customer data</span>
                </div>
              </div>
            </div>

            <!-- Sync Process -->
            <div class="bg-white rounded-xl p-8 shadow-lg">
              <h2 class="text-2xl font-bold text-gray-900 mb-6">Auto-Sync Process</h2>
              <div class="space-y-6">
                <div class="flex items-start space-x-4">
                  <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span class="text-blue-600 font-bold">1</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">Store Locally</h3>
                    <p class="text-gray-600">All transactions are securely stored on your device</p>
                  </div>
                </div>
                <div class="flex items-start space-x-4">
                  <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span class="text-blue-600 font-bold">2</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">Detect Connection</h3>
                    <p class="text-gray-600">System automatically detects when internet is restored</p>
                  </div>
                </div>
                <div class="flex items-start space-x-4">
                  <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span class="text-blue-600 font-bold">3</span>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">Sync Data</h3>
                    <p class="text-gray-600">Offline data syncs to cloud based on your subscription plan</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Benefits Section -->
          <div class="bg-white rounded-xl p-8 mb-12 shadow-lg">
            <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">Why Offline Mode Matters</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="text-center">
                <div class="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Never Lose Sales</h3>
                <p class="text-gray-600">Continue serving customers even when internet is down</p>
              </div>
              <div class="text-center">
                <div class="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
                <p class="text-gray-600">No network delays - transactions process instantly</p>
              </div>
              <div class="text-center">
                <div class="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Data Security</h3>
                <p class="text-gray-600">All offline data is encrypted and secure</p>
              </div>
            </div>
          </div>

          <!-- CTA Section -->
          <div class="bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl p-8 text-center">
            <h2 class="heading-font text-3xl font-bold text-white mb-4">Never Miss a Sale Again</h2>
            <p class="text-orange-100 text-lg mb-6">Experience the peace of mind that comes with reliable offline functionality.</p>
            <div class="space-x-4">
              <a routerLink="/register" class="inline-flex items-center px-8 py-3 bg-white text-orange-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
                Try Offline Mode
              </a>
              <a routerLink="/" class="inline-flex items-center px-8 py-3 border border-white text-white rounded-lg hover:bg-white hover:text-orange-600 transition-colors font-semibold">
                Back to Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </app-main-layout>
  `
})
export class FeatureOfflineComponent {}
