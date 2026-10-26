import { Injectable } from '@angular/core';
import initSqlJs, { Database } from 'sql.js';
import type { User } from '../../services/auth.service';
import type { Company } from '../../interfaces/company.interface';
import type { Store } from '../../interfaces/store.interface';

export interface UserPermission {
  companyId: string;
  roleId: string;
  storeId?: string;
  status?: 'active' | 'inactive';
}

export interface OfflineUserData extends User {
  isLoggedIn: boolean;
  isAgreedToPolicy: boolean;
  currentStoreId?: string;
  permissions: UserPermission[];
  lastSync: Date;
}

export interface OfflineProduct {
  id: string;
  uid: string;
  productName: string;
  description?: string;
  skuId: string;
  productCode?: string;
  unitType: string;
  category: string;
  totalStock: number;
  costPrice?: number;
  originalPrice: number;
  sellingPrice: number;
  isStockTracked?: boolean;
  companyId: string;
  storeId: string;
  barcodeId?: string;
  imageUrl?: string;
  tags?: string[];
  tagLabels?: string[];
  isFavorite?: boolean;
  isVatApplicable: boolean;
  vatRate?: number;
  hasDiscount: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastUpdated: Date;
}

export interface OfflineOrder {
  id: string;
  items: Array<{ productId: string; name: string; price: number; quantity: number }>;
  total: number;
  timestamp: Date;
  storeId: string;
  synced: boolean;
}

export interface OfflineCompany extends Omit<Company, 'stores'> {
  lastSync?: Date;
}

