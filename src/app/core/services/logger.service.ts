import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  private remoteEndpoint = (environment as any).cloudLoggingEndpoint as string | undefined;
  private apiKey = (environment as any).cloudLoggingApiKey as string | undefined;

  constructor(private http: HttpClient) {}

  debug(message: string, ctx: LogContext = {}) { this.log('debug', message, ctx); }
  info(message: string, ctx: LogContext = {})  { this.log('info', message, ctx); }
  warn(message: string, ctx: LogContext = {})  { this.log('warn', message, ctx); }
  error(message: string, ctx: LogContext = {}, err?: unknown) {
    const errorObj = this.normalizeError(err);
    this.log('error', message, { ...ctx, ...(errorObj ? { error: errorObj } : {}) } as any);
  }

  // Convenience helpers for DB ops
  dbSuccess(message: string, ctx: Omit<LogContext, 'status' | 'success'>) {
    this.info(message, { ...ctx, success: true, status: 200 });
  }
  dbFailure(message: string, ctx: Omit<LogContext, 'status' | 'success'>, err?: unknown) {
    this.error(message, { ...ctx, success: false, status: 400 }, err);
  }

  private log(level: LogLevel, message: string, ctx: LogContext & { error?: any } = {}) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      severity: this.asSeverity(level),
      message,
      ...ctx,
      payload: this.sanitize(ctx.payload),
    };

    this.consoleSink(entry);

    if (this.remoteEndpoint) {
      const headers: HttpHeaders = new HttpHeaders({ 'Content-Type': 'application/json' })
        .set('X-API-Key', this.apiKey || '');
      this.http.post(this.remoteEndpoint, entry, { headers }).subscribe({ next: () => {}, error: () => {} });
    }
  }

  private consoleSink(entry: LogEntry) {
    const { level, message, ...rest } = entry;
    const fn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : level === 'info' ? console.info
      : console.debug;

    fn('[APP]', message, rest);
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
