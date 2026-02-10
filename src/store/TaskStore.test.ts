import { describe, it, expect, beforeEach } from "vitest";
import { TaskStore } from "./TaskStore";

describe("TaskStore", () => {
  let store: ReturnType<typeof TaskStore.create>;

  beforeEach(() => {
    store = TaskStore.create({ tasks: [] });
  });

  it("should create a new task", async () => {
    await store.addTask({
      title: "Test Task",
      description: "This is a test",
      status: "todo",
      priority: "high",
    });

    expect(store.tasks.length).toBe(1);
    expect(store.tasks[0].title).toBe("Test Task");
    expect(store.tasks[0].status).toBe("todo");
    expect(store.tasks[0].priority).toBe("high");
  });

  it("should filter tasks by status", async () => {
    await store.addTask({ title: "Task 1", status: "todo" });
    await store.addTask({ title: "Task 2", status: "in-progress" });
    await store.addTask({ title: "Task 3", status: "done" });

    expect(store.todoTasks.length).toBe(1);
    expect(store.inProgressTasks.length).toBe(1);
    expect(store.doneTasks.length).toBe(1);
  });

  it("should update a task", async () => {
    await store.addTask({ title: "Original Title", status: "todo" });
    const taskId = store.tasks[0].id;

    await store.updateTask(taskId, {
      title: "Updated Title",
      priority: "high",
    });

    expect(store.tasks[0].title).toBe("Updated Title");
    expect(store.tasks[0].priority).toBe("high");
  });

  it("should move a task to a different status", async () => {
    await store.addTask({ title: "Task", status: "todo" });
    const taskId = store.tasks[0].id;

    await store.moveTask(taskId, "in-progress");

    expect(store.tasks[0].status).toBe("in-progress");
    expect(store.inProgressTasks.length).toBe(1);
    expect(store.todoTasks.length).toBe(0);
  });

  it("should delete a task", async () => {
    await store.addTask({ title: "Task to delete", status: "todo" });
    const taskId = store.tasks[0].id;

    await store.deleteTask(taskId);

    expect(store.tasks.length).toBe(0);
  });

  it("should get task by id", async () => {
    await store.addTask({ title: "Find me", status: "todo" });
    const taskId = store.tasks[0].id;

    const task = store.getTaskById(taskId);

    expect(task).toBeDefined();
    expect(task?.title).toBe("Find me");
  });
});
