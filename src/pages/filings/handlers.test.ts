import { describe, it, expect, vi } from "vitest";
import {
  validateFilingForm,
  loadFilingForm,
  handleFilingAdd,
  handleFilingEdit,
  handleFilingSave,
  handleFilingDialogClose,
  INITIAL_FORM,
  type FilingFormData,
} from "./handlers";
import type { Filing } from "../../types";

describe("Filings Handlers", () => {
  describe("validateFilingForm", () => {
    it("returns false when title is empty", () => {
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "",
        date: "2024-01-15",
      };
      expect(validateFilingForm(form)).toBe(false);
    });

    it("returns false when date is empty", () => {
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "Motion",
        date: "",
      };
      expect(validateFilingForm(form)).toBe(false);
    });

    it("returns false when title is only whitespace", () => {
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "   ",
        date: "2024-01-15",
      };
      expect(validateFilingForm(form)).toBe(false);
    });

    it("returns true when both title and date have content", () => {
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "Motion",
        date: "2024-01-15",
      };
      expect(validateFilingForm(form)).toBe(true);
    });
  });

  describe("loadFilingForm", () => {
    it("loads all filing data into form", () => {
      const filing: Filing = {
        id: "1",
        title: "Motion to Dismiss",
        date: "2024-01-15",
        type: "Motion",
        notes: "Filed with court",
        caseId: "case-1",
      };

      const form = loadFilingForm(filing);

      expect(form.title).toBe("Motion to Dismiss");
      expect(form.date).toBe("2024-01-15");
      expect(form.type).toBe("Motion");
      expect(form.notes).toBe("Filed with court");
      expect(form.caseId).toBe("case-1");
    });

    it("handles missing optional fields", () => {
      const filing: Filing = {
        id: "1",
        title: "Brief",
        date: "2024-01-15",
        type: "",
      };

      const form = loadFilingForm(filing);

      expect(form.type).toBe("");
      expect(form.notes).toBe("");
      expect(form.caseId).toBe("");
    });
  });

  describe("handleFilingAdd", () => {
    it("calls onAdd when form is valid", () => {
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "New Filing",
        date: "2024-01-15",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleFilingAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).toHaveBeenCalledWith(form);
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onAdd when title is empty", () => {
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "",
        date: "2024-01-15",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleFilingAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
      expect(onDialogClose).not.toHaveBeenCalled();
    });

    it("does not call onAdd when date is empty", () => {
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "Filing",
        date: "",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleFilingAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe("handleFilingEdit", () => {
    it("loads filing data and opens dialog", () => {
      const filing: Filing = {
        id: "1",
        title: "Existing Filing",
        date: "2024-01-15",
        type: "Brief",
      };
      const onFormLoad = vi.fn();
      const onDialogOpen = vi.fn();

      handleFilingEdit(filing, onFormLoad, onDialogOpen);

      expect(onFormLoad).toHaveBeenCalled();
      const formArg = onFormLoad.mock.calls[0][0];
      expect(formArg.title).toBe("Existing Filing");
      expect(formArg.date).toBe("2024-01-15");
      expect(onDialogOpen).toHaveBeenCalled();
    });
  });

  describe("handleFilingSave", () => {
    it("calls onUpdate when editing existing filing", () => {
      const filing: Filing = {
        id: "1",
        title: "Filing",
        date: "2024-01-15",
        type: "",
      };
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "Updated Filing",
        date: "2024-01-16",
      };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleFilingSave(
        form,
        filing,
        onAdd,
        onUpdate,
        onFormReset,
        onDialogClose,
      );

      expect(onUpdate).toHaveBeenCalledWith("1", form);
      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("calls onAdd when creating new filing", () => {
      const form: FilingFormData = {
        ...INITIAL_FORM,
        title: "New Filing",
        date: "2024-01-15",
      };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleFilingSave(form, null, onAdd, onUpdate, onFormReset, onDialogClose);

      expect(onAdd).toHaveBeenCalledWith(form);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onUpdate for invalid form", () => {
      const filing: Filing = {
        id: "1",
        title: "Filing",
        date: "2024-01-15",
        type: "",
      };
      const form: FilingFormData = { ...INITIAL_FORM, title: "", date: "" };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleFilingSave(
        form,
        filing,
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

  describe("handleFilingDialogClose", () => {
    it("opens dialog when open is true", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleFilingDialogClose(true, onOpenChange, onEditingReset, onFormReset);

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(onEditingReset).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
    });

    it("closes dialog and resets state when open is false", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleFilingDialogClose(false, onOpenChange, onEditingReset, onFormReset);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onEditingReset).toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
    });
  });
});
