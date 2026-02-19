import { describe, it, expect, vi } from "vitest";
import {
  validateTaskForm,
  loadTaskForm,
  handleTaskAdd,
  handleTaskEdit,
  handleTaskSave,
  handleTaskDialogClose,
  INITIAL_FORM,
  type TaskFormData,
} from "./handlers";
import type { Task } from "../../store/TaskStore";

describe("Kanban Handlers", () => {
  describe("validateTaskForm", () => {
    it("returns false when title is empty", () => {
      const form: TaskFormData = { ...INITIAL_FORM, title: "" };
      expect(validateTaskForm(form)).toBe(false);
    });

    it("returns false when title is only whitespace", () => {
      const form: TaskFormData = { ...INITIAL_FORM, title: "   " };
      expect(validateTaskForm(form)).toBe(false);
    });

    it("returns true when title has content", () => {
      const form: TaskFormData = { ...INITIAL_FORM, title: "Valid Task" };
      expect(validateTaskForm(form)).toBe(true);
    });
  });

  describe("loadTaskForm", () => {
    it("loads all task data into form", () => {
      const task = {
        id: "1",
        title: "Test Task",
        description: "Test description",
        status: "in-progress" as const,
        priority: "high" as const,
        dueDate: "2025-02-28",
      } as any as Task;

      const form = loadTaskForm(task);

      expect(form.title).toBe("Test Task");
      expect(form.description).toBe("Test description");
      expect(form.status).toBe("in-progress");
      expect(form.priority).toBe("high");
      expect(form.dueDate).toBe("2025-02-28");
    });
  });

  describe("handleTaskAdd", () => {
    it("calls onAdd when form is valid", () => {
      const form: TaskFormData = { ...INITIAL_FORM, title: "New Task" };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleTaskAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).toHaveBeenCalledWith(form);
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onAdd when title is empty", () => {
      const form: TaskFormData = { ...INITIAL_FORM, title: "" };
      const onAdd = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleTaskAdd(form, onAdd, onFormReset, onDialogClose);

      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
      expect(onDialogClose).not.toHaveBeenCalled();
    });
  });

  describe("handleTaskEdit", () => {
    it("loads task data and opens dialog", () => {
      const task = {
        id: "1",
        title: "Existing Task",
        description: "Description",
        status: "todo" as const,
        priority: "medium" as const,
        dueDate: null,
      } as any as Task;
      const onFormLoad = vi.fn();
      const onDialogOpen = vi.fn();

      handleTaskEdit(task, onFormLoad, onDialogOpen);

      expect(onFormLoad).toHaveBeenCalled();
      const formArg = onFormLoad.mock.calls[0][0];
      expect(formArg.title).toBe("Existing Task");
      expect(formArg.description).toBe("Description");
      expect(onDialogOpen).toHaveBeenCalled();
    });
  });

  describe("handleTaskSave", () => {
    it("calls onUpdate when editing existing task", () => {
      const task = {
        id: "1",
        title: "Task",
        description: "Desc",
        status: "todo" as const,
        priority: "medium" as const,
        dueDate: null,
      } as any as Task;
      const form: TaskFormData = { ...INITIAL_FORM, title: "Updated Task" };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleTaskSave(form, task, onAdd, onUpdate, onFormReset, onDialogClose);

      expect(onUpdate).toHaveBeenCalledWith("1", form);
      expect(onAdd).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("calls onAdd when creating new task", () => {
      const form: TaskFormData = { ...INITIAL_FORM, title: "New Task" };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleTaskSave(form, null, onAdd, onUpdate, onFormReset, onDialogClose);

      expect(onAdd).toHaveBeenCalledWith(form);
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
      expect(onDialogClose).toHaveBeenCalled();
    });

    it("does not call onUpdate for invalid form", () => {
      const task = {
        id: "1",
        title: "Task",
        description: "Desc",
        status: "todo" as const,
        priority: "medium" as const,
        dueDate: null,
      } as any as Task;
      const form: TaskFormData = { ...INITIAL_FORM, title: "" };
      const onAdd = vi.fn();
      const onUpdate = vi.fn();
      const onFormReset = vi.fn();
      const onDialogClose = vi.fn();

      handleTaskSave(form, task, onAdd, onUpdate, onFormReset, onDialogClose);

      expect(onUpdate).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
      expect(onDialogClose).not.toHaveBeenCalled();
    });
  });

  describe("handleTaskDialogClose", () => {
    it("opens dialog when open is true", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleTaskDialogClose(true, onOpenChange, onEditingReset, onFormReset);

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(onEditingReset).not.toHaveBeenCalled();
      expect(onFormReset).not.toHaveBeenCalled();
    });

    it("closes dialog and resets state when open is false", () => {
      const onOpenChange = vi.fn();
      const onEditingReset = vi.fn();
      const onFormReset = vi.fn();

      handleTaskDialogClose(false, onOpenChange, onEditingReset, onFormReset);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onEditingReset).toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalled();
    });
  });
});
