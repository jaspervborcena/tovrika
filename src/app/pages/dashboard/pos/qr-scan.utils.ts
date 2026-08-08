export function extractCustomerIdentifierFromQrValue(scannedText: string): string {
  const value = (scannedText || '').trim();
  if (!value) {
    return '';
  }

  const urlBasePattern = /^https?:\/\/[^/]+\/qr\//i;
  const normalized = value.replace(urlBasePattern, '');
  const customerId = normalized.split('/').pop()?.trim() || normalized;

  return customerId;
}
