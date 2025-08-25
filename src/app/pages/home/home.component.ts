import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent, MainLayoutComponent],
  template: `
    <app-main-layout>
      <!-- Hero Section -->
      <div class="bg-primary-600">
        <div class="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
          <div class="text-center">
            <h2 class="text-4xl font-extrabold text-white sm:text-5xl">
              <span class="block">Modern Point of Sale</span>
              <span class="block">for Modern Businesses</span>
            </h2>
            <p class="mt-4 text-xl text-primary-100">
              Everything you need to manage your business, from anywhere.
            </p>
            <div class="mt-8">
              <ui-button routerLink="/register" variant="secondary">Get Started Free</ui-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Features -->
      <div class="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-extrabold text-gray-900">Features</h2>
          <p class="mt-4 text-xl text-gray-600">Everything you need to run your business efficiently</p>
        </div>

        <div class="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <!-- Point of Sale -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 class="mt-4 text-lg font-medium text-gray-900">Point of Sale</h3>
              <p class="mt-2 text-gray-600">Fast and intuitive POS system with offline capabilities.</p>
            </div>
          </div>

          <!-- Inventory Management -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 class="mt-4 text-lg font-medium text-gray-900">Inventory Management</h3>
              <p class="mt-2 text-gray-600">Real-time inventory tracking and management.</p>
            </div>
          </div>

          <!-- Reports -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 class="mt-4 text-lg font-medium text-gray-900">Reports & Analytics</h3>
              <p class="mt-2 text-gray-600">Detailed insights and reports for better decision making.</p>
            </div>
          </div>

          <!-- Multi-Store -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 class="mt-4 text-lg font-medium text-gray-900">Multi-Store Support</h3>
              <p class="mt-2 text-gray-600">Manage multiple locations from a single dashboard.</p>
            </div>
          </div>

          <!-- Offline Mode -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 class="mt-4 text-lg font-medium text-gray-900">Offline Mode</h3>
              <p class="mt-2 text-gray-600">Continue operations even without internet connection.</p>
            </div>
          </div>

          <!-- Cloud Sync -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16a5 5 0 01-.916-9.916 5.002 5.002 0 019.832 0A5.002 5.002 0 0116 16m-7 3l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <h3 class="mt-4 text-lg font-medium text-gray-900">Cloud Sync</h3>
              <p class="mt-2 text-gray-600">All your data synced securely across devices.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA Section -->
      <div class="bg-primary-700">
        <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
          <div class="text-center">
            <h2 class="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <div class="mt-8">
              <ui-button routerLink="/register" variant="secondary">Start Free Trial</ui-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="bg-white">
        <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div class="mt-8 border-t border-gray-200 pt-8 md:flex md:items-center md:justify-between">
            <div class="flex space-x-6 md:order-2">
              <a href="#" class="text-gray-400 hover:text-gray-500">
                <span class="sr-only">Twitter</span>
                <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" class="text-gray-400 hover:text-gray-500">
                <span class="sr-only">GitHub</span>
                <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
                </svg>
              </a>
            </div>
            <p class="mt-8 text-base text-gray-400 md:mt-0 md:order-1">
              &copy; 2025 JasperPOS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </app-main-layout>
  `
})
export class HomeComponent {}
