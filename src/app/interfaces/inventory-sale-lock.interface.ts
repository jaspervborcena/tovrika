export function createInventorySaleLockId(
  orderId: string,
  itemIndex: number | string,
  productId: string,
  itemCode: string
): string {
  return encodeURIComponent(`${orderId}|${itemIndex}|${productId}|${itemCode}`);
}
