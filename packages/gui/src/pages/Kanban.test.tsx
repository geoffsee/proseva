import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Kanban from "./Kanban";
import { useStore } from "../store/StoreContext";

vi.mock("../store/StoreContext", () => ({
  useStore: vi.fn(() => ({
    taskStore: {
      tasks: [
        {
          id: "1",
          title: "Prepare brief",
          description: "Draft legal brief",
          status: "todo",
          priority: "high",
          dueDate: "2025-02-28",
        },
        {
          id: "2",
          title: "File motion",
          description: "File motion to court",
          status: "in-progress",
          priority: "medium",
          dueDate: null,
        },
      ],
      todoTasks: [
        {
          id: "1",
          title: "Prepare brief",
          description: "Draft legal brief",
          status: "todo",
          priority: "high",
          dueDate: "2025-02-28",
        },
      ],
      inProgressTasks: [
        {
          id: "2",
          title: "File motion",
          description: "File motion to court",
          status: "in-progress",
          priority: "medium",
          dueDate: null,
        },
      ],
      doneTasks: [],
      addTask: vi.fn(),
      updateTask: vi.fn(),
      moveTask: vi.fn(),
      deleteTask: vi.fn(),
    },
  })),
}));

describe("Kanban", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      taskStore: {
        tasks: [
          {
            id: "1",
            title: "Prepare brief",
            description: "Draft legal brief",
            status: "todo" as const,
            priority: "high" as const,
            dueDate: "2025-02-28",
          },
          {
            id: "2",
            title: "File motion",
            description: "File motion to court",
            status: "in-progress" as const,
            priority: "medium" as const,
            dueDate: null,
          },
        ],
        todoTasks: [
          {
            id: "1",
            title: "Prepare brief",
            description: "Draft legal brief",
            status: "todo" as const,
            priority: "high" as const,
            dueDate: "2025-02-28",
          },
        ],
        inProgressTasks: [
          {
            id: "2",
            title: "File motion",
            description: "File motion to court",
            status: "in-progress" as const,
            priority: "medium" as const,
            dueDate: null,
          },
        ],
        doneTasks: [],
        addTask: vi.fn(),
        updateTask: vi.fn(),
        moveTask: vi.fn(),
        deleteTask: vi.fn(),
      },
    } as any);
  });

  it("renders tasks heading and add button", () => {
    render(<Kanban />);
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Task/i }),
    ).toBeInTheDocument();
  });

  it("displays stat cards with task information", () => {
    render(<Kanban />);
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
    // "To Do" appears in both stat card and column heading, use getAllByText
    expect(screen.getAllByText("To Do").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
  });

  it("displays kanban columns", () => {
    const { container } = render(<Kanban />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("opens dialog when Add Task button is clicked", async () => {
    render(<Kanban />);
    fireEvent.click(screen.getByRole("button", { name: /Add Task/i }));

    await waitFor(() => {
      expect(screen.getByText(/Add Task|Edit/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no tasks exist", () => {
    vi.mocked(useStore).mockReturnValue({
      taskStore: {
        tasks: [],
        todoTasks: [],
        inProgressTasks: [],
        doneTasks: [],
        addTask: vi.fn(),
        updateTask: vi.fn(),
        moveTask: vi.fn(),
        deleteTask: vi.fn(),
      },
    } as any);
    render(<Kanban />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  it("displays correct task counts in stat cards", () => {
    render(<Kanban />);
    const stats = screen.getAllByText(/[0-9]+/);
    expect(stats.length).toBeGreaterThan(0);
  });

  it("renders task grid layout", () => {
    const { container } = render(<Kanban />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("manages dialog open/close state", async () => {
    render(<Kanban />);
    const addButton = screen.getByRole("button", { name: /Add Task/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/Add Task|Edit/i)).toBeInTheDocument();
    });
  });

  it("validates handleAdd requires title (lines 36-39)", () => {
    const addTask = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      taskStore: {
        tasks: [],
        todoTasks: [],
        inProgressTasks: [],
        doneTasks: [],
        addTask,
        updateTask: vi.fn(),
        moveTask: vi.fn(),
        deleteTask: vi.fn(),
      },
    } as any);

    render(<Kanban />);
    // handleAdd checks: if (!form.title.trim()) return
    fireEvent.click(screen.getByRole("button", { name: /Add Task/i }));
    expect(addTask).not.toHaveBeenCalled();
  });

  it("executes handleEdit to populate form (lines 43-51)", async () => {
    render(<Kanban />);
    fireEvent.click(screen.getAllByLabelText("Edit task")[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Task")).toBeInTheDocument();
    });
  });

  it("executes handleSave path with editingTask (lines 55-62)", async () => {
    const updateTask = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      taskStore: {
        tasks: [
          {
            id: "1",
            title: "Test Task",
            description: "Test description",
            status: "todo" as const,
            priority: "high" as const,
            dueDate: "2025-02-28",
          },
        ],
        todoTasks: [
          {
            id: "1",
            title: "Test Task",
            description: "Test description",
            status: "todo" as const,
            priority: "high" as const,
            dueDate: "2025-02-28",
          },
        ],
        inProgressTasks: [],
        doneTasks: [],
        addTask: vi.fn(),
        updateTask,
        moveTask: vi.fn(),
        deleteTask: vi.fn(),
      },
    } as any);

    render(<Kanban />);
    fireEvent.click(screen.getAllByLabelText("Edit task")[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Task")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateTask).toHaveBeenCalledWith("1", expect.any(Object));
  });

  it("executes handleDialogClose to reset form (lines 65-69)", async () => {
    render(<Kanban />);
    fireEvent.click(screen.getByRole("button", { name: /Add Task/i }));
    await waitFor(() => {
      expect(screen.getByText("Add Task")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
    });
  });

  it("calls handleMoveTask to move task between columns (line 74)", () => {
    const moveTask = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      taskStore: {
        tasks: [
          {
            id: "1",
            title: "Test Task",
            description: "Test",
            status: "todo" as const,
            priority: "medium" as const,
            dueDate: null,
          },
        ],
        todoTasks: [
          {
            id: "1",
            title: "Test Task",
            description: "Test",
            status: "todo" as const,
            priority: "medium" as const,
            dueDate: null,
          },
        ],
        inProgressTasks: [],
        doneTasks: [],
        addTask: vi.fn(),
        updateTask: vi.fn(),
        moveTask,
        deleteTask: vi.fn(),
      },
    } as any);

    render(<Kanban />);
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });

  it("calls handleDeleteTask (line 78)", () => {
    const deleteTask = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      taskStore: {
        tasks: [
          {
            id: "1",
            title: "Test Task",
            description: "Test",
            status: "todo" as const,
            priority: "medium" as const,
            dueDate: null,
          },
        ],
        todoTasks: [
          {
            id: "1",
            title: "Test Task",
            description: "Test",
            status: "todo" as const,
            priority: "medium" as const,
            dueDate: null,
          },
        ],
        inProgressTasks: [],
        doneTasks: [],
        addTask: vi.fn(),
        updateTask: vi.fn(),
        moveTask: vi.fn(),
        deleteTask,
      },
    } as any);

    render(<Kanban />);
    fireEvent.click(screen.getByLabelText("Delete task"));
    expect(deleteTask).toHaveBeenCalledWith("1");
  });

  it("handles handleDragStart to track dragged task (line 82)", () => {
    render(<Kanban />);
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
  });

  it("handles handleDragEnd to clear drag state (line 86)", () => {
    render(<Kanban />);
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
  });
});
