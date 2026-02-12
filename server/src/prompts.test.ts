import { describe, it, expect, beforeEach } from "vitest";
import {
  getChatSystemPrompt,
  getCaseSummaryPrompt,
  getEvaluatorPrompt,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  DEFAULT_CASE_SUMMARY_PROMPT,
  DEFAULT_EVALUATOR_PROMPT,
} from "./prompts";
import { db, resetDb } from "./db";
import { InMemoryAdapter } from "./persistence";

describe("prompts", () => {
  beforeEach(() => {
    resetDb(new InMemoryAdapter());
  });

  describe("getChatSystemPrompt", () => {
    it("returns default prompt when no custom prompt is configured", () => {
      const prompt = getChatSystemPrompt();
      expect(prompt).toBe(DEFAULT_CHAT_SYSTEM_PROMPT);
    });

    it("returns custom prompt when configured in ServerConfig", () => {
      const customPrompt = "Custom chat system prompt for testing";
      const now = new Date().toISOString();
      
      db.serverConfig.set("singleton", {
        id: "singleton",
        createdAt: now,
        updatedAt: now,
        prompts: {
          chatSystemPrompt: customPrompt,
        },
      });

      const prompt = getChatSystemPrompt();
      expect(prompt).toBe(customPrompt);
    });
  });

  describe("getCaseSummaryPrompt", () => {
    it("returns default prompt when no custom prompt is configured", () => {
      const prompt = getCaseSummaryPrompt();
      expect(prompt).toBe(DEFAULT_CASE_SUMMARY_PROMPT);
    });

    it("returns custom prompt when configured in ServerConfig", () => {
      const customPrompt = "Custom case summary prompt: {caseName} - {status}";
      const now = new Date().toISOString();
      
      db.serverConfig.set("singleton", {
        id: "singleton",
        createdAt: now,
        updatedAt: now,
        prompts: {
          caseSummaryPrompt: customPrompt,
        },
      });

      const prompt = getCaseSummaryPrompt();
      expect(prompt).toBe(customPrompt);
    });
  });

  describe("getEvaluatorPrompt", () => {
    it("returns default prompt when no custom prompt is configured", () => {
      const prompt = getEvaluatorPrompt();
      expect(prompt).toBe(DEFAULT_EVALUATOR_PROMPT);
    });

    it("returns custom prompt when configured in ServerConfig", () => {
      const customPrompt = "Custom evaluator prompt: {overdueText} and {upcomingText}";
      const now = new Date().toISOString();
      
      db.serverConfig.set("singleton", {
        id: "singleton",
        createdAt: now,
        updatedAt: now,
        prompts: {
          evaluatorPrompt: customPrompt,
        },
      });

      const prompt = getEvaluatorPrompt();
      expect(prompt).toBe(customPrompt);
    });
  });

  describe("default prompts", () => {
    it("DEFAULT_CHAT_SYSTEM_PROMPT contains key elements", () => {
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("legal assistant");
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("pro se");
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("Virginia");
    });

    it("DEFAULT_CASE_SUMMARY_PROMPT contains placeholders", () => {
      expect(DEFAULT_CASE_SUMMARY_PROMPT).toContain("{caseName}");
      expect(DEFAULT_CASE_SUMMARY_PROMPT).toContain("{caseType}");
      expect(DEFAULT_CASE_SUMMARY_PROMPT).toContain("{status}");
      expect(DEFAULT_CASE_SUMMARY_PROMPT).toContain("{totalDeadlines}");
    });

    it("DEFAULT_EVALUATOR_PROMPT contains placeholders", () => {
      expect(DEFAULT_EVALUATOR_PROMPT).toContain("{overdueText}");
      expect(DEFAULT_EVALUATOR_PROMPT).toContain("{upcomingText}");
    });
  });
});
