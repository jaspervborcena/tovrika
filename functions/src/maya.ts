import { randomUUID } from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const db = getFirestore();
const mayaApiUrl = process.env.MAYA_API_URL || 'https://pg-sandbox.paymaya.com';
const mayaAppId = process.env.MAYA_APP_ID || '';
const mayaSecretKey = defineSecret('MAYA_SECRET_KEY');
const appBaseUrl = process.env.MAYA_APP_BASE_URL || 'https://app.pos.tovrika.com';

interface CheckoutMetadata {
  uid: string;
  companyId: string;
  storeId: string;
  tier: 'basic' | 'standard' | 'premium';
  durationMonths: number;
  amount: number;
  currency: 'PHP';
  email: string;
  payerName: string;
}

function requireMayaConfig(): void {
  if (!mayaAppId || !mayaSecretKey.value()) {
    throw new Error('Maya server credentials are not configured');
  }
}

async function requireUser(req: Parameters<typeof onRequest>[0] extends never ? never : any): Promise<{ uid: string; email: string }> {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) throw new Error('Authentication required');
  const token = await getAuth().verifyIdToken(header.slice(7));
  return { uid: token.uid, email: token.email || '' };
}

async function mayaRequest(path: string, body?: Record<string, unknown>, method = 'POST'): Promise<any> {
  requireMayaConfig();
  const response = await fetch(`${mayaApiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${mayaSecretKey.value()}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      'X-PayMaya-App-ID': mayaAppId
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Maya API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

function parseAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid payment amount');
  return Number(amount.toFixed(2));
}

function checkoutReference(checkout: any): string {
  return String(checkout?.checkoutId || checkout?.checkout_id || checkout?.id || '');
}

function checkoutUrl(checkout: any): string {
  return String(checkout?.redirectUrl || checkout?.redirect_url || checkout?.checkoutUrl || '');
}

export const mayaCreateCheckout = onRequest({ region: 'asia-east1', cors: true, secrets: [mayaSecretKey] }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const user = await requireUser(req);
    const body = req.body || {};
    const metadata: CheckoutMetadata = {
      uid: user.uid,
      companyId: String(body.companyId || ''),
      storeId: String(body.storeId || ''),
      tier: body.tier,
      durationMonths: Number(body.durationMonths),
      amount: parseAmount(body.amount),
      currency: 'PHP',
      email: String(body.email || user.email || ''),
      payerName: String(body.payerName || '')
    };

    if (!metadata.companyId || !metadata.storeId || !['basic', 'standard', 'premium'].includes(metadata.tier) || !Number.isInteger(metadata.durationMonths) || metadata.durationMonths < 1) {
      throw new Error('Invalid subscription checkout details');
    }

    const requestReferenceNumber = `TOVRIKA-${randomUUID()}`;
    const mayaCheckout = await mayaRequest('/checkout/v1/checkouts', {
      totalAmount: { value: metadata.amount.toFixed(2), currency: metadata.currency },
      buyer: {
        firstName: metadata.payerName || 'Tovrika',
        contact: { email: metadata.email }
      },
      items: [{
        name: `${metadata.tier.toUpperCase()} subscription`,
        quantity: 1,
        totalAmount: { value: metadata.amount.toFixed(2), currency: metadata.currency }
      }],
      redirectUrl: {
        success: `${appBaseUrl}/subscriptions?maya=success`,
        failure: `${appBaseUrl}/subscriptions?maya=failure`,
        cancel: `${appBaseUrl}/subscriptions?maya=cancelled`
      },
      requestReferenceNumber,
      metadata
    });

    const checkoutId = checkoutReference(mayaCheckout);
    const redirectUrl = checkoutUrl(mayaCheckout);
    if (!checkoutId || !redirectUrl) throw new Error('Maya did not return a checkout URL');

    await db.collection('mayaCheckouts').doc(checkoutId).set({
      ...metadata,
      checkoutId,
      requestReferenceNumber,
      status: 'PENDING',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    res.json({ checkoutId, redirectUrl, status: 'PENDING' });
  } catch (error: any) {
    console.error('Maya checkout creation failed', error);
    res.status(error?.message === 'Authentication required' ? 401 : 400).json({ error: error?.message || 'Unable to create Maya checkout' });
  }
});

async function activateCheckout(checkoutId: string, status: string): Promise<boolean> {
  const checkoutRef = db.collection('mayaCheckouts').doc(checkoutId);
  const checkoutSnap = await checkoutRef.get();
  if (!checkoutSnap.exists) throw new Error('Maya checkout was not found');

  const checkout = checkoutSnap.data() as CheckoutMetadata & { status?: string; activatedAt?: unknown };
  if (checkout.status === 'ACTIVE' || checkout.activatedAt) return true;
  if (!['COMPLETED', 'SUCCESS', 'PAYMENT_SUCCESS', 'PAID'].includes(status.toUpperCase())) return false;

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + checkout.durationMonths);
  const subscriptionRef = db.collection('subscriptions').doc();
  const billingRef = db.collection('companyBillingHistory').doc();

  await db.runTransaction(async transaction => {
    const current = await transaction.get(checkoutRef);
    const currentData = current.data() as any;
    if (currentData?.status === 'ACTIVE' || currentData?.activatedAt) return;

    transaction.set(subscriptionRef, {
      subscriptionId: randomUUID(),
      companyId: checkout.companyId,
      storeId: checkout.storeId,
      uid: checkout.uid,
      planType: checkout.tier,
      status: 'active',
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(endDate),
      isTrial: false,
      paymentMethod: 'paymaya',
      paymentReference: checkoutId,
      amountPaid: checkout.amount,
      currency: checkout.currency,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    transaction.set(billingRef, {
      companyId: checkout.companyId,
      storeId: checkout.storeId,
      tier: checkout.tier,
      cycle: checkout.durationMonths === 12 ? 'yearly' : checkout.durationMonths === 3 ? 'quarterly' : 'monthly',
      durationMonths: checkout.durationMonths,
      amount: checkout.amount,
      discountPercent: 0,
      finalAmount: checkout.amount,
      paymentMethod: 'paymaya',
      paidAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    transaction.update(db.collection('stores').doc(checkout.storeId), {
      subscriptionEndDate: Timestamp.fromDate(endDate),
      updatedAt: Timestamp.now()
    });
    transaction.update(checkoutRef, { status: 'ACTIVE', activatedAt: Timestamp.now(), mayaStatus: status, updatedAt: Timestamp.now() });
  });
  return true;
}

export const mayaVerifyCheckout = onRequest({ region: 'asia-east1', cors: true, secrets: [mayaSecretKey] }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const user = await requireUser(req);
    const checkoutId = String(req.body?.checkoutId || '');
    if (!checkoutId) throw new Error('Checkout ID is required');
    const checkoutSnap = await db.collection('mayaCheckouts').doc(checkoutId).get();
    const checkout = checkoutSnap.data() as any;
    if (!checkout || checkout.uid !== user.uid) throw new Error('Checkout not found');

    requireMayaConfig();
    const mayaStatus = await mayaRequest(`/checkout/v1/checkouts/${encodeURIComponent(checkoutId)}`, undefined, 'GET');
    const status = String(mayaStatus?.status || mayaStatus?.paymentStatus || checkout.status || 'PENDING').toUpperCase();
    const activated = await activateCheckout(checkoutId, status);
    res.json({ checkoutId, status: activated ? 'ACTIVE' : status, subscriptionActivated: activated });
  } catch (error: any) {
    console.error('Maya checkout verification failed', error);
    res.status(error?.message === 'Authentication required' ? 401 : 400).json({ error: error?.message || 'Unable to verify Maya checkout' });
  }
});

export const mayaWebhook = onRequest({ region: 'asia-east1', cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }
    const payload = req.body || {};
    const event = payload.data || payload;
    const checkoutId = String(event.checkoutId || event.checkout_id || event.id || '');
    const status = String(event.status || event.paymentStatus || '').toUpperCase();
    if (!checkoutId) throw new Error('Checkout ID is missing');
    await activateCheckout(checkoutId, status);
    res.json({ received: true });
  } catch (error: any) {
    console.error('Maya webhook failed', error);
    res.status(400).json({ error: error?.message || 'Webhook processing failed' });
  }
});