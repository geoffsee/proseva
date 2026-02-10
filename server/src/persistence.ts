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

  constructor(filePath = resolve(import.meta.dir, "..", "data", "db.json")) {
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
