import { Database } from "bun:sqlite";
import type {
  DatabaseInstance,
  DatabaseConnection,
  DatabaseResult,
  DatabaseReader,
  DatabasePreparedStatement,
} from "./types";

class SqliteResult implements DatabaseResult {
  rowsChanged: number;
  constructor(rowsChanged: number) {
    this.rowsChanged = rowsChanged;
  }
}

class SqliteReader implements DatabaseReader {
  private rows: Record<string, unknown>[];
  constructor(rows: Record<string, unknown>[]) {
    this.rows = rows;
  }
  get currentRowCount(): number {
    return this.rows.length;
  }
  getRowObjectsJS(): Record<string, unknown>[] {
    return this.rows;
  }
}

class SqlitePreparedStatement implements DatabasePreparedStatement {
  private stmt: any;
  private params: any[] = [];

  constructor(stmt: any) {
    this.stmt = stmt;
  }

  bindVarchar(pos: number, value: string): void {
    this.params[pos - 1] = value;
  }

  bindBlob(pos: number, value: Uint8Array): void {
    this.params[pos - 1] = value;
  }

  async run(): Promise<DatabaseResult> {
    const info = this.stmt.run(...this.params);
    return new SqliteResult(info.changes);
  }

  async runAndReadAll(): Promise<DatabaseReader> {
    const rows = this.stmt.all(...this.params);
    return new SqliteReader(rows as Record<string, unknown>[]);
  }

  async close(): Promise<void> {
    this.stmt.finalize();
  }
}

class SqliteConnection implements DatabaseConnection {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  async run(sql: string, params?: unknown[]): Promise<DatabaseResult> {
    const normalizedSql = this.normalizeSql(sql);
    const info = this.db.prepare(normalizedSql).run(...(params || []) as any[]);
    return new SqliteResult(info.changes);
  }

  async runAndReadAll(sql: string, params?: unknown[]): Promise<DatabaseReader> {
    const normalizedSql = this.normalizeSql(sql);
    const rows = this.db.prepare(normalizedSql).all(...(params || []) as any[]);
    return new SqliteReader(rows as Record<string, unknown>[]);
  }

  async prepare(sql: string): Promise<DatabasePreparedStatement> {
    const normalizedSql = this.normalizeSql(sql);
    const stmt = this.db.prepare(normalizedSql);
    return new SqlitePreparedStatement(stmt);
  }

  async close(): Promise<void> {
    // Database close is handled by Instance
  }

  private normalizeSql(sql: string): string {
    // Convert $1, $2 positional params to SQLite ?1, ?2
    return sql.replace(/\$(\d+)/g, '?$1');
  }
}

export class SqliteDatabase implements DatabaseInstance {
  private db: Database;
  private constructor(db: Database) {
    this.db = db;
  }

  static async create(path: string, _options?: Record<string, string>): Promise<SqliteDatabase> {
    const db = new Database(path === ":memory:" ? ":memory:" : path, { create: true });
    return new SqliteDatabase(db);
  }

  async connect(): Promise<DatabaseConnection> {
    return new SqliteConnection(this.db);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
