import { resolve } from "node:path";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import {
  getDatabaseEncryptionKeyProvider,
  type DatabaseEncryptionKeyProvider,
} from "./db-key-provider";

export interface PersistenceAdapter {
  load(): Promise<Record<string, Record<string, unknown>>>;
  save(data: Record<string, Record<string, unknown>>): Promise<void>;
}

export type StorageEncryptionFailureReason = "missing_key" | "invalid_key";

export class StorageEncryptionError extends Error {
  reason: StorageEncryptionFailureReason;

  constructor(reason: StorageEncryptionFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export class InMemoryAdapter implements PersistenceAdapter {
  private data: Record<string, Record<string, unknown>> = {};

  async load(): Promise<Record<string, Record<string, unknown>>> {
    return structuredClone(this.data);
  }

  async save(
    data: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    this.data = structuredClone(data);
  }
}

export class LocalFileAdapter implements PersistenceAdapter {
  private filePath: string;

  constructor(
    filePath = process.env.PROSEVA_DATA_DIR
      ? resolve(process.env.PROSEVA_DATA_DIR, "db.json")
      : resolve(import.meta.dir, "..", "data", "db.json"),
  ) {
    this.filePath = filePath;
    const dir = resolve(filePath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  async load(): Promise<Record<string, Record<string, unknown>>> {
    if (!existsSync(this.filePath)) return {};
    const raw = readFileSync(this.filePath, "utf-8");
    return JSON.parse(raw);
  }

  async save(data: Record<string, Record<string, unknown>>): Promise<void> {
    writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
}

type IndexedDbRepoLike = {
  put: (
    key: string,
    value: unknown,
    options?: { metadata?: Record<string, unknown> | null },
  ) => Promise<void>;
};

/**
 * Electron adapter that keeps file persistence behavior but mirrors writes to IndexedDB via idb-repo.
 * The file remains the source of truth for sync startup compatibility with the current DB interface.
 */
export class ElectronIdbRepoAdapter extends LocalFileAdapter {
  private kvPromise: Promise<IndexedDbRepoLike | null>;

  constructor(filePath?: string) {
    super(filePath);
    this.kvPromise = this.initIndexedDbRepo();
  }

  override async save(
    data: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    await super.save(data);
    await this.mirrorToIndexedDb(data).catch(() => {
      // File persistence is the source of truth; ignore IndexedDB mirror errors.
    });
  }

  private async initIndexedDbRepo(): Promise<IndexedDbRepoLike | null> {
    if (typeof indexedDB === "undefined") return null;
    try {
      const { createIndexedDbKV } = await import("idb-repo");
      return createIndexedDbKV({
        dbName: "proseva",
        storeName: "server-db",
        version: 1,
      });
    } catch {
      return null;
    }
  }

  private async mirrorToIndexedDb(
    data: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    const kv = await this.kvPromise;
    if (!kv) return;
    await kv.put("snapshot", data, {
      metadata: { source: "server-local-file" },
    });
  }
}

type DuckDbSession = {
  instance: DuckDBInstance;
  connection: DuckDBConnection;
  key: string | undefined;
};

/**
 * DuckDB adapter stores all collections as key-value rows in a DuckDB table.
 * Uses native DuckDB file encryption via ATTACH ... (ENCRYPTION_KEY ...).
 */
export class DuckDbAdapter implements PersistenceAdapter {
  private dbPath: string;
  private keyProvider: DatabaseEncryptionKeyProvider;
  private session: DuckDbSession | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private attemptedLegacyMigration = false;

  constructor(
    dbPath = process.env.PROSEVA_DATA_DIR
      ? resolve(process.env.PROSEVA_DATA_DIR, "db.duckdb")
      : resolve(import.meta.dir, "..", "data", "db.duckdb"),
    keyProvider: DatabaseEncryptionKeyProvider = getDatabaseEncryptionKeyProvider(),
  ) {
    this.dbPath = dbPath;
    this.keyProvider = keyProvider;
    const dir = resolve(dbPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  private static escapeSqlLiteral(value: string): string {
    return value.replaceAll("'", "''");
  }

  private async attachDatabase(
    connection: DuckDBConnection,
    filePath: string,
    encryptionKey: string | undefined,
  ): Promise<void> {
    const escapedPath = DuckDbAdapter.escapeSqlLiteral(filePath);
    if (encryptionKey) {
      const escapedKey = DuckDbAdapter.escapeSqlLiteral(encryptionKey);
      await connection.run(
        `ATTACH '${escapedPath}' AS proseva (ENCRYPTION_KEY '${escapedKey}')`,
      );
    } else {
      await connection.run(`ATTACH '${escapedPath}' AS proseva`);
    }
    await connection.run("USE proseva");
  }

  private async closeSession(): Promise<void> {
    if (!this.session) return;
    try {
      this.session.connection.closeSync();
    } catch {
      // Ignore close errors during adapter shutdown/reload.
    }
    try {
      this.session.instance.closeSync();
    } catch {
      // Ignore close errors during adapter shutdown/reload.
    }
    this.session = null;
  }

  private toStorageEncryptionError(
    error: unknown,
    activeKey: string | undefined,
  ): StorageEncryptionError | null {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Cannot open encrypted database") &&
      message.includes("without a key")
    ) {
      return new StorageEncryptionError(
        "missing_key",
        "Database is encrypted but no encryption key is configured.",
      );
    }
    if (message.includes("Wrong encryption key used")) {
      return new StorageEncryptionError(
        "invalid_key",
        "Configured encryption key cannot decrypt the database.",
      );
    }
    if (
      activeKey &&
      message.includes("A key is explicitly specified") &&
      message.includes("is not encrypted")
    ) {
      return null;
    }
    return null;
  }

  private async openSession(
    encryptionKey: string | undefined,
  ): Promise<DuckDbSession> {
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    try {
      await this.attachDatabase(connection, this.dbPath, encryptionKey);
      await connection.run(`
        CREATE TABLE IF NOT EXISTS kv (
          key VARCHAR PRIMARY KEY,
          value VARCHAR NOT NULL
        )
      `);
      return { instance, connection, key: encryptionKey };
    } catch (error) {
      try {
        connection.closeSync();
      } catch {}
      try {
        instance.closeSync();
      } catch {}
      throw error;
    }
  }

  private async readSnapshotFromDatabase(
    dbPath: string,
    encryptionKey: string | undefined,
  ): Promise<Record<string, Record<string, unknown>>> {
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    try {
      await this.attachDatabase(connection, dbPath, encryptionKey);
      const existsReader = await connection.runAndReadAll(
        "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_name = 'kv'",
      );
      const existsRows = existsReader.getRowObjectsJS() as Array<{
        count: number | bigint;
      }>;
      const count = Number(existsRows[0]?.count ?? 0);
      if (count === 0) return {};

      const reader = await connection.runAndReadAll("SELECT key, value FROM kv");
      const rows = reader.getRowObjectsJS() as Array<{ key: string; value: string }>;
      const snapshot: Record<string, Record<string, unknown>> = {};
      for (const row of rows) {
        if (typeof row.key !== "string" || typeof row.value !== "string") continue;
        try {
          const parsed = JSON.parse(row.value) as unknown;
          if (isRecord(parsed)) snapshot[row.key] = parsed;
        } catch {
          // Skip malformed rows.
        }
      }
      return snapshot;
    } finally {
      try {
        connection.closeSync();
      } catch {}
      try {
        instance.closeSync();
      } catch {}
    }
  }

  private async writeSnapshotToDatabase(
    dbPath: string,
    encryptionKey: string | undefined,
    data: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    try {
      await this.attachDatabase(connection, dbPath, encryptionKey);
      await connection.run(`
        CREATE TABLE IF NOT EXISTS kv (
          key VARCHAR PRIMARY KEY,
          value VARCHAR NOT NULL
        )
      `);
      await connection.run("BEGIN TRANSACTION");
      try {
        await connection.run("DELETE FROM kv");
        for (const [key, value] of Object.entries(data)) {
          await connection.run(
            "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
            [key, JSON.stringify(value)],
          );
        }
        await connection.run("COMMIT");
      } catch (error) {
        await connection.run("ROLLBACK").catch(() => {
          // Ignore rollback failures and rethrow original error.
        });
        throw error;
      }
    } finally {
      try {
        connection.closeSync();
      } catch {}
      try {
        instance.closeSync();
      } catch {}
    }
  }

  private async migratePlainDuckDbToEncrypted(encryptionKey: string): Promise<void> {
    if (!existsSync(this.dbPath)) return;
    const snapshot = await this.readSnapshotFromDatabase(this.dbPath, undefined);
    const tempEncryptedPath = `${this.dbPath}.enc.tmp.${Date.now()}`;
    const backupPath = `${this.dbPath}.unencrypted.bak.${Date.now()}`;
    await this.writeSnapshotToDatabase(tempEncryptedPath, encryptionKey, snapshot);
    renameSync(this.dbPath, backupPath);
    renameSync(tempEncryptedPath, this.dbPath);
  }

  private async getConnection(): Promise<DuckDBConnection> {
    const encryptionKey = this.keyProvider.getEncryptionKey();
    if (this.session && this.session.key === encryptionKey) {
      return this.session.connection;
    }

    await this.closeSession();
    try {
      this.session = await this.openSession(encryptionKey);
      return this.session.connection;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        encryptionKey &&
        message.includes("A key is explicitly specified") &&
        message.includes("is not encrypted")
      ) {
        await this.migratePlainDuckDbToEncrypted(encryptionKey);
        this.session = await this.openSession(encryptionKey);
        return this.session.connection;
      }

      const storageError = this.toStorageEncryptionError(error, encryptionKey);
      if (storageError) throw storageError;
      throw error;
    }
  }

  async load(): Promise<Record<string, Record<string, unknown>>> {
    await this.writeQueue.catch(() => {
      // If a prior write failed, still attempt to read the last durable state.
    });
    const connection = await this.getConnection();
    const reader = await connection.runAndReadAll("SELECT key, value FROM kv");
    const rows = reader.getRowObjectsJS() as Array<{
      key: string;
      value: string;
    }>;
    const snapshot: Record<string, Record<string, unknown>> = {};

    for (const row of rows) {
      if (typeof row.key !== "string" || typeof row.value !== "string") continue;
      try {
        const parsed = JSON.parse(row.value) as unknown;
        if (isRecord(parsed)) snapshot[row.key] = parsed;
      } catch {
        // Skip malformed values and continue loading what we can.
      }
    }

    if (rows.length > 0 || this.attemptedLegacyMigration) {
      return snapshot;
    }

    this.attemptedLegacyMigration = true;
    const migrated = await this.migrateFromJson();
    return Object.keys(migrated).length > 0 ? migrated : snapshot;
  }

  async save(data: Record<string, Record<string, unknown>>): Promise<void> {
    const snapshot = structuredClone(data);
    this.writeQueue = this.writeQueue
      .catch(() => {
        // Keep the queue alive after a failed write so subsequent saves still run.
      })
      .then(() => this.saveInternal(snapshot));
    return this.writeQueue;
  }

  private async saveInternal(
    data: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    const connection = await this.getConnection();
    await connection.run("BEGIN TRANSACTION");
    try {
      await connection.run("DELETE FROM kv");
      for (const [key, value] of Object.entries(data)) {
        await connection.run("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", [
          key,
          JSON.stringify(value),
        ]);
      }
      await connection.run("COMMIT");
    } catch (error) {
      await connection.run("ROLLBACK").catch(() => {
        // Ignore rollback failures and rethrow the original error.
      });
      throw error;
    }
  }

  private async migrateFromJson(): Promise<Record<string, Record<string, unknown>>> {
    const jsonPath = resolve(this.dbPath, "..", "db.json");
    if (!existsSync(jsonPath)) return {};

    try {
      const raw = readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isSnapshot(parsed)) return {};
      await this.save(parsed);
      return parsed;
    } catch {
      return {};
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSnapshot(
  value: unknown,
): value is Record<string, Record<string, unknown>> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isRecord(entry));
}
