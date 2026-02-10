import { types, type Instance, flow, type SnapshotIn } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";

export const TaskModel = types
  .model("Task", {
    id: types.identifier,
    title: types.string,
    description: types.optional(types.string, ""),
    status: types.enumeration("TaskStatus", ["todo", "in-progress", "done"]),
    priority: types.optional(
      types.enumeration("Priority", ["low", "medium", "high"]),
      "medium",
    ),
    dueDate: types.maybeNull(types.string),
    createdAt: types.string,
    updatedAt: types.string,
  })
  .actions((self) => ({
    update(updates: Partial<SnapshotIn<typeof self>>) {
      Object.assign(self, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    },
    moveToStatus(status: "todo" | "in-progress" | "done") {
      self.status = status;
      self.updatedAt = new Date().toISOString();
    },
  }));

export type Task = Instance<typeof TaskModel>;

export const TaskStore = types
  .model("TaskStore", {
    tasks: types.array(TaskModel),
  })
  .views((self) => ({
    get todoTasks() {
      return self.tasks.filter((task) => task.status === "todo");
    },
    get inProgressTasks() {
      return self.tasks.filter((task) => task.status === "in-progress");
    },
    get doneTasks() {
      return self.tasks.filter((task) => task.status === "done");
    },
    getTaskById(id: string) {
      return self.tasks.find((task) => task.id === id);
    },
  }))
  .actions((self) => ({
    addTask: flow(function* (taskData: {
      title: string;
      description?: string;
      status?: "todo" | "in-progress" | "done";
      priority?: "low" | "medium" | "high";
      dueDate?: string | null;
    }) {
      const now = new Date().toISOString();
      const newTask = TaskModel.create({
        id: uuidv4(),
        title: taskData.title,
        description: taskData.description || "",
        status: taskData.status || "todo",
        priority: taskData.priority || "medium",
        dueDate: taskData.dueDate || null,
        createdAt: now,
        updatedAt: now,
      });
      self.tasks.push(newTask);
      return newTask;
    }),
    updateTask: flow(function* (
      id: string,
      updates: Partial<SnapshotIn<Task>>,
    ) {
      const task = self.getTaskById(id);
      if (task) {
        task.update(updates);
      }
    }),
    deleteTask: flow(function* (id: string) {
      const index = self.tasks.findIndex((task) => task.id === id);
      if (index !== -1) {
        self.tasks.splice(index, 1);
      }
    }),
    moveTask: flow(function* (
      id: string,
      newStatus: "todo" | "in-progress" | "done",
    ) {
      const task = self.getTaskById(id);
      if (task) {
        task.moveToStatus(newStatus);
      }
    }),
  }));

export type TaskStoreType = Instance<typeof TaskStore>;
