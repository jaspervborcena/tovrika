import { LoggerService, LogContext } from '@app/core/services/logger.service';

export interface DbOperationContext extends Omit<LogContext, 'status' | 'success'> {
  api: 'firestore.add' | 'firestore.set' | 'firestore.update' | 'firestore.delete';
  collectionPath: string;
  docId?: string;
  area: string;
  message?: string;
}

/**
 * Wrap a Firestore-related Promise with structured logging (success/failed, 200/400, payload, api, path).
 */
export async function logFirestore<T>(
  logger: LoggerService,
  op: DbOperationContext,
  payload: unknown,
  action: () => Promise<T>
): Promise<T> {
  const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const correlationId = op.correlationId ?? cryptoRandomId();

  try {
    const result = await action();
    const end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const durationMs = Math.round(end - start);
    logger.dbSuccess(op.message ?? 'Firestore operation succeeded', {
      ...op,
      correlationId,
      durationMs,
      payload,
    });
    return result;
  } catch (err) {
    const end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const durationMs = Math.round(end - start);
    logger.dbFailure(op.message ?? 'Firestore operation failed', {
      ...op,
      correlationId,
      durationMs,
      payload,
    }, err);
    throw err;
  }
}

function cryptoRandomId(): string {
  try {
    // Browser crypto
    const b = new Uint8Array(8);
    (self.crypto || (window as any).crypto).getRandomValues(b);
    return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(16).slice(2, 10);
  }
}
