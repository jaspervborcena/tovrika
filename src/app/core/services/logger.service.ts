import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

export interface LogContext {
  area?: string; // logical area/module, e.g., 'products', 'orders'
  api?: 'firestore.add' | 'firestore.set' | 'firestore.update' | 'firestore.delete' | string;
  collectionPath?: string;
  docId?: string;
  correlationId?: string;
  userId?: string;
  companyId?: string;
  storeId?: string;
  status?: 200 | 400 | 500; // include 500 per server contract
  success?: boolean;
  durationMs?: number;
  payload?: unknown; // sanitized before logging
  labels?: Record<string, string>;
}

export interface LogEntry extends LogContext {
  timestamp: string;
  level: LogLevel;
  severity: Severity;
  message: string;
  error?: { name?: string; message: string; code?: string; stack?: string };
}

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private minLevel: LogLevel = environment.production ? 'info' : 'debug';
  // Optional context provider registered by AuthService (or similar) to avoid circular DI.
  // Should return user-related context fields (userId/uid, companyId, storeId, etc).
  private contextProvider?: () => Partial<LogContext> | undefined;

  // NOTE: do not inject AuthService here to avoid circular DI. If you need
  // user context in logs, use LoggerService.setContext(...) pattern instead.

  constructor() {}

  /**
   * Register a callback that returns contextual log fields (userId, companyId, storeId).
   * This avoids injecting AuthService into LoggerService and prevents circular DI.
   */
  setContextProvider(provider: () => Partial<LogContext> | undefined) {
    this.contextProvider = provider;
  }

  debug(message: string, ctx: LogContext = {}) { /* disabled */ }
  info(message: string, ctx: LogContext = {})  { /* disabled */ }
  warn(message: string, ctx: LogContext = {})  { /* disabled */ }
  error(message: string, ctx: LogContext = {}, err?: unknown) { /* disabled */ }

  // Convenience helpers for DB ops
  dbSuccess(message: string, ctx: Omit<LogContext, 'status' | 'success'>) {
    /* disabled */
  }
  dbFailure(message: string, ctx: Omit<LogContext, 'status' | 'success'>, err?: unknown) {
    /* disabled */
  }

  private log(level: LogLevel, message: string, ctx: LogContext & { error?: any } = {}) {
    if (!this.shouldLog(level)) return;
    try {
      // Merge in optional context from registered provider (e.g., current user uid)
      let providedCtx: Partial<LogContext> = {};
      try {
        providedCtx = this.contextProvider ? (this.contextProvider() || {}) : {};
      } catch (e) {
        // Context provider must never block logging; swallow errors and continue
        providedCtx = {};
        try { console.warn('[LOGGER] contextProvider threw', e); } catch {}
      }

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        severity: this.asSeverity(level),
        message,
        ...providedCtx,
        ...ctx,
        payload: this.sanitize(ctx.payload),
      };

      // Console sink should not throw or block app logic
      try {
        this.consoleSink(entry);
      } catch (e) {
        try { console.error('[LOGGER] consoleSink failed', e); } catch {}
      }
    } catch (e) {
      // Guard: logging must never throw to application code. Swallow silently.
      try { console.error('[LOGGER] Unexpected logging failure', e); } catch {}
    }
  }

  private consoleSink(entry: LogEntry) {
    // Always enable console logging in this simplified version
    const { level, message, ...rest } = entry;
    const fn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : level === 'info' ? console.info
      : console.debug;

    try {
      fn('[APP]', message, rest);
    } catch (e) {
      try { console.error('[LOGGER] failed to write to console', e); } catch {}
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
    return order[level] >= order[this.minLevel];
  }

  private asSeverity(level: LogLevel): Severity {
    return level === 'debug' ? 'DEBUG'
      : level === 'info' ? 'INFO'
      : level === 'warn' ? 'WARNING'
      : 'ERROR';
  }

  private sanitize(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') return payload;
    const redactKeys = ['password', 'token', 'accessToken', 'refreshToken', 'email', 'phone'];
    try {
      const obj = JSON.parse(JSON.stringify(payload));
      if (Array.isArray(obj)) {
        return obj.map((item) => this.sanitize(item));
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = redactKeys.includes(k) ? '[REDACTED]' : v as unknown;
      }
      return out;
    } catch {
      return undefined;
    }
  }

  private normalizeError(err: unknown) {
    if (!err) return undefined;
    if (err instanceof Error) {
      const code = (err as any).code as string | undefined;
      return { name: err.name, message: err.message, code, stack: err.stack };
    }
    if (typeof err === 'string') return { message: err };
    try { return { message: JSON.stringify(err) }; } catch { return { message: String(err) }; }
  }
}
