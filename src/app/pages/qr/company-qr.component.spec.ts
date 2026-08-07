import { buildRewardsApkDownloadUrl, buildRewardsApkStoragePath } from './company-qr.component';

describe('buildRewardsApkStoragePath', () => {
  it('should return the expected Firebase Storage path for the APK', () => {
    expect(buildRewardsApkStoragePath()).toBe('android/rewards/Rewards.apk');
  });
});

describe('buildRewardsApkDownloadUrl', () => {
  it('should build a function URL using the slug', () => {
    const url = buildRewardsApkDownloadUrl('tovrika');

    expect(url).toContain('/downloadRewardsApk?slug=tovrika');
  });
});
