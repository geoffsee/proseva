import { db, type ResearchCase, type ResearchAttachment } from "./db";
import { getBlobStore, BlobStore } from "./blob-store";

interface PersistenceManager {
  paralegal: {
    saveCase(userEmail: string, caseData: ResearchCase): Promise<void>;
    getCase(caseId: string): Promise<ResearchCase | null>;
    getCasesByUser(userEmail: string): Promise<ResearchCase[]>;
    getActiveCase(userEmail: string): Promise<ResearchCase | null>;
    setActiveCase(userEmail: string, caseId: string): Promise<void>;
    updateCase(caseId: string, updates: Partial<ResearchCase>): Promise<void>;
    deleteCase(userEmail: string, caseId: string): Promise<void>;
    addSavedSearch(caseId: string, search: unknown): Promise<void>;
    addSummary(caseId: string, summary: unknown): Promise<void>;
    addDocument(caseId: string, document: unknown): Promise<void>;
    addGeneratedDocument(caseId: string, doc: unknown): Promise<void>;
  };
  attachments: {
    saveForUser(
      userEmail: string,
      attachmentId: string,
      data: { data: number[]; type: string; name: string },
    ): Promise<void>;
    findByUser(
      userEmail: string,
      attachmentId: string,
    ): Promise<ResearchAttachment | null>;
  };
}

export function createPersistenceManager(): PersistenceManager {
  return {
    paralegal: {
      async saveCase(_userEmail: string, caseData: ResearchCase) {
        db.researchCases.set(caseData.id, caseData);
        db.persist();
      },

      async getCase(caseId: string) {
        return db.researchCases.get(caseId) ?? null;
      },

      async getCasesByUser(userEmail: string) {
        const results: ResearchCase[] = [];
        for (const c of db.researchCases.values()) {
          if (c.userEmail === userEmail) results.push(c);
        }
        return results;
      },

      async getActiveCase(userEmail: string) {
        for (const c of db.researchCases.values()) {
          if (c.userEmail === userEmail && c.isActive) return c;
        }
        return null;
      },

      async setActiveCase(userEmail: string, caseId: string) {
        for (const c of db.researchCases.values()) {
          if (c.userEmail === userEmail) {
            c.isActive = c.id === caseId;
          }
        }
        db.persist();
      },

      async updateCase(caseId: string, updates: Partial<ResearchCase>) {
        const existing = db.researchCases.get(caseId);
        if (!existing) return;
        Object.assign(existing, updates, { updatedAt: Date.now() });
        db.persist();
      },

      async deleteCase(_userEmail: string, caseId: string) {
        db.researchCases.delete(caseId);
        db.persist();
      },

      async addSavedSearch(caseId: string, search: unknown) {
        const c = db.researchCases.get(caseId);
        if (!c) return;
        c.savedSearches.push(search);
        c.updatedAt = Date.now();
        db.persist();
      },

      async addSummary(caseId: string, summary: unknown) {
        const c = db.researchCases.get(caseId);
        if (!c) return;
        c.summaries.push(summary);
        c.updatedAt = Date.now();
        db.persist();
      },

      async addDocument(caseId: string, document: unknown) {
        const c = db.researchCases.get(caseId);
        if (!c) return;
        c.documents.push(document);
        c.updatedAt = Date.now();
        db.persist();
      },

      async addGeneratedDocument(caseId: string, doc: unknown) {
        const c = db.researchCases.get(caseId);
        if (!c) return;
        if (!c.generatedDocuments) c.generatedDocuments = [];
        c.generatedDocuments.push(doc);
        c.updatedAt = Date.now();
        db.persist();
      },
    },

    attachments: {
      async saveForUser(
        userEmail: string,
        attachmentId: string,
        data: { data: number[]; type: string; name: string },
      ) {
        const blobStore = getBlobStore();
        const bytes = new Uint8Array(data.data);

        await blobStore.store(attachmentId, bytes);

        db.fileMetadata.set(attachmentId, {
          id: attachmentId,
          filename: data.name,
          mimeType: data.type,
          size: bytes.length,
          hash: BlobStore.computeHash(bytes),
          createdAt: new Date().toISOString(),
          ownerEmail: userEmail,
          sourceType: "research-attachment",
        });

        db.researchAttachments.set(attachmentId, {
          id: attachmentId,
          userEmail,
          data: [],
          type: data.type,
          name: data.name,
        });

        db.persist();
      },

      async findByUser(userEmail: string, attachmentId: string) {
        const meta = db.fileMetadata.get(attachmentId);
        if (meta && meta.ownerEmail === userEmail) {
          const blobStore = getBlobStore();
          const bytes = await blobStore.retrieve(attachmentId);
          if (bytes) {
            return {
              id: attachmentId,
              userEmail,
              data: Array.from(bytes),
              type: meta.mimeType,
              name: meta.filename,
            };
          }
        }

        const att = db.researchAttachments.get(attachmentId);
        if (!att || att.userEmail !== userEmail) return null;
        return att;
      },
    },
  };
}
