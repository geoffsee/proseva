import { describe, it, expect, vi } from "vitest";
import {
  validateEvidenceForm,
  parseTags,
  formatTags,
  loadEvidenceForm,
  handleEvidenceAdd,
  handleEvidenceEdit,
  handleEvidenceSave,
  handleEvidenceDialogClose,
  INITIAL_FORM,
  type EvidenceFormData,
} from "./handlers";
import type { Evidence } from "../../types";

describe("Evidence Handlers", () => {
  describe("validateEvidenceForm", () => {
    it("returns false when title is empty", () => {
      const form: EvidenceFormData = { ...INITIAL_FORM, title: "" };
      expect(validateEvidenceForm(form)).toBe(false);
    });

    it("returns false when title is only whitespace", () => {
      const form: EvidenceFormData = { ...INITIAL_FORM, title: "   " };
      expect(validateEvidenceForm(form)).toBe(false);
    });

    it("returns true when title has content", () => {
      const form: EvidenceFormData = {
        ...INITIAL_FORM,
        title: "Medical Records",
      };
      expect(validateEvidenceForm(form)).toBe(true);
    });
  });

  describe("parseTags", () => {
    it("parses comma-separated tags", () => {
      const result = parseTags("tag1, tag2, tag3");
      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("trims whitespace from tags", () => {
      const result = parseTags("  tag1  ,  tag2  ,  tag3  ");
      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("filters out empty tags", () => {
      const result = parseTags("tag1,,tag2, , tag3");
      expect(result).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("handles empty string", () => {
      const result = parseTags("");
      expect(result).toEqual([]);
    });
  });

  describe("formatTags", () => {
    it("formats tags array to comma-separated string", () => {
      const result = formatTags(["tag1", "tag2", "tag3"]);
      expect(result).toBe("tag1, tag2, tag3");
    });

    it("handles empty array", () => {
      const result = formatTags([]);
      expect(result).toBe("");
    });

    it("handles single tag", () => {
      const result = formatTags(["tag1"]);
      expect(result).toBe("tag1");
    });
  });

  describe("loadEvidenceForm", () => {
    it("loads all evidence data into form", () => {
      const evidence: Evidence = {
        id: "1",
        title: "Medical Records",
        exhibitNumber: "A",
        description: "Hospital records",
        type: "document" as const,
        fileUrl: "https://example.com/doc.pdf",
        dateCollected: "2024-01-15",
        location: "Hospital",
        tags: ["medical", "injury"],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        relevance: "high" as const,
        admissible: true,
        notes: "Key evidence",
        caseId: "case-1",
        chain: [],
      };

      const form = loadEvidenceForm(evidence);

      expect(form.title).toBe("Medical Records");
      expect(form.exhibitNumber).toBe("A");
      expect(form.description).toBe("Hospital records");
      expect(form.tags).toBe("medical, injury");
      expect(form.relevance).toBe("high");
      expect(form.admissible).toBe(true);
    });

    it("handles missing optional fields", () => {
      const evidence: Evidence = {
        id: "1",
        title: "Evidence",
        type: "other" as const,
        tags: [],
        relevance: "medium" as const,
        chain: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const form = loadEvidenceForm(evidence);

      expect(form.exhibitNumber).toBe("");
      expect(form.description).toBe("");
      expect(form.fileUrl).toBe("");
      expect(form.notes).toBe("");
      expect(form.caseId).toBe("");
    });
  });

  describe("handleEvidenceAdd", () => {
    it("calls onAdd with parsed tags when form is valid", () => {
      const form: EvidenceFormData = {
        ...INITIAL_FORM,
        title: "New Evidence",
        tags: "tag1, tag2",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleEvidenceAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).toHaveBeenCalled();
      const callArg = onAdd.mock.calls[0][0];
      expect(callArg.tags).toEqual(["tag1", "tag2"]);
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onAdd when title is empty", () => {
      const form: EvidenceFormData = { ...INITIAL_FORM, title: "" };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleEvidenceAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
      expect(onDialogClose).not.toHaveBeenCalled();
    });
  });

  describe("handleEvidenceEdit", () => {
    it("loads evidence data and opens dialog", () => {
      const evidence: Evidence = {
        id: "1",
        title: "Existing Evidence",
        type: "document" as const,
        tags: ["tag1"],
        relevance: "high" as const,
        chain: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const onFormLoad = vi.fn();
      const onDialogOpen = vi.fn();

      handleEvidenceEdit(evidence, onFormLoad, onDialogOpen);

      expect(onFormLoad).toHaveBeenCalled();
      const formArg = onFormLoad.mock.calls[0][0];
      expect(formArg.title).toBe("Existing Evidence");
      expect(onDialogOpen).toHaveBeenCalled();
    });
  });

  describe("handleEvidenceSave", () => {
    it("calls onUpdate when editing existing evidence", () => {
      const evidence: Evidence = {
        id: "1",
        title: "Evidence",
        type: "document" as const,
        tags: ["tag1"],
        relevance: "medium" as const,
        chain: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const form: EvidenceFormData = {
        ...INITIAL_FORM,
        title: "Updated Evidence",
        tags: "tag1, tag2",
      };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleEvidenceSave(
        form,
        evidence,
        onAdd,
        onUpdate,
        onFormReset,
        onDialogClose,
      );

      expect(onUpdate).toHaveBeenCalled();
      const callArg = onUpdate.mock.calls[0];
      expect(callArg[0]).toBe("1");
      expect(callArg[1].tags).toEqual(["tag1", "tag2"]);
      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("calls onAdd when creating new evidence", () => {
      const form: EvidenceFormData = {
        ...INITIAL_FORM,
        title: "New Evidence",
        tags: "tag1, tag2",
      };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleEvidenceSave(
        form,
        null,
        onAdd,
        onUpdate,
        onFormReset,
        onDialogClose,
      );

      expect(onAdd).toHaveBeenCalled();
      const callArg = onAdd.mock.calls[0][0];
      expect(callArg.tags).toEqual(["tag1", "tag2"]);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onUpdate for invalid form", () => {
      const evidence: Evidence = {
        id: "1",
        title: "Evidence",
        type: "document" as const,
        tags: [],
        relevance: "medium" as const,
        chain: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const form: EvidenceFormData = { ...INITIAL_FORM, title: "" };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleEvidenceSave(
        form,
        evidence,
        onAdd,
        onUpdate,
        onFormReset,
        onDialogClose,
      );

      expect(onUpdate).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
      expect(onDialogClose).not.toHaveBeenCalled();
    });
  });

  describe("handleEvidenceDialogClose", () => {
    it("opens dialog when open is true", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleEvidenceDialogClose(
        true,
        onOpenChange,
        onEditingReset,
        onFormReset,
      );

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(onEditingReset).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
    });

    it("closes dialog and resets state when open is false", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleEvidenceDialogClose(
        false,
        onOpenChange,
        onEditingReset,
        onFormReset,
      );

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onEditingReset).toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
    });
  });
});
