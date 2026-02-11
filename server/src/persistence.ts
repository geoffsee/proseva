import { resolve } from "path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";

export interface PersistenceAdapter {
  load(): Record<string, Record<string, unknown>>;
  save(data: Record<string, Record<string, unknown>>): void;
}

export class InMemoryAdapter implements PersistenceAdapter {
  private data: Record<string, Record<string, unknown>> = {};

  load(): Record<string, Record<string, unknown>> {
    return structuredClone(this.data);
  }

  save(data: Record<string, Record<string, unknown>>): void {
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

  load(): Record<string, Record<string, unknown>> {
    if (!existsSync(this.filePath)) return {};
    const raw = readFileSync(this.filePath, "utf-8");
    return JSON.parse(raw);
  }

  save(data: Record<string, Record<string, unknown>>): void {
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

  override save(data: Record<string, Record<string, unknown>>): void {
    super.save(data);
    void this.mirrorToIndexedDb(data).catch(() => {
      // File persistence is the source of truth; ignore IndexedDB mirror errors.
    });
  }

  private async initIndexedDbRepo(): Promise<IndexedDbRepoLike | null> {
    if (typeof indexedDB === "undefined") return null;
    try {
      const { createIndexedDbKV } = await import(
        "../node_modules/idb-repo/dist/index-node.js"
      );
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
