import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MainLayoutComponent } from '../../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-feature-pos',
  standalone: true,
  imports: [CommonModule, RouterLink, MainLayoutComponent],
  template: `
    <app-main-layout>
      <div class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- Header -->
          <div class="text-center mb-12">
            <div class="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white mb-6">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 class="heading-font text-4xl font-bold text-gray-900 mb-4">Point of Sale System</h1>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">Fast and intuitive POS system with offline capabilities designed for modern businesses.</p>
          </div>

          <!-- Features Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <!-- Main Features -->
            <div class="space-y-6">
              <h2 class="heading-font text-2xl font-semibold text-gray-900">Key Features</h2>
              
              <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div class="flex items-start space-x-4">
                  <div class="flex-shrink-0">
                    <div class="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Offline Capabilities</h3>
                    <p class="text-gray-600">Continue processing sales even without internet connection. All data syncs automatically when connection is restored.</p>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div class="flex items-start space-x-4">
                  <div class="flex-shrink-0">
                    <div class="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
                    <p class="text-gray-600">Process transactions in seconds with our optimized interface designed for speed and efficiency.</p>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div class="flex items-start space-x-4">
                  <div class="flex-shrink-0">
                    <div class="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Multiple Payment Methods</h3>
                    <p class="text-gray-600">Accept cash, credit cards, mobile payments, and digital wallets all in one unified system.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Screenshots/Demo -->
            <div class="space-y-6">
              <h2 class="heading-font text-2xl font-semibold text-gray-900">See It In Action</h2>
              <div class="bg-white rounded-xl p-8 shadow-lg border border-gray-100 text-center">
                <div class="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg h-64 flex items-center justify-center mb-6">
                  <svg class="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Interactive Demo</h3>
                <p class="text-gray-600 mb-4">Try our POS system with sample data to see how easy it is to use.</p>
                <button class="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                  <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-5 5v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Try Demo
                </button>
              </div>
            </div>
          </div>

          <!-- CTA Section -->
          <div class="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 text-center">
            <h2 class="heading-font text-3xl font-bold text-white mb-4">Ready to streamline your sales?</h2>
            <p class="text-primary-100 text-lg mb-6">Start using our POS system today and see the difference.</p>
            <div class="space-x-4">
              <a routerLink="/register" class="inline-flex items-center px-8 py-3 bg-white text-primary-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
                Get Started Free
              </a>
              <a routerLink="/" class="inline-flex items-center px-8 py-3 border border-white text-white rounded-lg hover:bg-white hover:text-primary-600 transition-colors font-semibold">
                Back to Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </app-main-layout>
  `
})
export class FeaturePosComponent {}
