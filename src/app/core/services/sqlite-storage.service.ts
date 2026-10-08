import { Injectable } from '@angular/core';
import initSqlJs, { Database } from 'sql.js';

@Injectable({
  providedIn: 'root'
})
export class SqliteStorageService {
  private readonly databaseStorageKey = 'tovrika_sqlite_database';
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = (async () => {
        const SQL = await initSqlJs({
          locateFile: (file: string) => {
            if (file.startsWith('sql-wasm')) {
              return '/assets/sql-wasm.wasm';
            }
            return file;
          }
        });

        const savedDatabase = localStorage.getItem(this.databaseStorageKey);
        const binaryData = savedDatabase ? atob(savedDatabase) : '';
        const databaseBytes = savedDatabase
          ? Uint8Array.from(binaryData, character => character.charCodeAt(0))
          : undefined;
        this.db = new SQL.Database(databaseBytes ? Array.from(databaseBytes) : undefined);
        this.ensureSchema();
        this.migrateLegacyOfflineDocuments();
      })();
    }

    await this.initPromise;
  }

  isReady(): boolean {
    return !!this.db;
  }

  async saveSetting(key: string, value: any): Promise<void> {
    const db = await this.ensureDb();
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value ?? null)]);
    this.persistDatabase();
  }

  async getSetting(key: string): Promise<any> {
    const db = await this.ensureDb();
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    stmt.bind([key]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result && 'value' in result ? this.parseJson(String((result as Record<string, unknown>)['value'])) : null;
  }

  async saveUserData(userData: any): Promise<void> {
    const db = await this.ensureDb();
    db.run('INSERT OR REPLACE INTO users (uid, data) VALUES (?, ?)', [userData.uid, JSON.stringify(userData)]);
  }

  async getUserData(uid: string): Promise<any | null> {
    const db = await this.ensureDb();
    const stmt = db.prepare('SELECT data FROM users WHERE uid = ?');
    stmt.bind([uid]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result && 'data' in result ? this.parseJson(String((result as Record<string, unknown>)['data'])) : null;
  }

  async getCurrentUser(): Promise<any | null> {
    const db = await this.ensureDb();
    const users: any[] = [];
    const stmt = db.prepare('SELECT data FROM users');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const entry = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (entry) {
          users.push(entry);
        }
      }
    }
    stmt.free();
    return users.find((user: any) => user?.isLoggedIn === true) ?? null;
  }

  async clearAllUserData(): Promise<void> {
    const db = await this.ensureDb();
    db.run('DELETE FROM users');
  }

  async saveOfflineDocument(doc: any): Promise<void> {
    const db = await this.ensureDb();
    const createdAt = doc?.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString();
    db.run(
      'INSERT OR REPLACE INTO offline_documents (id, collectionName, data, uid, synced, createdAt, isOffline, operation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        doc.id,
        doc.collectionName,
        JSON.stringify(doc),
        doc.uid || 'unknown',
        doc.synced ? 1 : 0,
        createdAt,
        doc.isOffline ? 1 : 0,
        doc.operation || 'create'
      ]
    );
    this.persistDatabase();
  }

  async getOfflineDocumentsByCollection(collectionName: string): Promise<any[]> {
    const db = await this.ensureDb();
    const docs: any[] = [];
    const stmt = db.prepare('SELECT data FROM offline_documents WHERE collectionName = ? ORDER BY createdAt DESC');
    stmt.bind([collectionName]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const parsed = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (parsed) {
          docs.push(parsed);
        }
      }
    }
    stmt.free();
    return docs;
  }

  async getPendingDocuments(): Promise<any[]> {
    const db = await this.ensureDb();
    const docs: any[] = [];
    const stmt = db.prepare('SELECT data FROM offline_documents ORDER BY createdAt DESC');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const parsed = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (parsed) {
          docs.push(parsed);
        }
      }
    }
    stmt.free();
    return docs;
  }

  async deleteOfflineDocument(documentId: string, collectionName: string): Promise<void> {
    const db = await this.ensureDb();
    db.run('DELETE FROM offline_documents WHERE id = ? AND collectionName = ?', [documentId, collectionName]);
    this.persistDatabase();
  }

  async clearOfflineDocuments(): Promise<void> {
    const db = await this.ensureDb();
    db.run('DELETE FROM offline_documents');
    this.persistDatabase();
  }

  async saveProducts(products: any[]): Promise<void> {
    if (!products?.length) {
      return;
    }

    const db = await this.ensureDb();
    for (const product of products) {
      if (!product?.id) continue;
      db.run('INSERT OR REPLACE INTO products (id, data) VALUES (?, ?)', [product.id, JSON.stringify(product)]);
    }
  }

  async getProductsByStore(storeId: string): Promise<any[]> {
    const db = await this.ensureDb();
    const products: any[] = [];
    const stmt = db.prepare('SELECT data FROM products');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const product = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (product && product.storeId === storeId) {
          products.push(product);
        }
      }
    }
    stmt.free();
    return products;
  }

  async saveOrder(order: any): Promise<void> {
    const db = await this.ensureDb();
    db.run('INSERT OR REPLACE INTO orders (id, data) VALUES (?, ?)', [order.id, JSON.stringify(order)]);
  }

  async getPendingOrders(storeId: string): Promise<any[]> {
    const db = await this.ensureDb();
    const orders: any[] = [];
    const stmt = db.prepare('SELECT data FROM orders');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const order = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (order && order.storeId === storeId && order.synced !== true) {
          orders.push(order);
        }
      }
    }
    stmt.free();
    return orders;
  }

  async saveCompanies(companies: any[]): Promise<void> {
    if (!companies?.length) {
      return;
    }

    const db = await this.ensureDb();
    for (const company of companies) {
      db.run('INSERT OR REPLACE INTO companies (id, data) VALUES (?, ?)', [company.id, JSON.stringify(company)]);
    }
  }

  async getAllCompanies(): Promise<any[]> {
    const db = await this.ensureDb();
    const companies: any[] = [];
    const stmt = db.prepare('SELECT data FROM companies');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const company = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (company) {
          companies.push(company);
        }
      }
    }
    stmt.free();
    return companies;
  }

  async saveStores(stores: any[]): Promise<void> {
    if (!stores?.length) {
      return;
    }

    const db = await this.ensureDb();
    for (const store of stores) {
      db.run('INSERT OR REPLACE INTO stores (id, data) VALUES (?, ?)', [store.id, JSON.stringify(store)]);
    }
  }

  async getAllStores(): Promise<any[]> {
    const db = await this.ensureDb();
    const stores: any[] = [];
    const stmt = db.prepare('SELECT data FROM stores');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const store = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (store) {
          stores.push(store);
        }
      }
    }
    stmt.free();
    return stores;
  }

  async getStoreById(id: string): Promise<any | null> {
    const db = await this.ensureDb();
    const stmt = db.prepare('SELECT data FROM stores WHERE id = ?');
    stmt.bind([id]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result && 'data' in result ? this.parseJson(String((result as Record<string, unknown>)['data'])) : null;
  }

  async clearAllData(): Promise<void> {
    const db = await this.ensureDb();
    for (const table of ['users', 'products', 'orders', 'settings', 'companies', 'stores', 'offline_documents']) {
      db.run(`DELETE FROM ${table}`);
    }
    this.persistDatabase();
  }

  async clearAllDataPreserveOfflineAuth(): Promise<void> {
    const db = await this.ensureDb();
    const rows: Array<{ key: string; value: string }> = [];
    const stmt = db.prepare('SELECT key, value FROM settings');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'key' in row && 'value' in row) {
        rows.push({ key: String((row as Record<string, unknown>)['key']), value: String((row as Record<string, unknown>)['value']) });
      }
    }
    stmt.free();

    db.run('DELETE FROM users');
    db.run('DELETE FROM products');
    db.run('DELETE FROM orders');
    db.run('DELETE FROM companies');
    db.run('DELETE FROM stores');
    db.run('DELETE FROM settings');

    for (const row of rows) {
      if (String(row.key).startsWith('offlineAuth_')) {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [row.key, row.value]);
      }
    }
  }

  private ensureSchema(): void {
    if (!this.db) {
      return;
    }

    const schema = [
      'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, data TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS offline_documents (id TEXT NOT NULL, collectionName TEXT NOT NULL, data TEXT NOT NULL, uid TEXT, synced INTEGER NOT NULL DEFAULT 0, createdAt TEXT, isOffline INTEGER NOT NULL DEFAULT 0, operation TEXT, PRIMARY KEY(id, collectionName))'
    ];

    for (const statement of schema) {
      this.db.run(statement);
    }
  }

  private migrateLegacyOfflineDocuments(): void {
    const legacyQueue = localStorage.getItem('pendingDocuments');
    if (!legacyQueue || !this.db) {
      return;
    }

    try {
      const documents = JSON.parse(legacyQueue);
      if (!Array.isArray(documents)) {
        return;
      }

      for (const document of documents) {
        if (!document?.id || !document?.collectionName) {
          continue;
        }

        const parsedDate = document.createdAt ? new Date(document.createdAt) : new Date();
        const createdAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
        this.db.run(
          'INSERT OR REPLACE INTO offline_documents (id, collectionName, data, uid, synced, createdAt, isOffline, operation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            document.id,
            document.collectionName,
            JSON.stringify(document),
            document.uid || 'unknown',
            document.synced ? 1 : 0,
            createdAt,
            document.isOffline ? 1 : 0,
            document.operation || 'create'
          ]
        );
      }

      this.persistDatabase();
      localStorage.removeItem('pendingDocuments');
    } catch {
      // Keep the legacy queue intact if it cannot be migrated safely.
    }
  }

  private async ensureDb(): Promise<Database> {
    await this.init();

    if (!this.db) {
      throw new Error('SQLite storage is unavailable.');
    }

    return this.db;
  }

  private persistDatabase(): void {
    if (!this.db) {
      return;
    }

    const bytes = this.db.export();
    let binaryData = '';
    for (const byte of bytes) {
      binaryData += String.fromCharCode(byte);
    }
    localStorage.setItem(this.databaseStorageKey, btoa(binaryData));
  }

  private parseJson<T = any>(value: string | null): T | null {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
}
