import { types, flow } from "mobx-state-tree";

const DocumentEntryModel = types.model("DocumentEntry", {
  id: types.identifier,
  filename: types.string,
  path: types.string,
  category: types.string,
  title: types.string,
  pageCount: types.number,
  textFile: types.string,
  dates: types.array(types.string),
  fileSize: types.number,
  caseId: types.optional(types.string, ""),
});

export const DocumentStore = types
  .model("DocumentStore", {
    documents: types.array(DocumentEntryModel),
  })
  .views((self) => ({
    get categorySummary(): Record<string, number> {
      const counts: Record<string, number> = {};
      for (const doc of self.documents) {
        counts[doc.category] = (counts[doc.category] || 0) + 1;
      }
      return counts;
    },
    get summary(): string {
      if (self.documents.length === 0)
        return "No documents are currently indexed.";
      const cats = {} as Record<string, number>;
      for (const doc of self.documents) {
        cats[doc.category] = (cats[doc.category] || 0) + 1;
      }
      const catList = Object.entries(cats)
        .map(([cat, count]) => `${cat} (${count})`)
        .join(", ");
      return `There are ${self.documents.length} indexed documents across these categories: ${catList}.\n\nDocument titles:\n${self.documents.map((d) => `- ${d.title}`).join("\n")}`;
    },
  }))
  .actions((self) => ({
    loadDocuments: flow(function* () {
      try {
        const res: Response = yield fetch("/index-documents.json");
        if (!res.ok) return;
        const data: unknown[] = yield res.json();
        self.documents.replace(data as any);
      } catch {
        // silently fail — documents are optional context
      }
    }),
  }));
