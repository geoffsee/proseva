import { resolve } from "node:path";
import { mkdirSync, existsSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  SqliteDatabase,
  type DatabaseInstance,
  type DatabaseConnection,
} from "@proseva/database";
import {
  getDatabaseEncryptionKeyProvider,
  type DatabaseEncryptionKeyProvider,
} from "./db-key-provider";
import { StorageEncryptionError } from "./persistence";

type BlobSession = {
  instance: DatabaseInstance;
  connection: DatabaseConnection;
  key: string | undefined;
};

/**
 * BlobStore stores binary data as BLOBs in a SQLite table.
 */
export class BlobStore {
  private dbPath: string;
  private keyProvider: DatabaseEncryptionKeyProvider;
  private session: BlobSession | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    dbPath?: string,
    keyProvider?: DatabaseEncryptionKeyProvider,
  ) {
    const defaultDbPath = process.env.PROSEVA_DATA_DIR
      ? resolve(process.env.PROSEVA_DATA_DIR, "files.sqlite")
      : resolve(process.cwd(), ".proseva-data", "files.sqlite");
    this.dbPath = dbPath ?? defaultDbPath;
    this.keyProvider = keyProvider ?? getDatabaseEncryptionKeyProvider();
    const dir = resolve(this.dbPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  private static toUint8Array(value: unknown): Uint8Array | null {
    if (value instanceof Uint8Array) {
      // Normalize Node.js Buffer into a plain Uint8Array.
      return new Uint8Array(value);
    }
    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
      const view = value as ArrayBufferView;
      const bytes = new Uint8Array(view.byteLength);
      bytes.set(
        new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
      );
      return bytes;
    }
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      (value as { type?: unknown }).type === "Buffer" &&
      "data" in value &&
      Array.isArray((value as { data?: unknown }).data)
    ) {
      return new Uint8Array((value as { data: number[] }).data);
    }
    return null;
  }

  private async openSession(
    encryptionKey: string | undefined,
  ): Promise<BlobSession> {
    const instance = await SqliteDatabase.create(this.dbPath);
    const connection = await instance.connect();
    try {
      await connection.run(`
        CREATE TABLE IF NOT EXISTS blobs (
          id VARCHAR PRIMARY KEY,
          data BLOB NOT NULL
        )
      `);
      return { instance, connection, key: encryptionKey };
    } catch (error) {
      try { await connection.close(); } catch {}
      try { await instance.close(); } catch {}
      throw error;
    }
  }

  private async closeSession(): Promise<void> {
    if (!this.session) return;
    try { await this.session.connection.close(); } catch {}
    try { await this.session.instance.close(); } catch {}
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
        "Files database is encrypted but no encryption key is configured.",
      );
    }
    if (message.includes("Wrong encryption key used")) {
      return new StorageEncryptionError(
        "invalid_key",
        "Configured encryption key cannot decrypt the files database.",
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

  private async getConnection(): Promise<DatabaseConnection> {
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
        await this.migratePlainToEncrypted(encryptionKey);
        this.session = await this.openSession(encryptionKey);
        return this.session.connection;
      }

      const storageError = this.toStorageEncryptionError(error, encryptionKey);
      if (storageError) throw storageError;
      throw error;
    }
  }

  async store(id: string, data: Uint8Array): Promise<void> {
    this.writeQueue = this.writeQueue
      .catch(() => {})
      .then(() => this.storeInternal(id, data));
    return this.writeQueue;
  }

  private async storeInternal(id: string, data: Uint8Array): Promise<void> {
    const connection = await this.getConnection();
    const stmt = await connection.prepare(
      "INSERT OR REPLACE INTO blobs (id, data) VALUES ($1, $2)",
    );
    stmt.bindVarchar(1, id);
    stmt.bindBlob(2, data);
    await stmt.run();
    await stmt.close();
  }

  async retrieve(id: string): Promise<Uint8Array | null> {
    const connection = await this.getConnection();
    const stmt = await connection.prepare(
      "SELECT data FROM blobs WHERE id = $1",
    );
    stmt.bindVarchar(1, id);
    const reader = await stmt.runAndReadAll();
    await stmt.close();

    if (reader.currentRowCount === 0) return null;

    const rows = reader.getRowObjectsJS() as Array<{ data?: unknown }>;
    return BlobStore.toUint8Array(rows[0]?.data);
  }

  async delete(id: string): Promise<boolean> {
    const connection = await this.getConnection();
    const stmt = await connection.prepare(
      "DELETE FROM blobs WHERE id = $1",
    );
    stmt.bindVarchar(1, id);
    const result = await stmt.run();
    await stmt.close();
    return result.rowsChanged > 0;
  }

  async has(id: string): Promise<boolean> {
    const connection = await this.getConnection();
    const stmt = await connection.prepare(
      "SELECT 1 FROM blobs WHERE id = $1",
    );
    stmt.bindVarchar(1, id);
    const reader = await stmt.runAndReadAll();
    await stmt.close();
    return reader.currentRowCount > 0;
  }

  private async migratePlainToEncrypted(_encryptionKey: string): Promise<void> {
    if (!existsSync(this.dbPath)) return;

    const instance = await SqliteDatabase.create(this.dbPath);
    const connection = await instance.connect();
    try {
      const existsReader = await connection.runAndReadAll(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='blobs'",
      );
      const existsRows = existsReader.getRowObjectsJS() as Array<{ count: number | bigint }>;
      if (Number(existsRows[0]?.count ?? 0) === 0) return;

      const reader = await connection.runAndReadAll("SELECT id, data FROM blobs");
      const rows = reader.getRowObjectsJS() as Array<{
        id: string;
        data?: unknown;
      }>;

      const tempEncPath = `${this.dbPath}.enc.tmp.${Date.now()}`;
      const encInstance = await SqliteDatabase.create(tempEncPath);
      const encConn = await encInstance.connect();
      try {
        await encConn.run(`
          CREATE TABLE IF NOT EXISTS blobs (
            id VARCHAR PRIMARY KEY,
            data BLOB NOT NULL
          )
        `);
        for (const row of rows) {
          const data = BlobStore.toUint8Array(row.data);
          if (!data) continue;
          const stmt = await encConn.prepare(
            "INSERT INTO blobs (id, data) VALUES ($1, $2)",
          );
          stmt.bindVarchar(1, row.id);
          stmt.bindBlob(2, data);
          await stmt.run();
          await stmt.close();
        }
      } finally {
        try { await encConn.close(); } catch {}
        try { await encInstance.close(); } catch {}
      }

      const backupPath = `${this.dbPath}.unencrypted.bak.${Date.now()}`;
      renameSync(this.dbPath, backupPath);
      renameSync(tempEncPath, this.dbPath);
    } finally {
      try { await connection.close(); } catch {}
      try { await instance.close(); } catch {}
    }
  }

  static computeHash(data: Uint8Array): string {
    return createHash("sha256").update(data).digest("hex");
  }
}

