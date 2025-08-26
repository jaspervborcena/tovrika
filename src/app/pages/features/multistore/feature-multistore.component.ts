import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MainLayoutComponent } from '../../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-feature-multistore',
  standalone: true,
  imports: [CommonModule, RouterLink, MainLayoutComponent],
  template: `
    <app-main-layout>
      <div class="bg-gradient-to-br from-teal-50 to-cyan-100 min-h-screen py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- Header -->
          <div class="text-center mb-12">
            <div class="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white mb-6">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 class="heading-font text-4xl font-bold text-gray-900 mb-4">Multi-Store Support</h1>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">Manage multiple locations effortlessly with centralized control and location-specific settings.</p>
          </div>

          <!-- Key Benefits -->
          <div class="bg-white rounded-xl p-8 mb-12 shadow-lg">
            <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">Centralized Management</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="flex items-start space-x-3">
                <div class="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center mt-1">
                  <svg class="h-4 w-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">Unified Dashboard</h3>
                  <p class="text-gray-600">Monitor all locations from one central dashboard</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <div class="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center mt-1">
                  <svg class="h-4 w-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">Role-Based Access</h3>
                  <p class="text-gray-600">Control who can access what at each location</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <div class="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center mt-1">
                  <svg class="h-4 w-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">Inventory Transfers</h3>
                  <p class="text-gray-600">Move stock between locations seamlessly</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <div class="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center mt-1">
                  <svg class="h-4 w-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">Location Performance</h3>
                  <p class="text-gray-600">Compare performance across all branches</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Features Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <!-- Store Management -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M10.5 3L12 2l1.5 1H21v4H3V3h7.5z" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Store Management</h3>
              <p class="text-gray-600">Each location maintains its own settings, staff, and operational preferences while staying connected to the main system.</p>
            </div>

            <!-- Real-time Sync -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Real-time Sync</h3>
              <p class="text-gray-600">All data syncs automatically across locations, ensuring everyone has the latest information at all times.</p>
            </div>

            <!-- Custom Pricing -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Location-specific Pricing</h3>
              <p class="text-gray-600">Set different prices for different locations while maintaining consistent product catalogs across your business.</p>
            </div>
          </div>

          <!-- CTA Section -->
          <div class="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-8 text-center">
            <h2 class="heading-font text-3xl font-bold text-white mb-4">Scale Your Business Across Locations</h2>
            <p class="text-teal-100 text-lg mb-6">Expand with confidence knowing you have complete control over all your locations.</p>
            <div class="space-x-4">
              <a routerLink="/register" class="inline-flex items-center px-8 py-3 bg-white text-teal-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
                Start Multi-Store Setup
              </a>
              <a routerLink="/" class="inline-flex items-center px-8 py-3 border border-white text-white rounded-lg hover:bg-white hover:text-teal-600 transition-colors font-semibold">
                Back to Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </app-main-layout>
  `
})
export class FeatureMultistoreComponent {}
