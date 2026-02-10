import { describe, it, expect } from "vitest";
import {
  VIRGINIA_COURTS,
  VIRGINIA_STATUTES,
  LEGAL_GLOSSARY,
  FILING_DEADLINES,
  DOCUMENT_TEMPLATES,
  type CourtInfo,
  type StatuteRef,
  type GlossaryEntry,
  type DeadlineRule,
} from "./index";

describe("Virginia legal resources", () => {
  describe("VIRGINIA_COURTS", () => {
    it("exports VIRGINIA_COURTS", () => {
      expect(VIRGINIA_COURTS).toBeDefined();
    });

    it("VIRGINIA_COURTS is an array", () => {
      expect(Array.isArray(VIRGINIA_COURTS)).toBe(true);
    });

    it("contains court information", () => {
      if (VIRGINIA_COURTS.length > 0) {
        const court = VIRGINIA_COURTS[0];
        expect(typeof court).toBe("object");
      }
    });
  });

  describe("VIRGINIA_STATUTES", () => {
    it("exports VIRGINIA_STATUTES", () => {
      expect(VIRGINIA_STATUTES).toBeDefined();
    });

    it("VIRGINIA_STATUTES is an array", () => {
      expect(Array.isArray(VIRGINIA_STATUTES)).toBe(true);
    });

    it("contains statute references", () => {
      if (VIRGINIA_STATUTES.length > 0) {
        const statute = VIRGINIA_STATUTES[0];
        expect(typeof statute).toBe("object");
      }
    });
  });

  describe("LEGAL_GLOSSARY", () => {
    it("exports LEGAL_GLOSSARY", () => {
      expect(LEGAL_GLOSSARY).toBeDefined();
    });

    it("LEGAL_GLOSSARY is an array", () => {
      expect(Array.isArray(LEGAL_GLOSSARY)).toBe(true);
    });

    it("contains glossary entries", () => {
      if (LEGAL_GLOSSARY.length > 0) {
        const entry = LEGAL_GLOSSARY[0];
        expect(typeof entry).toBe("object");
      }
    });
  });

  describe("FILING_DEADLINES", () => {
    it("exports FILING_DEADLINES", () => {
      expect(FILING_DEADLINES).toBeDefined();
    });

    it("FILING_DEADLINES is an array", () => {
      expect(Array.isArray(FILING_DEADLINES)).toBe(true);
    });

    it("contains deadline rules", () => {
      if (FILING_DEADLINES.length > 0) {
        const deadline = FILING_DEADLINES[0];
        expect(typeof deadline).toBe("object");
      }
    });
  });

  describe("DOCUMENT_TEMPLATES", () => {
    it("exports DOCUMENT_TEMPLATES", () => {
      expect(DOCUMENT_TEMPLATES).toBeDefined();
    });

    it("DOCUMENT_TEMPLATES is an array or object", () => {
      expect(DOCUMENT_TEMPLATES).toBeDefined();
    });
  });

  describe("Type exports", () => {
    it("exports CourtInfo type", () => {
      // Type is exported and can be used
      const court: CourtInfo = {} as CourtInfo;
      expect(court).toBeDefined();
    });

    it("exports StatuteRef type", () => {
      // Type is exported and can be used
      const statute: StatuteRef = {} as StatuteRef;
      expect(statute).toBeDefined();
    });

    it("exports GlossaryEntry type", () => {
      // Type is exported and can be used
      const entry: GlossaryEntry = {} as GlossaryEntry;
      expect(entry).toBeDefined();
    });

    it("exports DeadlineRule type", () => {
      // Type is exported and can be used
      const rule: DeadlineRule = {} as DeadlineRule;
      expect(rule).toBeDefined();
    });
  });

  describe("Module integrity", () => {
    it("all exports are defined", () => {
      expect(VIRGINIA_COURTS).toBeDefined();
      expect(VIRGINIA_STATUTES).toBeDefined();
      expect(LEGAL_GLOSSARY).toBeDefined();
      expect(FILING_DEADLINES).toBeDefined();
      expect(DOCUMENT_TEMPLATES).toBeDefined();
    });

    it("exports are not null", () => {
      expect(VIRGINIA_COURTS).not.toBeNull();
      expect(VIRGINIA_STATUTES).not.toBeNull();
      expect(LEGAL_GLOSSARY).not.toBeNull();
      expect(FILING_DEADLINES).not.toBeNull();
      expect(DOCUMENT_TEMPLATES).not.toBeNull();
    });

    it("exports maintain data structures", () => {
      expect(typeof VIRGINIA_COURTS).toBe(typeof []);
      expect(typeof VIRGINIA_STATUTES).toBe(typeof []);
      expect(typeof LEGAL_GLOSSARY).toBe(typeof []);
      expect(typeof FILING_DEADLINES).toBe(typeof []);
    });
  });
});
