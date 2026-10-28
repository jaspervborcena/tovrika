import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getDownloadURL } from 'firebase-admin/storage';
import type { Request, Response } from 'express';
import { createHash } from 'crypto';
export { mayaCreateCheckout, mayaVerifyCheckout, mayaWebhook } from './maya.js';

if (!getApps().length) {
  initializeApp();
}

const storage = getStorage();

const salesSummaryCorsOrigins = [
  'https://app.pos.tovrika.com',
  'https://app.tovrika.com',
  'http://localhost:4200'
];

const salesSummaryProxyQueryParameters = [
  'storeId',
  'from',
  'to',
  'page_number',
  'page_size',
  'orderId',
  'invoiceNumber'
];

async function proxySalesSummaryRequest(
  req: Request,
  res: Response,
  targetUrl: string,
  requireDateRange: boolean
): Promise<void> {
  if (req.method !== 'GET') {
    res.set('Allow', 'GET').status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authorization = req.get('Authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ error: 'Authentication is required' });
    return;
  }

  try {
    await getAuth().verifyIdToken(token);
  } catch (error) {
    console.warn('Sales summary proxy rejected an invalid Firebase token.', error);
    res.status(401).json({ error: 'Authentication is invalid or expired' });
    return;
  }

  const params = new URLSearchParams();
  for (const key of salesSummaryProxyQueryParameters) {
    const value = req.query[key];
    if (typeof value === 'string' && value.trim()) {
      params.set(key, value);
    }
  }

  if (requireDateRange && (!params.has('storeId') || !params.has('from') || !params.has('to'))) {
    res.status(400).json({ error: 'storeId, from, and to are required' });
    return;
  }
  if (!requireDateRange && !params.has('orderId') && !params.has('invoiceNumber')) {
    res.status(400).json({ error: 'orderId or invoiceNumber is required' });
    return;
  }

  try {
    const separator = targetUrl.includes('?') ? '&' : '?';
    const upstream = await fetch(`${targetUrl}${separator}${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await upstream.text();
    res
      .set('Content-Type', upstream.headers.get('content-type') || 'application/json')
      .set('Cache-Control', 'no-store')
      .status(upstream.status)
      .send(body);
  } catch (error) {
    console.error('Sales summary upstream request failed.', error);
    res.status(502).json({ error: 'Sales summary service is unavailable' });
  }
}

export const salesSummaryDetailsProxy = onRequest({
  region: 'asia-east1',
  cors: salesSummaryCorsOrigins,
  timeoutSeconds: 60
}, async (req, res) => {
  await proxySalesSummaryRequest(
    req,
    res,
    'https://get-sales-summary-details-bq-3ao45uhsoq-de.a.run.app',
    true
  );
});

export const salesSummaryOrderDetailsProxy = onRequest({
  region: 'asia-east1',
  cors: salesSummaryCorsOrigins,
  timeoutSeconds: 60
}, async (req, res) => {
  await proxySalesSummaryRequest(
    req,
    res,
    'https://get-sales-summary-order-details-bq-3ao45uhsoq-de.a.run.app',
    false
  );
});

export const downloadRewardsApk = onRequest({ region: 'asia-east1', cors: true }, async (req, res) => {
  const slug = (req.query.slug as string | undefined)?.trim() || 'rewards';
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'rewards';
  const filename = `${safeSlug}.apk`;

  try {
    const bucket = storage.bucket();
    const candidatePaths = [
      `android/rewards/${safeSlug}.apk`,
      `android/rewards/Rewards-${safeSlug}.apk`,
      `android/rewards/Rewards${safeSlug}.apk`,
      'android/rewards/rewards.apk',
      'android/rewards/Rewards.apk',
    ];

    let file = null as ReturnType<typeof bucket.file> | null;
    for (const candidatePath of candidatePaths) {
      const candidateFile = bucket.file(candidatePath);
      const [exists] = await candidateFile.exists();
      if (exists) {
        file = candidateFile;
        break;
      }
    }

    if (!file) {
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
