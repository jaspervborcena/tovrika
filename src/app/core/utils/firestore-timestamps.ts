import { serverTimestamp } from 'firebase/firestore';

/**
 * Apply timestamps for newly created documents.
 * When online, use serverTimestamp() sentinel so Firestore assigns server time.
 * When offline (or for local storage), fall back to ISO string so the client can show sensible values.
 */
export function applyCreateTimestamps<T extends Record<string, any>>(data: T, online = true): T {
  const out = { ...(data || {}) } as T;
  if (online) {
    const ca = (out as any)['createdAt'];
    // If caller didn't provide createdAt, use serverTimestamp for both
    if (ca === undefined) {
      (out as any)['createdAt'] = serverTimestamp() as any;
      (out as any)['updatedAt'] = serverTimestamp() as any;
    } else {
      // If createdAt is a concrete value (Date / string / number), set updatedAt to the same value
      // so both timestamps match at creation time instead of leaving updatedAt as an unresolved sentinel.
      if (ca instanceof Date || typeof ca === 'string' || typeof ca === 'number') {
        (out as any)['updatedAt'] = ca;
      } else {
        // createdAt might already be a serverTimestamp sentinel or another non-concrete value
        // In that case, fallback to serverTimestamp for updatedAt
        (out as any)['updatedAt'] = serverTimestamp() as any;
      }
    }
  } else {
    const now = new Date().toISOString();
    if ((out as any)['createdAt'] === undefined) (out as any)['createdAt'] = now as any;
    (out as any)['updatedAt'] = now as any;
  }
  return out;
}

/**
 * Apply updatedAt timestamp for updates.
 */
export function applyUpdateTimestamp<T extends Record<string, any>>(updates: T, online = true): T {
  const out = { ...(updates || {}) } as T;
  if (online) {
    (out as any)['updatedAt'] = serverTimestamp() as any;
  } else {
    (out as any)['updatedAt'] = new Date().toISOString() as any;
  }
  return out;
}