let blobStoreInstance: BlobStore | null = null;

export function getBlobStore(): BlobStore {
  if (!blobStoreInstance) {
    blobStoreInstance = new BlobStore();
  }
  return blobStoreInstance;
}

export function setBlobStore(store: BlobStore): void {
  blobStoreInstance = store;
}

export function resetBlobStore(): void {
  blobStoreInstance = null;
}

export async function migrateResearchAttachmentsToBlobStore(): Promise<{
  migrated: number;
  skipped: number;
}> {
  const { db } = await import("./db");
  const blobStore = getBlobStore();
  let migrated = 0;
  let skipped = 0;

  for (const [id, attachment] of db.researchAttachments) {
    if (!attachment.data || attachment.data.length === 0) {
      skipped++;
      continue;
    }

    if (await blobStore.has(id)) {
      skipped++;
      continue;
    }

    const bytes = new Uint8Array(attachment.data);
    await blobStore.store(id, bytes);

    db.fileMetadata.set(id, {
      id,
      filename: attachment.name,
      mimeType: attachment.type,
      size: bytes.length,
      hash: BlobStore.computeHash(bytes),
      createdAt: new Date().toISOString(),
      ownerEmail: attachment.userEmail,
      sourceType: "research-attachment",
    });

    attachment.data = [];
    migrated++;
  }

  if (migrated > 0) {
    db.persist();
  }

  return { migrated, skipped };
}
