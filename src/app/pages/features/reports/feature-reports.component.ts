import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MainLayoutComponent } from '../../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-feature-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, MainLayoutComponent],
  template: `
    <app-main-layout>
      <div class="bg-gradient-to-br from-purple-50 to-indigo-100 min-h-screen py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- Header -->
          <div class="text-center mb-12">
            <div class="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 text-white mb-6">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 class="heading-font text-4xl font-bold text-gray-900 mb-4">Reports & Analytics</h1>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">Detailed insights and reports for better decision making with powerful data visualization.</p>
          </div>

          <!-- Features Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <!-- Sales Reports -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Sales Reports</h3>
              <p class="text-gray-600 mb-4">Track daily, weekly, and monthly sales with detailed breakdowns by product, category, and employee.</p>
              <ul class="space-y-2 text-sm text-gray-500">
                <li>• Revenue trends</li>
                <li>• Top selling products</li>
                <li>• Sales by location</li>
                <li>• Performance metrics</li>
              </ul>
            </div>

            <!-- Customer Analytics -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Customer Analytics</h3>
              <p class="text-gray-600 mb-4">Understand your customers better with detailed purchasing patterns and behavior analysis.</p>
              <ul class="space-y-2 text-sm text-gray-500">
                <li>• Customer lifetime value</li>
                <li>• Purchase frequency</li>
                <li>• Loyalty programs</li>
                <li>• Demographics</li>
              </ul>
            </div>

            <!-- Financial Reports -->
            <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div class="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center mb-4">
                <svg class="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Financial Reports</h3>
              <p class="text-gray-600 mb-4">Complete financial overview with profit margins, tax reports, and expense tracking.</p>
              <ul class="space-y-2 text-sm text-gray-500">
                <li>• Profit & loss statements</li>
                <li>• Tax compliance reports</li>
                <li>• Cash flow analysis</li>
                <li>• Expense categorization</li>
              </ul>
            </div>
          </div>

          <!-- CTA Section -->
          <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-8 text-center">
            <h2 class="heading-font text-3xl font-bold text-white mb-4">Make Data-Driven Decisions</h2>
            <p class="text-purple-100 text-lg mb-6">Transform your business data into actionable insights that drive growth.</p>
            <div class="space-x-4">
              <a routerLink="/register" class="inline-flex items-center px-8 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
                Start Analyzing Now
              </a>
              <a routerLink="/" class="inline-flex items-center px-8 py-3 border border-white text-white rounded-lg hover:bg-white hover:text-purple-600 transition-colors font-semibold">
                Back to Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </app-main-layout>
  `
})
export class FeatureReportsComponent {}
