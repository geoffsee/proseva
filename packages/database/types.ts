/**
 * Unified database adapter interfaces.
 *
 * The SQLite adapter (`bun:sqlite`) implements these interfaces so that
 * the server persistence layer can work with a consistent async API.
 */

export interface DatabaseInstance {
  connect(): Promise<DatabaseConnection>;
  close(): Promise<void>;
}

export interface DatabaseConnection {
  run(sql: string, params?: unknown[]): Promise<DatabaseResult>;
  runAndReadAll(sql: string, params?: unknown[]): Promise<DatabaseReader>;
  prepare(sql: string): Promise<DatabasePreparedStatement>;
  close(): Promise<void>;
}

export interface DatabaseResult {
  rowsChanged: number;
}

export interface DatabaseReader {
  currentRowCount: number;
  getRowObjectsJS(): Record<string, unknown>[];
}

export interface DatabasePreparedStatement {
  bindVarchar(pos: number, value: string): void;
  bindBlob(pos: number, value: Uint8Array): void;
  run(): Promise<DatabaseResult>;
  runAndReadAll(): Promise<DatabaseReader>;
  close(): Promise<void>;
}

export interface DatabaseConstructor {
  create(
    path: string,
    options?: Record<string, string>,
  ): Promise<DatabaseInstance>;
}
