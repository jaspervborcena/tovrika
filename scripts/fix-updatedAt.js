#!/usr/bin/env node
/**
 * One-off migration script to fix `updatedAt` on ordersSellingTracking docs.
 *
 * It looks for documents where `updatedAt` is stored as a serverTimestamp sentinel
 * (represented as an object with `_methodName: 'serverTimestamp'`) and replaces it
 * with the document's concrete `createdAt` value. Works in dry-run mode and supports
 * optional `--orderId` and `--limit` parameters.
 *
 * Usage (PowerShell):
 *  $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccount.json'
 *  node .\scripts\fix-updatedAt.js --dryRun true --orderId nOjIpXSg1dQ4LendKEqj
 *
 * Notes:
 *  - Requires a Firebase service account or Application Default Credentials.
 *  - Dry-run prints what would be changed without writing.
 *  - For large datasets, run without `--limit` and the script will process all matching docs (careful).
 */

const admin = require('firebase-admin');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('serviceAccount', { type: 'string', describe: 'Path to service account JSON (optional). If omitted, ADC is used.' })
  .option('dryRun', { type: 'boolean', default: true, describe: 'If true, only log changes without committing.' })
  .option('limit', { type: 'number', default: 0, describe: 'Limit number of documents to inspect (0 = no limit).' })
  .option('orderId', { type: 'string', describe: 'If set, only fix docs for this orderId.' })
  .argv;

if (argv.serviceAccount) {
  console.log('Initializing admin with provided service account:', argv.serviceAccount);
  admin.initializeApp({ credential: admin.credential.cert(require(argv.serviceAccount)) });
} else {
  console.log('Initializing admin with Application Default Credentials');
  admin.initializeApp();
}

const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

async function isServerTimestampSentinel(value) {
  if (!value) return false;
  if (typeof value === 'object' && value._methodName && typeof value._methodName === 'string') {
    return value._methodName.toLowerCase().includes('servertimestamp');
  }
  return false;
}

function normalizeCreatedAt(createdAt) {
  if (!createdAt) return null;
  if (createdAt instanceof Timestamp) return createdAt;
  // In case it's a Firestore Timestamp-like object with toDate
  if (typeof createdAt.toDate === 'function') return Timestamp.fromDate(createdAt.toDate());
  // If it's ISO or number
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

async function run() {
  console.log('Dry-run:', argv.dryRun, 'limit:', argv.limit || 'none', 'orderId:', argv.orderId || 'none');

  let q = db.collection('ordersSellingTracking');
  if (argv.orderId) q = q.where('orderId', '==', argv.orderId);
  if (argv.limit && argv.limit > 0) q = q.limit(argv.limit);

  const snapshot = await q.get();
  console.log('Documents inspected:', snapshot.size);

  let total = 0;
  let candidates = 0;
  let fixed = 0;
  let skipped = 0;

  let batch = db.batch();
  let opsInBatch = 0;
  const BATCH_LIMIT = 400; // keep safe under 500

  for (const docSnap of snapshot.docs) {
    total++;
    const data = docSnap.data();
    const updatedAt = data.updatedAt;
    const createdAt = data.createdAt;

    const isSentinel = await isServerTimestampSentinel(updatedAt);
    if (!isSentinel) {
      skipped++;
      continue;
    }

    const createdTs = normalizeCreatedAt(createdAt);
    if (!createdTs) {
      console.warn('Skipping doc (no concrete createdAt):', docSnap.id);
      skipped++;
      continue;
    }

    candidates++;
    if (argv.dryRun) {
      console.log('[DRY] Would set updatedAt for', docSnap.id, '->', createdTs.toDate().toISOString());
      fixed++;
      continue;
    }

    batch.update(docSnap.ref, { updatedAt: createdTs });
    opsInBatch++;
    fixed++;

    if (opsInBatch >= BATCH_LIMIT) {
      console.log('Committing batch of', opsInBatch, 'ops...');
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (!argv.dryRun && opsInBatch > 0) {
    console.log('Committing final batch of', opsInBatch, 'ops...');
    await batch.commit();
  }

  console.log('Summary:', { total, candidates, fixed, skipped });
}

run().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});
