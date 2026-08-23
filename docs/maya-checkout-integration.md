# Maya Checkout Integration

The subscription upgrade modal uses Maya Checkout for Visa, Mastercard, and QRPh payments. The browser receives only a short-lived checkout URL; the Maya secret key remains in Cloud Functions.

## Configure Functions

From the repository root, set the values in the Functions environment. Do not commit the secret key.

```powershell
firebase functions:secrets:set MAYA_SECRET_KEY
```

Set these non-secret values in `functions/.env` or the Firebase Functions environment used by your deployment:

```text
MAYA_APP_ID=d2c11665-b0b5-40a7-a885-34800e312052
MAYA_API_URL=https://pg-sandbox.paymaya.com
MAYA_APP_BASE_URL=https://app.pos.tovrika.com
```

Use `https://pg.paymaya.com` for live payments after Maya approves the account. The App ID is not a substitute for the Maya secret key.

## Configure Maya Webhooks

The webhook URL must be the deployed function endpoint, not `https://www.pos.tovrika.com` by itself:

```text
https://asia-east1-<firebase-project-id>.cloudfunctions.net/mayaWebhook
```

Maya documents webhook security through its official source IP allowlist. Use the sandbox or production IPs listed in Maya's webhook documentation at your network edge. The webhook and authenticated status check are idempotent; a checkout can activate only once.

## Deploy and test

```powershell
Set-Location functions
npm run build
firebase deploy --only functions:mayaCreateCheckout,functions:mayaVerifyCheckout,functions:mayaWebhook
```

Start with Maya sandbox credentials and a sandbox webhook. Switch `MAYA_API_URL` and credentials only after a successful end-to-end sandbox test.