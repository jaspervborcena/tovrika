import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { CompanyService } from '../../services/company.service';
import { Router } from '@angular/router';

interface CompanyOption {
  companyId: string;
  companyName: string;
  roleId: string;
}

@Component({
  selector: 'app-company-selection',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="company-selection-container">
      <div class="company-selection-card">
        <div class="header">
          <h2>Select Company</h2>
          <p>You have access to multiple companies. Please select which one you'd like to work with:</p>
        </div>
        
        <div class="company-list">
          <div 
            *ngFor="let company of availableCompanies()" 
            class="company-option"
            [class.selected]="selectedCompanyId() === company.companyId"
            (click)="selectCompany(company)"
          >
            <div class="company-info">
              <h3>{{ company.companyName }}</h3>
              <p class="role-badge">{{ company.roleId | titlecase }}</p>
            </div>
            <div class="check-icon" *ngIf="selectedCompanyId() === company.companyId">
              ✓
            </div>
          </div>
        </div>
        
        <div class="actions">
          <button 
            class="continue-btn"
            [disabled]="!selectedCompanyId() || isLoading()"
            (click)="continue()"
          >
            {{ isLoading() ? 'Loading...' : 'Continue' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .company-selection-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }
    
    .company-selection-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      padding: 2rem;
      max-width: 500px;
      width: 100%;
    }
    
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .header h2 {
      color: #2d3748;
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
    
    .header p {
      color: #718096;
      margin: 0;
    }
    
    .company-list {
      margin-bottom: 2rem;
    }
    
    .company-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 0.75rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .company-option:hover {
      border-color: #667eea;
      background-color: #f7fafc;
    }
    
    .company-option.selected {
      border-color: #667eea;
      background-color: #edf2f7;
    }
    
    .company-info h3 {
      margin: 0 0 0.25rem 0;
      color: #2d3748;
      font-size: 1.1rem;
    }
    
    .role-badge {
      background: #667eea;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      margin: 0;
      display: inline-block;
    }
    
    .check-icon {
      color: #48bb78;
      font-weight: bold;
      font-size: 1.2rem;
    }
    
    .continue-btn {
      width: 100%;
      padding: 0.75rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    
    .continue-btn:hover:not(:disabled) {
      background: #5a67d8;
    }
    
    .continue-btn:disabled {
      background: #a0aec0;
      cursor: not-allowed;
    }
  `]
})
export class CompanySelectionComponent {
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private router = inject(Router);
  
  readonly selectedCompanyId = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly availableCompanies = signal<CompanyOption[]>([]);
  
  async ngOnInit() {
    try {
      this.isLoading.set(true);
      
      // Get user's companies from the new permissions structure
      const userCompanies = this.authService.getUserCompanies();
      
      // Load company details
      const companyOptions: CompanyOption[] = [];
      for (const userCompany of userCompanies) {
        try {
          const company = await this.companyService.getCompanyById(userCompany.companyId);
          if (company) {
            companyOptions.push({
              companyId: userCompany.companyId,
              companyName: company.name, // Company interface uses 'name' property
              roleId: userCompany.roleId
            });
          }
        } catch (error) {
          console.error('Error loading company:', userCompany.companyId, error);
        }
      }
      
      this.availableCompanies.set(companyOptions);
      
      // Auto-select if user has a current company preference
      const currentUser = this.authService.currentUser();
      if (currentUser?.currentCompanyId) {
        this.selectedCompanyId.set(currentUser.currentCompanyId);
      }
      
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
  
  selectCompany(company: CompanyOption) {
    this.selectedCompanyId.set(company.companyId);
  }
  
  async continue() {
    const companyId = this.selectedCompanyId();
    if (!companyId) return;
    
    try {
      this.isLoading.set(true);
      
      // Update the user's selected company
      await this.authService.selectCompany(companyId);
      
      // Navigate to dashboard
      await this.router.navigate(['/dashboard']);
      
    } catch (error) {
      console.error('Error selecting company:', error);
      // Could show an error message here
    } finally {
      this.isLoading.set(false);
    }
  }
}