import { sqliteTable, index, integer, text } from "drizzle-orm/sqlite-core";
import { defineRelations } from "drizzle-orm";

export const courts = sqliteTable(
  "courts",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    locality: text(),
    type: text(),
    district: text(),
    clerk: text(),
    phone: text(),
    fax: text(),
    email: text(),
    address: text(),
    city: text(),
    state: text(),
    zip: text(),
    hours: text(),
    homepage: text(),
    judges: text(),
  },
  (table) => [index("idx_courts_name").on(table.name)],
);

export const constitution = sqliteTable("constitution", {
  id: integer().primaryKey({ autoIncrement: true }),
  articleId: integer("article_id"),
  article: text(),
  articleName: text("article_name"),
  sectionName: text("section_name"),
  sectionTitle: text("section_title"),
  sectionText: text("section_text"),
  sectionCount: integer("section_count"),
  lastUpdate: text("last_update"),
});

export const virginiaCode = sqliteTable(
  "virginia_code",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    titleNum: text("title_num"),
    titleName: text("title_name"),
    subtitleNum: text("subtitle_num"),
    subtitleName: text("subtitle_name"),
    partNum: text("part_num"),
    partName: text("part_name"),
    chapterNum: text("chapter_num"),
    chapterName: text("chapter_name"),
    articleNum: text("article_num"),
    articleName: text("article_name"),
    subpartNum: text("subpart_num"),
    subpartName: text("subpart_name"),
    section: text(),
    title: text(),
    body: text(),
  },
  (table) => [index("idx_virginia_code_section").on(table.section)],
);

export const popularNames = sqliteTable("popular_names", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text(),
  titleNum: text("title_num"),
  section: text(),
  body: text(),
});

export const authorities = sqliteTable("authorities", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text(),
  shortName: text("short_name"),
  codified: text(),
  title: text(),
  section: text(),
  body: text(),
});

export const documents = sqliteTable(
  "documents",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    dataset: text(),
    filename: text(),
    title: text(),
    content: text(),
  },
  (table) => [index("idx_documents_dataset").on(table.dataset)],
);

export const relations = defineRelations(
  { courts, constitution, virginiaCode, popularNames, authorities, documents },
  () => ({}),
);
