import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

vi.mock("fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: actual,
    readFile: vi.fn().mockRejectedValue(new Error("not found")),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

import { setupTestServer, api, freshDb } from "./test-helpers";
import { db } from "./db";

const ctx = setupTestServer();

describe("Chat API", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "I can help with legal questions." },
        },
      ],
    });
  });

  it("returns a reply from the chat endpoint", async () => {
    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "What is a motion?" }],
      },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBeDefined();
    expect(typeof body.reply).toBe("string");
  });

  it("handles empty messages array", async () => {
    const res = await api.post("/api/chat", { messages: [] }, ctx.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBeDefined();
  });

  it("executes tool calls and returns final reply", async () => {
    // First call returns tool_calls, second returns final answer
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: { name: "GetCases", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "You have no cases." },
          },
        ],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "Show my cases" }],
      },
      ctx.baseUrl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("You have no cases.");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("handles GetDeadlines tool with caseId filter", async () => {
    db.deadlines.set("d1", {
      id: "d1",
      caseId: "c1",
      title: "Filing",
      date: "2024-01-01",
      type: "filing",
      completed: false,
    });
    db.deadlines.set("d2", {
      id: "d2",
      caseId: "c2",
      title: "Hearing",
      date: "2024-02-01",
      type: "hearing",
      completed: false,
    });

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: {
                    name: "GetDeadlines",
                    arguments: '{"caseId":"c1"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "You have one deadline for case c1." },
          },
        ],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "deadlines for c1" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("You have one deadline for case c1.");
  });

  it("handles GetContacts tool with caseId filter", async () => {
    db.contacts.set("ct1", { id: "ct1", caseId: "c1", name: "John" } as any);

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: {
                    name: "GetContacts",
                    arguments: '{"caseId":"c1"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Found John." } },
        ],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "contacts" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("Found John.");
  });

  it("handles GetFinances tool", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: { name: "GetFinances", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "No finances." } },
        ],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "finances" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("No finances.");
  });

  it("handles GetDocuments tool (file not found)", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: { name: "GetDocuments", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: "No docs." } }],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "documents" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("No docs.");
  });

  it("handles GetDocumentText tool (file not found)", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: {
                    name: "GetDocumentText",
                    arguments: '{"id":"abc"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Doc not found." } },
        ],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "read doc abc" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("Doc not found.");
  });

  it("handles SearchTimeline tool (file not found)", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: {
                    name: "SearchTimeline",
                    arguments: '{"query":"custody"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "No timeline." } },
        ],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "search timeline" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("No timeline.");
  });

  it("handles AnalyzeCaseGraph tool", async () => {
    db.cases.set("c1", {
      id: "c1",
      name: "Custody Matter",
      caseNumber: "JA-123",
      court: "Juvenile Court",
      caseType: "custody",
      status: "active",
      parties: [
        { id: "p1", name: "Alice", role: "Petitioner", contact: "alice@example.com" },
      ],
      filings: [],
      notes: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    db.deadlines.set("d1", {
      id: "d1",
      caseId: "c1",
      title: "Initial filing",
      date: "2024-05-01",
      type: "filing",
      completed: false,
    });

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: {
                    name: "AnalyzeCaseGraph",
                    arguments: '{"caseId":"c1","topK":3}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: "Graph complete." } }],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "Analyze my case graph" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("Graph complete.");
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const secondCall = mockCreate.mock.calls[1]?.[0] as {
      messages?: Array<{ role: string; content?: string }>;
    };
    const toolMessage = secondCall.messages?.find((m) => m.role === "tool");
    expect(toolMessage?.content).toContain('"caseId":"c1"');
    expect(toolMessage?.content).toContain('"openDeadlines":1');
    expect(toolMessage?.content).toContain('"topConnectedNodes"');
  });

  it("handles unknown tool gracefully", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  function: { name: "nonexistent_tool", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: "Done." } }],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "test" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("Done.");
  });

  it("returns fallback after max iterations", async () => {
    // Always return tool calls to exhaust the loop
    mockCreate.mockResolvedValue({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_loop",
                function: { name: "GetCases", arguments: "{}" },
              },
            ],
          },
        },
      ],
    });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "loop" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("Sorry, I was unable to complete the request.");
    expect(mockCreate).toHaveBeenCalledTimes(10);
  });
});
