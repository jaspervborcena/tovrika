import { Injectable } from '@angular/core';
import { OfflineReconciliationService } from '../../../services/offline-reconciliation.service';

@Injectable()
export class OfflineReconciliationFifoService extends OfflineReconciliationService {
  reprocessOrder(orderId: string): Promise<{ success: boolean; message: string; error?: any }> {
    return this.reprocessInventory(orderId);
  }
}