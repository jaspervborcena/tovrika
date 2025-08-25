import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, MainLayoutComponent],
  template: `
    <app-main-layout>
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          <div class="bg-white shadow sm:rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h2 class="text-lg font-medium text-gray-900">Help Center</h2>
              
              <!-- Getting Started -->
              <div class="mt-6">
                <h3 class="text-md font-medium text-gray-900">Getting Started</h3>
                <div class="mt-2 text-sm text-gray-500">
                  <p>Learn how to use JasperPOS with our comprehensive guides:</p>
                  <ul class="list-disc pl-5 mt-2 space-y-1">
                    <li>Setting up your store</li>
                    <li>Managing inventory</li>
                    <li>Processing sales</li>
                    <li>Generating reports</li>
                  </ul>
                </div>
              </div>

              <!-- FAQs -->
              <div class="mt-6">
                <h3 class="text-md font-medium text-gray-900">Frequently Asked Questions</h3>
                <div class="mt-2 space-y-4">
                  <div>
                    <h4 class="text-sm font-medium text-gray-900">How do I add products to my inventory?</h4>
                    <p class="mt-1 text-sm text-gray-500">Navigate to Products, click "Add Product", and fill in the required details.</p>
                  </div>
                  <div>
                    <h4 class="text-sm font-medium text-gray-900">Can I use JasperPOS offline?</h4>
                    <p class="mt-1 text-sm text-gray-500">Yes, JasperPOS works offline and will sync data when internet connection is restored.</p>
                  </div>
                </div>
              </div>

              <!-- Contact Support -->
              <div class="mt-6">
                <h3 class="text-md font-medium text-gray-900">Contact Support</h3>
                <div class="mt-2 text-sm text-gray-500">
                  <p>Need help? Contact our support team:</p>
                  <div class="mt-2">
                    <p>Email: support&#64;jasperpos.com</p>
                    <p>Phone: 1-800-JASPER1</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-main-layout>
  `
})
export class HelpComponent {}