export interface OfflineStore extends Store {
  lastSync?: Date;
}

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

  async initDB(): Promise<void> {
    await this.init();
  }

  isReady(): boolean {
    return !!this.db;
  }

  isAvailable(): boolean {
    return this.isReady();
  }

  getStatus(): { available: boolean; reason?: string } {
    const available = this.isReady();
    return { available, reason: available ? undefined : 'SQLite storage not initialized' };
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

  async saveLastSync(key: string, isoTimestamp: string): Promise<void> {
    await this.saveSetting(key, isoTimestamp);
  }

  async getLastSync(key: string): Promise<string | null> {
    const value = await this.getSetting(key);
    return value ? String(value) : null;
  }

  async saveUserData(userData: any): Promise<void> {
    const db = await this.ensureDb();
    await this.setAllUsersInactive();
    const activeUserData = { ...userData, isLoggedIn: true };
    db.run('INSERT OR REPLACE INTO users (uid, data) VALUES (?, ?)', [activeUserData.uid, JSON.stringify(activeUserData)]);
    this.persistDatabase();
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

  async getAllUsers(): Promise<any[]> {
    const db = await this.ensureDb();
    const users: any[] = [];
    const stmt = db.prepare('SELECT data FROM users');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const user = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (user) users.push(user);
      }
    }
    stmt.free();
    return users;
  }

  async setAllUsersInactive(): Promise<void> {
    const db = await this.ensureDb();
    for (const user of await this.getAllUsers()) {
      db.run('UPDATE users SET data = ? WHERE uid = ?', [JSON.stringify({ ...user, isLoggedIn: false }), user.uid]);
    }
    this.persistDatabase();
  }

  async setActiveUser(uid: string): Promise<void> {
    const db = await this.ensureDb();
    for (const user of await this.getAllUsers()) {
      db.run('UPDATE users SET data = ? WHERE uid = ?', [JSON.stringify({ ...user, isLoggedIn: user.uid === uid }), user.uid]);
    }
    this.persistDatabase();
  }

  async saveUserDataAsOnlyUser(userData: OfflineUserData): Promise<void> {
    const db = await this.ensureDb();
    db.run('DELETE FROM users');
    const activeUserData = { ...userData, isLoggedIn: true };
    db.run('INSERT OR REPLACE INTO users (uid, data) VALUES (?, ?)', [activeUserData.uid, JSON.stringify(activeUserData)]);
    this.persistDatabase();
  }

  async clearAllUserData(): Promise<void> {
    const db = await this.ensureDb();
    db.run('DELETE FROM users');
    this.persistDatabase();
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
    this.persistDatabase();
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

  async updateProduct(productId: string, updates: Partial<OfflineProduct>): Promise<void> {
    const db = await this.ensureDb();
    const stmt = db.prepare('SELECT data FROM products WHERE id = ?');
    stmt.bind([productId]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!row || !('data' in row)) return;
    const product = this.parseJson<Record<string, any>>(String((row as Record<string, unknown>)['data']));
    if (!product) return;
    db.run('UPDATE products SET data = ? WHERE id = ?', [JSON.stringify({ ...product, ...updates }), productId]);
    this.persistDatabase();
  }

  async saveNotification(notification: any): Promise<void> {
    const db = await this.ensureDb();
    db.run('INSERT OR REPLACE INTO notifications (id, storeId, data) VALUES (?, ?, ?)', [notification.id, notification.storeId || '', JSON.stringify(notification)]);
    this.persistDatabase();
  }

  async getUnreadNotificationsCount(storeId?: string): Promise<number> {
    return (await this.getNotifications(storeId)).filter(notification => notification.read === false).length;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const db = await this.ensureDb();
    const stmt = db.prepare('SELECT data FROM notifications WHERE id = ?');
    stmt.bind([notificationId]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!row || !('data' in row)) return;
    const notification = this.parseJson<Record<string, any>>(String((row as Record<string, unknown>)['data']));
    if (!notification) return;
    const updated = { ...notification, read: true, readAt: new Date() };
    db.run('UPDATE notifications SET data = ? WHERE id = ?', [JSON.stringify(updated), notificationId]);
    this.persistDatabase();
  }

  async getNotificationsByStore(storeId: string): Promise<any[]> {
    return this.getNotifications(storeId);
  }

  private async getNotifications(storeId?: string): Promise<any[]> {
    const db = await this.ensureDb();
    const notifications: any[] = [];
    const stmt = storeId
      ? db.prepare('SELECT data FROM notifications WHERE storeId = ?')
      : db.prepare('SELECT data FROM notifications');
    if (storeId) stmt.bind([storeId]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const notification = this.parseJson(String((row as Record<string, unknown>)['data']));
        if (notification) notifications.push(notification);
      }
    }
    stmt.free();
    return notifications;
  }

  async saveOrder(order: any): Promise<void> {
    const db = await this.ensureDb();
    db.run('INSERT OR REPLACE INTO orders (id, data) VALUES (?, ?)', [order.id, JSON.stringify(order)]);
    this.persistDatabase();
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
    this.persistDatabase();
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
      const storedStore = { ...store, lastSync: new Date() };
      db.run('INSERT OR REPLACE INTO stores (id, data) VALUES (?, ?)', [store.id, JSON.stringify(storedStore)]);
    }
    this.persistDatabase();
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

  async getStoresByCompanyId(companyId: string): Promise<any[]> {
    return (await this.getAllStores()).filter(store => store.companyId === companyId);
  }

  async normalizeExistingCompanies(): Promise<number> {
    const db = await this.ensureDb();
    const companies = await this.getAllCompanies();
    for (const company of companies) {
      const name = (company as any).name || (company as any).companyName || company.id;
      const normalized = {
        ...company,
        name,
        slug: (company as any).slug || String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        ownerUid: (company as any).ownerUid || (company as any).owner || '',
        createdAt: this.normalizeDate((company as any).createdAt) || new Date(),
        updatedAt: this.normalizeDate((company as any).updatedAt) || new Date(),
        lastSync: new Date()
      };
      db.run('UPDATE companies SET data = ? WHERE id = ?', [JSON.stringify(normalized), company.id]);
    }
    if (companies.length) this.persistDatabase();
    return companies.length;
  }

  async exportAllCompanies(): Promise<any[]> {
    return (await this.getAllCompanies()).map(company => JSON.parse(JSON.stringify(company)));
  }

  async getDatabaseSize(): Promise<number> {
    const db = await this.ensureDb();
    return db.export().byteLength;
  }

  async saveProductInventoryBatches(batches: any[]): Promise<void> {
    const db = await this.ensureDb();
    for (const batch of batches) {
      db.run('INSERT OR REPLACE INTO product_inventory (id, productId, storeId, companyId, data) VALUES (?, ?, ?, ?, ?)', [batch.id, batch.productId, batch.storeId, batch.companyId, JSON.stringify(batch)]);
    }
    if (batches.length) this.persistDatabase();
  }

  async getProductInventoryBatches(productId: string, storeId: string, companyId: string): Promise<any[]> {
    const db = await this.ensureDb();
    const batches: any[] = [];
    const stmt = db.prepare('SELECT data FROM product_inventory WHERE productId = ? AND storeId = ? AND companyId = ?');
    stmt.bind([productId, storeId, companyId]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row && 'data' in row) {
        const batch = this.parseJson<any>(String((row as Record<string, unknown>)['data']));
        if (batch && batch.status === 'active' && batch.quantity > 0) batches.push(batch);
      }
    }
    stmt.free();
    return batches.sort((a, b) => this.toTimestamp(a.createdAt) - this.toTimestamp(b.createdAt));
  }

  async updateProductInventoryBatch(batchId: string, updates: Record<string, unknown>): Promise<void> {
    const db = await this.ensureDb();
    const stmt = db.prepare('SELECT data FROM product_inventory WHERE id = ?');
    stmt.bind([batchId]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (!row || !('data' in row)) return;
    const batch = this.parseJson<Record<string, any>>(String((row as Record<string, unknown>)['data']));
    if (!batch) return;
    const updated = { ...batch, ...updates };
    db.run('UPDATE product_inventory SET productId = ?, storeId = ?, companyId = ?, data = ? WHERE id = ?', [updated['productId'], updated['storeId'], updated['companyId'], JSON.stringify(updated), batchId]);
    this.persistDatabase();
  }

  async clearProductInventory(): Promise<void> {
    const db = await this.ensureDb();
    db.run('DELETE FROM product_inventory');
    this.persistDatabase();
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
    for (const table of ['users', 'products', 'orders', 'settings', 'companies', 'stores', 'notifications', 'product_inventory', 'offline_documents']) {
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
    this.persistDatabase();
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
      'CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, storeId TEXT NOT NULL, data TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS product_inventory (id TEXT PRIMARY KEY, productId TEXT NOT NULL, storeId TEXT NOT NULL, companyId TEXT NOT NULL, data TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS offline_documents (id TEXT NOT NULL, collectionName TEXT NOT NULL, data TEXT NOT NULL, uid TEXT, synced INTEGER NOT NULL DEFAULT 0, createdAt TEXT, isOffline INTEGER NOT NULL DEFAULT 0, operation TEXT, PRIMARY KEY(id, collectionName))'
    ];

    for (const statement of schema) {
      this.db.run(statement);
    }
  }

  private normalizeDate(value: any): Date | undefined {
    if (!value && value !== 0) return undefined;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'object' && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000));
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private toTimestamp(value: any): number {
    const date = this.normalizeDate(value);
    return date?.getTime() ?? 0;
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
