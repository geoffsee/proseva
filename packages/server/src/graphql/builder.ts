import SchemaBuilder from "@pothos/core";
import DrizzlePlugin from "@pothos/plugin-drizzle";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { db } from "../db/client";
import { relations } from "../db/schema";

export const builder = new SchemaBuilder<{
  DrizzleRelations: typeof relations;
}>({
  plugins: [DrizzlePlugin],
  drizzle: {
    client: db,
    getTableConfig,
    relations,
  },
});
