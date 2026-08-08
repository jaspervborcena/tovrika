import { extractCustomerIdentifierFromQrValue } from './qr-scan.utils';

describe('extractCustomerIdentifierFromQrValue', () => {
  it('extracts the customer identifier from a QR URL payload', () => {
    expect(extractCustomerIdentifierFromQrValue('https://app.tovrika.com/qr/customer-123')).toBe('customer-123');
  });

  it('returns the raw identifier when the QR payload is already a plain value', () => {
    expect(extractCustomerIdentifierFromQrValue('customer-456')).toBe('customer-456');
  });

  it('returns an empty string for blank input', () => {
    expect(extractCustomerIdentifierFromQrValue('   ')).toBe('');
  });
});
