export interface FifoInventoryBatch<TRef = unknown> {
  id: string;
  ref: TRef;
  status: string;
  quantity: number;
  receivedAt?: Date | string | number | { toDate(): Date };
  createdAt?: Date | string | number | { toDate(): Date };
  batchId?: string;
  costPrice?: number;
  unitPrice?: number;
  totalDeducted?: number;
}

export interface FifoBatchAllocation<TRef = unknown> {
  batchId: string;
  refId: string;
  costPrice: number;
  quantity: number;
  ref: TRef;
}

export interface FifoBatchWrite<TRef = unknown> {
  ref: TRef;
  quantity: number;
  totalDeducted: number;
  status: string;
}

export interface FifoBatchPlan<TRef = unknown> {
  allocations: FifoBatchAllocation<TRef>[];
  plannedBatchQuantities: Map<string, number>;
  batchWrites: Map<string, FifoBatchWrite<TRef>>;
  remainingQuantity: number;
  pendingReservation: number;
}

function toTimestamp(value: FifoInventoryBatch['receivedAt']): number {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return value.toDate().getTime();
  }
  return new Date(value ?? 0).getTime();
}

export function planFifoBatchDeductions<TRef>(
  batches: FifoInventoryBatch<TRef>[],
  quantityToDeduct: number,
  pendingReservation: number,
  existingPlannedQuantities: ReadonlyMap<string, number>,
  fallbackCostPrice = 0
): FifoBatchPlan<TRef> {
  const plannedBatchQuantities = new Map(existingPlannedQuantities);
  const batchWrites = new Map<string, FifoBatchWrite<TRef>>();
  const allocations: FifoBatchAllocation<TRef>[] = [];
  const activeBatches = batches
    .filter(batch => batch.status.toLowerCase() === 'active' && batch.quantity > 0)
    .sort((a, b) =>
      toTimestamp(a.receivedAt || a.createdAt) - toTimestamp(b.receivedAt || b.createdAt) ||
      a.id.localeCompare(b.id)
    );

  let remainingQuantity = quantityToDeduct;
  let pendingToReserve = pendingReservation;

  for (const batch of activeBatches) {
    const alreadyPlanned = plannedBatchQuantities.get(batch.id) || 0;
    const availableQuantity = Math.max(0, batch.quantity - alreadyPlanned);
    const reservedQuantity = Math.min(pendingToReserve, availableQuantity);
    pendingToReserve -= reservedQuantity;
    const deductionQuantity = Math.min(remainingQuantity, availableQuantity - reservedQuantity);
    if (deductionQuantity <= 0) continue;

    const costPrice = Number(batch.costPrice || batch.unitPrice || fallbackCostPrice || 0);
    plannedBatchQuantities.set(batch.id, alreadyPlanned + deductionQuantity);
    const newQuantity = batch.quantity - alreadyPlanned - deductionQuantity;
    batchWrites.set(batch.id, {
      ref: batch.ref,
      quantity: newQuantity,
      totalDeducted: Number(batch.totalDeducted || 0) + alreadyPlanned + deductionQuantity,
      status: newQuantity === 0 ? 'depleted' : 'active'
    });
    allocations.push({
      batchId: batch.batchId || batch.id,
      refId: batch.id,
      costPrice,
      quantity: deductionQuantity,
      ref: batch.ref
    });
    remainingQuantity -= deductionQuantity;
    if (remainingQuantity <= 0) break;
  }

  return {
    allocations,
    plannedBatchQuantities,
    batchWrites,
    remainingQuantity,
    pendingReservation: pendingToReserve
  };
}
