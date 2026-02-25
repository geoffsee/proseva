import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { join } from "path";
import { relations } from "./schema";

const datasetsDir = process.env.DATASETS_DIR;
if (!datasetsDir) throw new Error("DATASETS_DIR environment variable is required");

const sqlite = new Database(join(datasetsDir, "virginia.db"), { readonly: true });
export const db = drizzle({ client: sqlite, relations });
