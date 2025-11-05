// SyncAdjustmentService removed. This file previously provided auto-sync and manual adjustment
// utilities for offline orders. The service has been intentionally removed per request.

// Export a small stub so any remaining imports will fail fast if used.
export class SyncAdjustmentService {
  constructor() {
    throw new Error('SyncAdjustmentService has been removed. Please remove usages or re-implement sync logic.');
  }
}
