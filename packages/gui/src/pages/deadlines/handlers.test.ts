import { describe, it, expect, vi } from "vitest";
import {
  validateDeadlineForm,
  loadDeadlineForm,
  handleDeadlineAdd,
  handleDeadlineEdit,
  handleDeadlineSave,
  handleDeadlineDialogClose,
  INITIAL_FORM,
  type DeadlineFormData,
} from "./handlers";
import type { Deadline } from "../../types";

describe("Deadlines Handlers", () => {
  describe("validateDeadlineForm", () => {
    it("returns false when title is empty", () => {
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "",
        date: "2025-02-28",
      };
      expect(validateDeadlineForm(form)).toBe(false);
    });

    it("returns false when date is empty", () => {
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "File Motion",
        date: "",
      };
      expect(validateDeadlineForm(form)).toBe(false);
    });

    it("returns false when title is only whitespace", () => {
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "   ",
        date: "2025-02-28",
      };
      expect(validateDeadlineForm(form)).toBe(false);
    });

    it("returns true when both title and date have content", () => {
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "File Motion",
        date: "2025-02-28",
      };
      expect(validateDeadlineForm(form)).toBe(true);
    });
  });

  describe("loadDeadlineForm", () => {
    it("loads all deadline data into form", () => {
      const deadline: Deadline = {
        id: "1",
        title: "File Motion",
        date: "2025-02-28",
        type: "filing",
        completed: false,
        description: "Motion to dismiss",
        priority: "high",
        caseId: "case-1",
      };

      const form = loadDeadlineForm(deadline);

      expect(form.title).toBe("File Motion");
      expect(form.date).toBe("2025-02-28");
      expect(form.type).toBe("filing");
      expect(form.description).toBe("Motion to dismiss");
      expect(form.priority).toBe("high");
      expect(form.caseId).toBe("case-1");
    });

    it("handles missing optional fields", () => {
      const deadline: Deadline = {
        id: "1",
        title: "Deadline",
        date: "2025-02-28",
        type: "other",
        completed: false,
      };

      const form = loadDeadlineForm(deadline);

      expect(form.description).toBe("");
      expect(form.priority).toBe("medium");
      expect(form.caseId).toBe("");
    });
  });

  describe("handleDeadlineAdd", () => {
    it("calls onAdd when form is valid", () => {
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "New Deadline",
        date: "2025-02-28",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleDeadlineAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).toHaveBeenCalledWith(form);
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onAdd when title is empty", () => {
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "",
        date: "2025-02-28",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleDeadlineAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
      expect(onDialogClose).not.toHaveBeenCalled();
    });

    it("does not call onAdd when date is empty", () => {
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "Deadline",
        date: "",
      };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleDeadlineAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe("handleDeadlineEdit", () => {
    it("loads deadline data and opens dialog", () => {
      const deadline: Deadline = {
        id: "1",
        title: "Existing Deadline",
        date: "2025-02-28",
        type: "hearing",
        completed: false,
      };
      const onFormLoad = vi.fn();
      const onDialogOpen = vi.fn();

      handleDeadlineEdit(deadline, onFormLoad, onDialogOpen);

      expect(onFormLoad).toHaveBeenCalled();
      const formArg = onFormLoad.mock.calls[0][0];
      expect(formArg.title).toBe("Existing Deadline");
      expect(formArg.date).toBe("2025-02-28");
      expect(onDialogOpen).toHaveBeenCalled();
    });
  });

  describe("handleDeadlineSave", () => {
    it("calls onUpdate when editing existing deadline", () => {
      const deadline: Deadline = {
        id: "1",
        title: "Deadline",
        date: "2025-02-28",
        type: "filing",
        completed: false,
      };
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "Updated Deadline",
        date: "2025-03-01",
      };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleDeadlineSave(
        form,
        deadline,
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

    it("calls onAdd when creating new deadline", () => {
      const form: DeadlineFormData = {
        ...INITIAL_FORM,
        title: "New Deadline",
        date: "2025-02-28",
      };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleDeadlineSave(
        form,
        null,
        onAdd,
        onUpdate,
        onFormReset,
        onDialogClose,
      );

      expect(onAdd).toHaveBeenCalledWith(form);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onUpdate for invalid form", () => {
      const deadline: Deadline = {
        id: "1",
        title: "Deadline",
        date: "2025-02-28",
        type: "filing",
        completed: false,
      };
      const form: DeadlineFormData = { ...INITIAL_FORM, title: "", date: "" };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleDeadlineSave(
        form,
        deadline,
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

  describe("handleDeadlineDialogClose", () => {
    it("opens dialog when open is true", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleDeadlineDialogClose(
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

      handleDeadlineDialogClose(
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
