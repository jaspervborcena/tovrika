import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import cors from 'cors';
import express from 'express';

// Initialize Admin SDK once
try {
  admin.initializeApp();
} catch (e) {
  // no-op if already initialized
}

// CORS-enabled Express app for PayPal endpoints
const app = express();
const corsMiddleware = cors({ origin: true });
app.use(corsMiddleware);
app.use(express.json());

const sandboxBase = 'https://api-m.sandbox.paypal.com';

function getPaypalCredentials() {
  const cfg = functions.config();
  const clientId = cfg?.paypal?.client_id as string | undefined;
  const clientSecret = cfg?.paypal?.client_secret as string | undefined;
  if (!clientId || !clientSecret) {
    throw new Error('Missing PayPal credentials. Set with: firebase functions:config:set paypal.client_id=... paypal.client_secret=...');
  }
  return { clientId, clientSecret };
}

async function getAccessToken() {
  const { clientId, clientSecret } = getPaypalCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${sandboxBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${txt}`);
  }
  const data: any = await res.json();
  return data.access_token as string;
}

app.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'PHP', description } = req.body || {};
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const accessToken = await getAccessToken();
    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: String(amount)
          },
          description: description || 'Subscription payment'
        }
      ]
    };
    const r = await fetch(`${sandboxBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(orderBody)
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: 'create-order-failed', details: data });
    }
    return res.json(data);
  } catch (err: any) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: err.message || 'server-error' });
  }
});

app.post('/capture-order', async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
    const accessToken = await getAccessToken();
    const r = await fetch(`${sandboxBase}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: 'capture-order-failed', details: data });
    }
    return res.json(data);
  } catch (err: any) {
    console.error('capture-order error:', err);
    return res.status(500).json({ error: err.message || 'server-error' });
  }
});

export const paypal = functions.region('asia-east1').https.onRequest(app);
