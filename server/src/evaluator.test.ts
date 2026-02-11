import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  analyzeDeadlines,
  createNotificationContent,
  runEvaluation,
} from "./evaluator";
import { db, resetDb } from "./db";
import { InMemoryAdapter } from "./persistence";

// Mock OpenAI
vi.mock("openai", () => {
  return {
    default: class {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Test AI summary" } }],
          }),
        },
      };
    },
  };
});

/** Format a Date as YYYY-MM-DD in local time */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("Evaluator", () => {
  beforeEach(() => {
    resetDb(new InMemoryAdapter());
  });

  describe("analyzeDeadlines", () => {
    it("should return empty arrays when no deadlines exist", async () => {
      const result = await analyzeDeadlines();

      expect(result.overdueDeadlines).toEqual([]);
      expect(result.upcomingDeadlines).toEqual([]);
      expect(result.tomorrowActions).toEqual([]);
      expect(result.aiSummary).toBe(
        "No active deadlines. Your calendar is clear.",
      );
    });

    it("should categorize overdue deadlines correctly", async () => {
      // Add an overdue deadline (yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = localDateStr(yesterday);

      db.deadlines.set("1", {
        id: "1",
        caseId: "",
        title: "Overdue Filing",
        date: dateStr,
        type: "filing",
        completed: false,
      });

      const result = await analyzeDeadlines();

      expect(result.overdueDeadlines).toHaveLength(1);
      expect(result.overdueDeadlines[0].title).toBe("Overdue Filing");
      expect(result.overdueDeadlines[0].daysOverdue).toBe(1);
    });

    it("should categorize upcoming deadlines correctly", async () => {
      // Add a deadline for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = localDateStr(tomorrow);

      db.deadlines.set("1", {
        id: "1",
        caseId: "",
        title: "Tomorrow Filing",
        date: dateStr,
        type: "filing",
        completed: false,
      });

      const result = await analyzeDeadlines();

      expect(result.upcomingDeadlines).toHaveLength(1);
      expect(result.upcomingDeadlines[0].title).toBe("Tomorrow Filing");
      expect(result.upcomingDeadlines[0].daysUntil).toBe(1);
      expect(result.tomorrowActions).toHaveLength(1);
    });

    it("should exclude completed deadlines", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = localDateStr(yesterday);

      db.deadlines.set("1", {
        id: "1",
        caseId: "",
        title: "Completed Filing",
        date: dateStr,
        type: "filing",
        completed: true,
      });

      const result = await analyzeDeadlines();

      expect(result.overdueDeadlines).toHaveLength(0);
    });

    it("should include case name when available", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = localDateStr(tomorrow);

      db.cases.set("case-1", {
        id: "case-1",
        name: "Smith v. Jones",
        caseNumber: "2024-CV-001",
        court: "Circuit Court",
        caseType: "Civil",
        status: "active",
        parties: [],
        filings: [],
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.deadlines.set("1", {
        id: "1",
        caseId: "case-1",
        title: "Motion Response",
        date: dateStr,
        type: "filing",
        completed: false,
      });

      const result = await analyzeDeadlines();

      expect(result.upcomingDeadlines[0].caseName).toBe("Smith v. Jones");
    });
  });

  describe("createNotificationContent", () => {
    it("should create urgent title for overdue deadlines", () => {
      const analysis = {
        overdueDeadlines: [
          {
            id: "1",
            title: "Test",
            date: "2024-01-01",
            caseId: "",
            type: "filing",
            daysOverdue: 2,
          },
          {
            id: "2",
            title: "Test2",
            date: "2024-01-02",
            caseId: "",
            type: "filing",
            daysOverdue: 1,
          },
        ],
        upcomingDeadlines: [],
        tomorrowActions: [],
        aiSummary: "Test summary",
      };

      const result = createNotificationContent(analysis);

      expect(result.title).toContain("Overdue");
      expect(result.title).toContain("2");
    });

    it("should create tomorrow title when no overdue but has tomorrow items", () => {
      const analysis = {
        overdueDeadlines: [],
        upcomingDeadlines: [
          {
            id: "1",
            title: "Test",
            date: "2024-01-01",
            caseId: "",
            type: "filing",
            daysUntil: 1,
          },
        ],
        tomorrowActions: ["Test - filing"],
        aiSummary: "Test summary",
      };

      const result = createNotificationContent(analysis);

      expect(result.title).toContain("Tomorrow");
    });

    it("should use default title when calendar is clear", () => {
      const analysis = {
        overdueDeadlines: [],
        upcomingDeadlines: [],
        tomorrowActions: [],
        aiSummary: "Test summary",
      };

      const result = createNotificationContent(analysis);

      expect(result.title).toBe("Daily Case Update");
      expect(result.body).toContain("clear");
    });
  });

  describe("runEvaluation", () => {
    it("should create and store an evaluation", async () => {
      const evaluation = await runEvaluation();

      expect(evaluation.id).toBeDefined();
      expect(evaluation.createdAt).toBeDefined();
      expect(evaluation.status).toBe("sending");
      expect(db.evaluations.has(evaluation.id)).toBe(true);
    });

    it("should include analysis data in evaluation", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = localDateStr(tomorrow);

      db.deadlines.set("1", {
        id: "1",
        caseId: "",
        title: "Test Deadline",
        date: dateStr,
        type: "filing",
        completed: false,
      });

      const evaluation = await runEvaluation();

      expect(evaluation.analysis.upcomingDeadlines).toHaveLength(1);
      expect(evaluation.notification.title).toBeDefined();
      expect(evaluation.notification.body).toBeDefined();
    });
  });
});
