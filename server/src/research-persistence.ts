import { db, type ResearchCase, type ResearchAttachment } from "./db";

interface PersistenceManager {
  paralegal: {
    saveCase(userEmail: string, caseData: ResearchCase): Promise<void>;
    getCase(caseId: string): Promise<ResearchCase | null>;
    getCasesByUser(userEmail: string): Promise<ResearchCase[]>;
    getActiveCase(userEmail: string): Promise<ResearchCase | null>;
    setActiveCase(userEmail: string, caseId: string): Promise<void>;
    updateCase(caseId: string, updates: Partial<ResearchCase>): Promise<void>;
    deleteCase(userEmail: string, caseId: string): Promise<void>;
    addSavedSearch(caseId: string, search: any): Promise<void>;
    addSummary(caseId: string, summary: any): Promise<void>;
    addDocument(caseId: string, document: any): Promise<void>;
    addGeneratedDocument(caseId: string, doc: any): Promise<void>;
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

export function createPersistenceManager(
  _kvStorage?: string,
): PersistenceManager {
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

      async addSavedSearch(caseId: string, search: any) {
        const c = db.researchCases.get(caseId);
        if (!c) return;
        c.savedSearches.push(search);
        c.updatedAt = Date.now();
        db.persist();
      },

      async addSummary(caseId: string, summary: any) {
        const c = db.researchCases.get(caseId);
        if (!c) return;
        c.summaries.push(summary);
        c.updatedAt = Date.now();
        db.persist();
      },

      async addDocument(caseId: string, document: any) {
        const c = db.researchCases.get(caseId);
        if (!c) return;
        c.documents.push(document);
        c.updatedAt = Date.now();
        db.persist();
      },

      async addGeneratedDocument(caseId: string, doc: any) {
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
        db.researchAttachments.set(attachmentId, {
          id: attachmentId,
          userEmail,
          ...data,
        });
        db.persist();
      },

      async findByUser(userEmail: string, attachmentId: string) {
        const att = db.researchAttachments.get(attachmentId);
        if (!att || att.userEmail !== userEmail) return null;
        return att;
      },
    },
  };
}
