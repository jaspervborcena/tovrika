import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MainLayoutComponent } from '../../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-feature-inventory',
  standalone: true,
  imports: [CommonModule, RouterLink, MainLayoutComponent],
  template: `
    <app-main-layout>
      <div class="bg-gradient-to-br from-green-50 to-emerald-100 min-h-screen py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- Header -->
          <div class="text-center mb-12">
            <div class="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 text-white mb-6">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 class="heading-font text-4xl font-bold text-gray-900 mb-4">Inventory Management</h1>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">Real-time inventory tracking and management system that keeps your business running smoothly.</p>
          </div>

          <!-- Features Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <!-- Main Features -->
            <div class="space-y-6">
              <h2 class="heading-font text-2xl font-semibold text-gray-900">Powerful Features</h2>
              
              <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div class="flex items-start space-x-4">
                  <div class="flex-shrink-0">
                    <div class="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Real-Time Tracking</h3>
                    <p class="text-gray-600">Monitor stock levels in real-time across all locations with automatic updates.</p>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div class="flex items-start space-x-4">
                  <div class="flex-shrink-0">
                    <div class="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Low Stock Alerts</h3>
                    <p class="text-gray-600">Get notified when items are running low so you never run out of popular products.</p>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div class="flex items-start space-x-4">
                  <div class="flex-shrink-0">
                    <div class="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Multi-Location Support</h3>
                    <p class="text-gray-600">Manage inventory across multiple stores and warehouses from one central dashboard.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Benefits -->
            <div class="space-y-6">
              <h2 class="heading-font text-2xl font-semibold text-gray-900">Why Choose Our System</h2>
              <div class="bg-white rounded-xl p-8 shadow-lg border border-gray-100">
                <div class="space-y-4">
                  <div class="flex items-center space-x-3">
                    <svg class="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-gray-700">Automated reorder points</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <svg class="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-gray-700">Barcode scanning support</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <svg class="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-gray-700">Supplier management</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <svg class="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-gray-700">Cost tracking & analysis</span>
                  </div>
                  <div class="flex items-center space-x-3">
                    <svg class="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-gray-700">Historical data & trends</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CTA Section -->
          <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-8 text-center">
            <h2 class="heading-font text-3xl font-bold text-white mb-4">Take Control of Your Inventory</h2>
            <p class="text-green-100 text-lg mb-6">Never run out of stock or overorder again with smart inventory management.</p>
            <div class="space-x-4">
              <a routerLink="/register" class="inline-flex items-center px-8 py-3 bg-white text-green-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
                Start Free Trial
              </a>
              <a routerLink="/" class="inline-flex items-center px-8 py-3 border border-white text-white rounded-lg hover:bg-white hover:text-green-600 transition-colors font-semibold">
                Back to Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </app-main-layout>
  `
})
export class FeatureInventoryComponent {}
