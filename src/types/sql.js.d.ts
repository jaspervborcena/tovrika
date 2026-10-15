declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    export(): Uint8Array;
    prepare(sql: string): {
      bind(params: any[]): void;
      step(): boolean;
      getAsObject(): Record<string, unknown> | null;
      free(): void;
    };
  }

  export type SqlJsFactory = (options?: any) => any;

  const initSqlJs: SqlJsFactory;
  export default initSqlJs;
}
