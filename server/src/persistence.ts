import { resolve } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

export interface PersistenceAdapter {
  load(): Promise<Record<string, Record<string, unknown>>>;
  save(data: Record<string, Record<string, unknown>>): Promise<void>;
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

/**
 * DuckDB adapter stores all collections as key-value pairs in a DuckDB table.
 * Each row stores the collection key and a JSON-serialized value blob.
 * The encryption layer remains unchanged and still wraps the full snapshot.
 */
export class DuckDbAdapter implements PersistenceAdapter {
  private dbPath: string;
  private connectionPromise: Promise<DuckDBConnection>;
  private writeQueue: Promise<void> = Promise.resolve();
  private attemptedLegacyMigration = false;

  constructor(
    dbPath = process.env.PROSEVA_DATA_DIR
      ? resolve(process.env.PROSEVA_DATA_DIR, "db.duckdb")
      : resolve(import.meta.dir, "..", "data", "db.duckdb"),
  ) {
    this.dbPath = dbPath;
    const dir = resolve(dbPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.connectionPromise = this.initConnection();
  }

  private async initConnection(): Promise<DuckDBConnection> {
    const instance = await DuckDBInstance.fromCache(this.dbPath);
    const connection = await instance.connect();
    await connection.run(`
      CREATE TABLE IF NOT EXISTS kv (
        key VARCHAR PRIMARY KEY,
        value VARCHAR NOT NULL
      )
    `);
    return connection;
  }

  private async getConnection(): Promise<DuckDBConnection> {
    return this.connectionPromise;
  }

  async load(): Promise<Record<string, Record<string, unknown>>> {
    await this.writeQueue;
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
