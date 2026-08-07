import { shouldGenerateCompanyQrPayload } from './company-profile.component';

describe('shouldGenerateCompanyQrPayload', () => {
  it('returns true when the company has no QR payload', () => {
    expect(shouldGenerateCompanyQrPayload({} as any)).toBeTrue();
  });

  it('returns false when the company already has a valid QR payload', () => {
    expect(shouldGenerateCompanyQrPayload({ qrPayload: 'https://app.tovrika.com/qr/demo' } as any)).toBeFalse();
  });

  it('returns true when the stored QR payload is not a valid company QR URL', () => {
    expect(shouldGenerateCompanyQrPayload({ qrPayload: 'custom-value' } as any)).toBeTrue();
  });
});
