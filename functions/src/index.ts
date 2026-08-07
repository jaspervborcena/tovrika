import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getDownloadURL } from 'firebase-admin/storage';
import { createHash } from 'crypto';

if (!getApps().length) {
  initializeApp();
}

const storage = getStorage();

export const downloadRewardsApk = onRequest({ cors: true }, async (req, res) => {
  const slug = (req.query.slug as string | undefined)?.trim() || 'rewards';
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'rewards';
  const filename = `${safeSlug}.apk`;

  try {
    const bucket = storage.bucket();
    const file = bucket.file('android/rewards/Rewards.apk');
    const [exists] = await file.exists();

    if (!exists) {
      res.status(404).json({ error: 'APK not found' });
      return;
    }

    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/vnd.android.package-archive';
    const [buffer] = await file.download();
    const etag = metadata.etag || createHash('sha256').update(buffer).digest('hex');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('ETag', etag);
    res.send(buffer);
  } catch (error) {
    console.error('Failed to download rewards APK', error);
    res.status(500).json({ error: 'Unable to download APK' });
  }
});

