import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

vi.mock("fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    default: actual,
    readFile: vi.fn().mockRejectedValue(new Error("not found")),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

const mockExecuteExplorerTool = vi.fn();

vi.mock("./explorer-tools", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    executeExplorerTool: (...args: unknown[]) =>
      mockExecuteExplorerTool(...args),
  };
});

import { setupTestServer, api } from "./test-helpers";
import { db, type Contact } from "./db";

const ctx = setupTestServer();

describe("Chat API", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockExecuteExplorerTool.mockReset();
    // Default: returns stop with content (works for both Phase 1 and Phase 2).
    // Tests that need specific sequences override with mockResolvedValueOnce.
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
    // Phase 1: tool_calls → stop, Phase 2: final answer
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
                  type: "function",
                  function: { name: "GetCases", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
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
    expect(mockCreate).toHaveBeenCalledTimes(3);
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
                  type: "function",
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
        choices: [{ finish_reason: "stop", message: { content: null } }],
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
    db.contacts.set("ct1", {
      id: "ct1",
      caseId: "c1",
      name: "John",
      role: "Witness",
      organization: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    } as Contact);

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
                  type: "function",
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
        choices: [{ finish_reason: "stop", message: { content: null } }],
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
                  type: "function",
                  function: { name: "GetFinances", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
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
                  type: "function",
                  function: { name: "GetDocuments", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
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
                  type: "function",
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
        choices: [{ finish_reason: "stop", message: { content: null } }],
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
                  type: "function",
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
        choices: [{ finish_reason: "stop", message: { content: null } }],
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

  it("bootstraps compressed graph context and does not expose graph as a tool", async () => {
    db.cases.set("c1", {
      id: "c1",
      name: "Custody Matter",
      caseNumber: "JA-123",
      court: "Juvenile Court",
      caseType: "custody",
      status: "active",
      parties: [
        {
          id: "p1",
          name: "Alice",
          role: "Petitioner",
          contact: "alice@example.com",
        },
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
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Graph complete." } },
        ],
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

    const firstCall = mockCreate.mock.calls[0]?.[0] as {
      tools?: Array<{ function: { name: string } }>;
      messages?: Array<{ role: string; content?: string }>;
    };
    const toolNames = firstCall.tools?.map((tool) => tool.function.name) ?? [];
    expect(toolNames).not.toContain("AnalyzeCaseGraph");

    const systemMessage = firstCall.messages?.find(
      (message) => message.role === "system",
    );
    expect(systemMessage?.content).toContain(
      "Graph context bootstrap (compressed JSON snapshot):",
    );
    expect(systemMessage?.content).toContain('"priorityCases"');
    expect(systemMessage?.content).toContain('"openDeadlineCount":1');
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
                  type: "function",
                  function: { name: "nonexistent_tool", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
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

  it("includes explorer tools in the tools array sent to OpenAI", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Here is info." } },
        ],
      });

    await api.post(
      "/api/chat",
      { messages: [{ role: "user", content: "Tell me about FOIA" }] },
      ctx.baseUrl,
    );

    const firstCall = mockCreate.mock.calls[0]?.[0] as {
      tools?: Array<{ function: { name: string } }>;
    };
    const toolNames = firstCall.tools?.map((t) => t.function.name) ?? [];
    expect(toolNames).toContain("get_stats");
    expect(toolNames).toContain("search_nodes");
    expect(toolNames).toContain("get_node");
    expect(toolNames).toContain("get_neighbors");
    expect(toolNames).toContain("find_similar");
  });

  it("dispatches search_nodes explorer tool call and returns result", async () => {
    mockExecuteExplorerTool.mockResolvedValue(
      JSON.stringify({
        nodes: { total: 1, nodes: [{ id: 42, sourceId: "§2.2-3700" }] },
      }),
    );

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_explorer_1",
                  type: "function",
                  function: {
                    name: "search_nodes",
                    arguments: '{"search":"FOIA","type":"section"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Virginia FOIA is at §2.2-3700." },
          },
        ],
      });

    const res = await api.post(
      "/api/chat",
      { messages: [{ role: "user", content: "What is Virginia FOIA?" }] },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("Virginia FOIA is at §2.2-3700.");
    expect(mockExecuteExplorerTool).toHaveBeenCalledWith("search_nodes", {
      search: "FOIA",
      type: "section",
    });
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("dispatches get_node explorer tool call", async () => {
    mockExecuteExplorerTool.mockResolvedValue(
      JSON.stringify({ node: { id: 42, sourceText: "Full FOIA text here" } }),
    );

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_explorer_2",
                  type: "function",
                  function: {
                    name: "get_node",
                    arguments: '{"id":42}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Here is the text." } },
        ],
      });

    const res = await api.post(
      "/api/chat",
      { messages: [{ role: "user", content: "Read node 42" }] },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("Here is the text.");
    expect(mockExecuteExplorerTool).toHaveBeenCalledWith("get_node", {
      id: 42,
    });
  });

  it("handles explorer tool failure gracefully", async () => {
    mockExecuteExplorerTool.mockRejectedValue(new Error("ECONNREFUSED"));

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_explorer_fail",
                  type: "function",
                  function: {
                    name: "get_stats",
                    arguments: "{}",
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "Explorer is unavailable, but I can still help.",
            },
          },
        ],
      });

    const res = await api.post(
      "/api/chat",
      { messages: [{ role: "user", content: "Get knowledge graph stats" }] },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("Explorer is unavailable, but I can still help.");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("includes explorer tool note in system prompt", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: "OK." } }],
      });

    await api.post(
      "/api/chat",
      { messages: [{ role: "user", content: "hi" }] },
      ctx.baseUrl,
    );

    const firstCall = mockCreate.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content?: string }>;
    };
    const systemMessage = firstCall.messages?.find((m) => m.role === "system");
    expect(systemMessage?.content).toContain("knowledge graph");
    expect(systemMessage?.content).toContain("search_nodes");
  });

  it("Phase 2 uses TEXT_MODEL_LARGE without tools parameter", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: "Hello!" } }],
      });

    await api.post(
      "/api/chat",
      { messages: [{ role: "user", content: "hi" }] },
      ctx.baseUrl,
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Phase 1 call should have tools
    const phase1Call = mockCreate.mock.calls[0]?.[0] as {
      model?: string;
      tools?: unknown;
    };
    expect(phase1Call.tools).toBeDefined();

    // Phase 2 call should NOT have tools and should use TEXT_MODEL_LARGE
    const phase2Call = mockCreate.mock.calls[1]?.[0] as {
      model?: string;
      tools?: unknown;
    };
    expect(phase2Call.tools).toBeUndefined();
    expect(phase2Call.model).toBe("gpt-4o");
  });

  it("injects tool results into Phase 2 context as assistant message", async () => {
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
                  type: "function",
                  function: { name: "GetCases", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Here are your cases." },
          },
        ],
      });

    await api.post(
      "/api/chat",
      { messages: [{ role: "user", content: "Show cases" }] },
      ctx.baseUrl,
    );

    expect(mockCreate).toHaveBeenCalledTimes(3);

    // Phase 2 call should include an assistant message with tool results
    const phase2Call = mockCreate.mock.calls[2]?.[0] as {
      messages?: Array<{ role: string; content?: string }>;
    };
    const assistantContext = phase2Call.messages?.find(
      (m) => m.role === "assistant" && m.content?.includes("[GetCases]:"),
    );
    expect(assistantContext).toBeDefined();
    expect(assistantContext?.content).toContain(
      "I retrieved the following data",
    );
  });

  it("returns fallback after max iterations", async () => {
    // All 10 Phase 1 iterations return tool calls, then Phase 2 provides the reply
    for (let i = 0; i < 10; i++) {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: `call_loop_${i}`,
                  type: "function",
                  function: { name: "GetCases", arguments: "{}" },
                },
              ],
            },
          },
        ],
      });
    }
    // Phase 2: conversational response
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "Too many tool calls, but here is what I found.",
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
    expect(body.reply).toBe("Too many tool calls, but here is what I found.");
    expect(mockCreate).toHaveBeenCalledTimes(11);
  });
});
