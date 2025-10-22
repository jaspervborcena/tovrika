import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CloudLoggingService } from '../../services/cloud-logging.service';

@Component({
  selector: 'app-logging-monitor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="logging-monitor">
      <div class="monitor-header">
        <h3>📊 Logging Status</h3>
        <span class="status-badge" [class]="isOnline() ? 'online' : 'offline'">
          {{ isOnline() ? '🟢 Online' : '🔴 Offline' }}
        </span>
      </div>
      
      <div class="stats">
        <div class="stat-item">
          <span class="stat-label">Offline Logs:</span>
          <span class="stat-value">{{ offlineLogsCount() }}</span>
        </div>
        
        <div class="actions" *ngIf="offlineLogsCount() > 0">
          <button class="btn btn-sm btn-warning" (click)="clearOfflineLogs()">
            🧹 Clear Offline Logs
          </button>
        </div>
      </div>
      
      <div class="recent-activity" *ngIf="recentLogs().length > 0">
        <h4>Recent Activity:</h4>
        <div class="log-entry" *ngFor="let log of recentLogs()">
          <span class="severity" [class]="log.severity.toLowerCase()">{{ log.severity }}</span>
          <span class="component">{{ log.component }}</span>
          <span class="message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .logging-monitor {
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin: 16px 0;
    }
    
    .monitor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    
    .status-badge.online {
      background: #d4edda;
      color: #155724;
    }
    
    .status-badge.offline {
      background: #f8d7da;
      color: #721c24;
    }
    
    .stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .stat-item {
      display: flex;
      flex-direction: column;
    }
    
    .stat-label {
      font-size: 12px;
      color: #666;
    }
    
    .stat-value {
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
    
    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .btn-warning {
      background: #ffc107;
      color: #212529;
    }
    
    .btn-warning:hover {
      background: #e0a800;
    }
    
    .recent-activity h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #666;
    }
    
    .log-entry {
      display: flex;
      gap: 8px;
      padding: 4px 0;
      font-size: 12px;
      border-bottom: 1px solid #eee;
    }
    
    .log-entry:last-child {
      border-bottom: none;
    }
    
    .severity {
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: bold;
      min-width: 60px;
      text-align: center;
    }
    
    .severity.info {
      background: #d1ecf1;
      color: #0c5460;
    }
    
    .severity.warning {
      background: #fff3cd;
      color: #856404;
    }
    
    .severity.error {
      background: #f8d7da;
      color: #721c24;
    }
    
    .component {
      font-weight: bold;
      color: #495057;
      min-width: 120px;
    }
    
    .message {
      color: #666;
      flex: 1;
    }
  `]
})
export class LoggingMonitorComponent implements OnInit {
  private cloudLoggingService = inject(CloudLoggingService);
  
  isOnline = signal(navigator.onLine);
  offlineLogsCount = signal(0);
  recentLogs = signal<any[]>([]);

  ngOnInit() {
    this.updateStats();
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.updateStats();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline.set(false);
      this.updateStats();
    });
    
    // Update stats every 30 seconds
    setInterval(() => {
      this.updateStats();
    }, 30000);
  }

  private updateStats() {
    this.offlineLogsCount.set(this.cloudLoggingService.getOfflineLogsCount());
  }

  clearOfflineLogs() {
    if (confirm('Are you sure you want to clear all offline logs? This action cannot be undone.')) {
      this.cloudLoggingService.clearOfflineLogs();
      this.updateStats();
    }
  }
}