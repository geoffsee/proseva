import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockEmbeddingsCreate = vi.fn();
const mockSearchKnowledge = vi.fn();
const mockGetEmbeddingDim = vi.fn();
const mockCallKnowledgeTool = vi.fn();
const mockGetKnowledgeTools = vi.fn();
const mockCallCaseTool = vi.fn();
const mockGetCaseTools = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    embeddings = { create: mockEmbeddingsCreate };
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

vi.mock("../mcp-knowledge-client", () => ({
  searchKnowledge: (...args: unknown[]) => mockSearchKnowledge(...args),
  getEmbeddingDim: (...args: unknown[]) => mockGetEmbeddingDim(...args),
  callKnowledgeTool: (...args: unknown[]) => mockCallKnowledgeTool(...args),
  getKnowledgeTools: (...args: unknown[]) => mockGetKnowledgeTools(...args),
  closeMcpClient: vi.fn(),
}));

vi.mock("../mcp-case-client", () => ({
  callCaseTool: (...args: unknown[]) => mockCallCaseTool(...args),
  getCaseTools: (...args: unknown[]) => mockGetCaseTools(...args),
  closeCaseMcpClient: vi.fn(),
}));

import { setupTestServer, api } from "../test-helpers";
import { db, type Contact } from "../db";

const ctx = setupTestServer();

describe("Chat API", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockEmbeddingsCreate.mockReset();
    mockSearchKnowledge.mockReset();
    mockGetEmbeddingDim.mockReset();
    mockCallKnowledgeTool.mockReset();
    mockGetKnowledgeTools.mockReset();
    mockCallCaseTool.mockReset();
    mockGetCaseTools.mockReset();
    delete process.env.CHAT_DETERMINISTIC_GRAPH;
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
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });
    mockGetEmbeddingDim.mockResolvedValue(3);
    mockCallCaseTool.mockResolvedValue("[]");
    mockCallKnowledgeTool.mockResolvedValue("{}");
    mockGetCaseTools.mockResolvedValue([
      {
        type: "function",
        function: {
          name: "GetCases",
          description: "List all cases",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDeadlines",
          description: "List deadlines",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "GetContacts",
          description: "List contacts",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "GetFinances",
          description: "List finances",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDocuments",
          description: "List documents",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "GetDocumentText",
          description: "Get document text",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "SearchTimeline",
          description: "Search timeline",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
    mockGetKnowledgeTools.mockResolvedValue([
      {
        type: "function",
        function: {
          name: "SearchKnowledge",
          description: "Semantic retrieval for legal knowledge",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_stats",
          description: "Dataset stats",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "search_nodes",
          description: "Search legal nodes",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_node",
          description: "Get legal node",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_neighbors",
          description: "Get related legal nodes",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "find_similar",
          description: "Find similar legal nodes",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
    mockSearchKnowledge.mockResolvedValue({
      answers: [
        {
          node_id: 1,
          source: "va-code",
          source_id: "20-124.3",
          node_type: "section",
          content: "Best interests of the child factors include age and condition.",
          score: 0.99,
          semantic_score: 0.99,
          lexical_score: 0.5,
          graph_coherence: 0.3,
        },
      ],
      context: [],
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
    expect(mockCreate).toHaveBeenCalledTimes(4);
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

  it("handles SearchKnowledge tool", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_search_knowledge",
                  type: "function",
                  function: {
                    name: "SearchKnowledge",
                    arguments:
                      '{"query":"best interests of the child","topK":1}',
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
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "I found one relevant knowledge result." },
          },
        ],
      });

    const res = await api.post(
      "/api/chat",
      {
        messages: [{ role: "user", content: "search legal knowledge" }],
      },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("I found one relevant knowledge result.");
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: "octen-embedding-0.6b",
      input: "best interests of the child",
      encoding_format: "float",
    });
    expect(mockSearchKnowledge).toHaveBeenCalled();
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
    expect(mockCreate).toHaveBeenCalledTimes(3);

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

  it("includes knowledge MCP tools in the tools array sent to OpenAI", async () => {
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

  it("dispatches search_nodes knowledge tool call and returns result", async () => {
    mockCallKnowledgeTool.mockResolvedValue(
      JSON.stringify({
        total: 1,
        nodes: [{ id: 42, source_id: "§2.2-3700" }],
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
    expect(mockCallKnowledgeTool).toHaveBeenCalledWith("search_nodes", {
      search: "FOIA",
      type: "section",
    });
    expect(mockCreate).toHaveBeenCalledTimes(4);
  });

  it("forces SearchKnowledge when search_nodes returns zero repeatedly", async () => {
    mockCallKnowledgeTool.mockResolvedValue(
      JSON.stringify({
        total: 0,
        nodes: [],
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
                  id: "call_explorer_empty_1",
                  type: "function",
                  function: {
                    name: "search_nodes",
                    arguments: '{"search":"legal custody","type":"section"}',
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
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_explorer_empty_2",
                  type: "function",
                  function: {
                    name: "search_nodes",
                    arguments: '{"search":"physical custody","type":"section"}',
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
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "I found additional details from knowledge." },
          },
        ],
      });

    const originalQuery =
      "Search your knowledge for more details about legal vs physical custody in Virginia";

    const res = await api.post(
      "/api/chat",
      { messages: [{ role: "user", content: originalQuery }] },
      ctx.baseUrl,
    );
    const body = await res.json();
    expect(body.reply).toBe("I found additional details from knowledge.");

    expect(mockCallKnowledgeTool).toHaveBeenCalledTimes(2);
    expect(mockCallKnowledgeTool).toHaveBeenNthCalledWith(1, "search_nodes", {
      search: "legal custody",
      type: "section",
    });
    expect(mockCallKnowledgeTool).toHaveBeenNthCalledWith(2, "search_nodes", {
      search: "physical custody",
      type: "section",
    });
    expect(mockSearchKnowledge).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(5);
  });

  it("dispatches get_node knowledge tool call", async () => {
    mockCallKnowledgeTool.mockResolvedValue(
      JSON.stringify({ id: 42, source_text: "Full FOIA text here" }),
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
    expect(mockCallKnowledgeTool).toHaveBeenCalledWith("get_node", {
      id: 42,
    });
  });

  it("handles knowledge tool failure gracefully", async () => {
    mockCallKnowledgeTool.mockResolvedValue(
      JSON.stringify({ error: "Knowledge tool 'get_stats' failed: ECONNREFUSED" }),
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
    expect(mockCreate).toHaveBeenCalledTimes(4);
  });

  it("includes knowledge tool note in system prompt", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
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

    expect(mockCreate).toHaveBeenCalledTimes(3);

    // Phase 1 call should have tools
    const phase1Call = mockCreate.mock.calls[0]?.[0] as {
      model?: string;
      tools?: unknown;
    };
    expect(phase1Call.tools).toBeDefined();

    // Phase 2 call should NOT have tools and should use TEXT_MODEL_LARGE
    const phase2Call = mockCreate.mock.calls[2]?.[0] as {
      model?: string;
      tools?: unknown;
    };
    expect(phase2Call.tools).toBeUndefined();
    expect(phase2Call.model).toBe("gpt-4o");
  });

  it("builds optimized tool-calling context for follow-up turns", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "optimized custody query with virginia code" },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: null } }],
      })
      .mockResolvedValueOnce({
        choices: [{ finish_reason: "stop", message: { content: "Done." } }],
      });

    await api.post(
      "/api/chat",
      {
        messages: [
          {
            role: "assistant",
            content:
              "Legal custody is decision-making authority. Physical custody is residence/time.",
          },
          {
            role: "user",
            content: "Search your knowledge for more details.",
          },
        ],
      },
      ctx.baseUrl,
    );

    const optimizationCall = mockCreate.mock.calls[0]?.[0] as {
      tools?: unknown;
      messages?: Array<{ role: string; content?: string }>;
    };
    expect(optimizationCall.tools).toBeUndefined();
    const optimizationUserPrompt = optimizationCall.messages?.find(
      (m) => m.role === "user",
    );
    expect(optimizationUserPrompt?.content).toContain(
      "Merge the former assistant response and latest user message",
    );
    expect(optimizationUserPrompt?.content).toContain("Tool semantics:");
    expect(optimizationUserPrompt?.content).toContain("SearchKnowledge");
    expect(optimizationUserPrompt?.content).toContain("search_nodes");
    expect(optimizationUserPrompt?.content).toContain("get_node");

    const phase1Call = mockCreate.mock.calls[1]?.[0] as {
      tools?: unknown;
      messages?: Array<{ role: string; content?: string }>;
    };
    expect(phase1Call.tools).toBeDefined();
    const optimizedContextSystem = phase1Call.messages?.find(
      (m) =>
        m.role === "system" &&
        (m.content ?? "").includes("Tool-calling optimized context"),
    );
    expect(optimizedContextSystem?.content).toContain(
      "optimized custody query with virginia code",
    );
  });

  it("uses deterministic GraphQL orchestration for legal queries when enabled", async () => {
    process.env.CHAT_DETERMINISTIC_GRAPH = "1";
    const realFetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/graphql")) {
          const body =
            typeof init?.body === "string" ? init.body : String(init?.body ?? "");
          if (body.includes("IntrospectQueryRoot") || body.includes("__schema")) {
            return new Response(
              JSON.stringify({
                data: {
                  __schema: {
                    queryType: {
                      name: "Query",
                      fields: [
                        {
                          name: "nodes",
                          args: [
                            { name: "type", type: { kind: "SCALAR", name: "String" } },
                            { name: "search", type: { kind: "SCALAR", name: "String" } },
                            { name: "limit", type: { kind: "SCALAR", name: "Int" } },
                            { name: "offset", type: { kind: "SCALAR", name: "Int" } },
                          ],
                          type: { kind: "OBJECT", name: "NodeConnection" },
                        },
                        {
                          name: "node",
                          args: [
                            {
                              name: "id",
                              type: {
                                kind: "NON_NULL",
                                ofType: { kind: "SCALAR", name: "Int" },
                              },
                            },
                          ],
                          type: { kind: "OBJECT", name: "Node" },
                        },
                      ],
                    },
                  },
                },
              }),
              {
                status: 200,
                headers: { "content-type": "application/json" },
              },
            );
          }
          return new Response(
            JSON.stringify({
              data: {
                nodes: {
                  total: 1,
                  nodes: [
                    {
                      id: 42,
                      source: "virginia_code",
                      sourceId: "20-124.3",
                      nodeType: "section",
                      sourceText:
                        "In determining custody, the court shall consider the best interests of the child.",
                    },
                  ],
                },
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return realFetch(input, init);
      },
    );

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "optimized legal retrieval context for custody in virginia",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                intent: "custody distinction",
                queries: [
                  {
                    purpose: "find custody statutes",
                    query:
                      "query ($search: String, $type: String, $limit: Int, $offset: Int) { nodes(type: $type, search: $search, limit: $limit, offset: $offset) { total nodes { id source sourceId nodeType sourceText } } }",
                    variables: {
                      search: "custody",
                      type: "section",
                      limit: 3,
                      offset: 0,
                    },
                  },
                ],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                '{"intent":"custody distinction","key_findings":["legal vs physical custody differ"],"legal_chunks":[{"source":"virginia_code","source_id":"20-124.3","content":"best interests of the child"}],"gaps":"none","confidence":"high"}',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "Legal custody is decision authority; physical custody is residence/time.",
            },
          },
        ],
      });

    try {
      const res = await api.post(
        "/api/chat",
        {
          messages: [
            {
              role: "assistant",
              content: "Legal custody is decision-making authority.",
            },
            {
              role: "user",
              content:
                "Explain the difference between legal custody and physical custody in Virginia.",
            },
          ],
        },
        ctx.baseUrl,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.reply).toBe("string");
      expect(body.reply).toContain("Legal custody is decision authority");
      const graphqlCalls = fetchSpy.mock.calls.filter((call) => {
        const input = call[0];
        const url = typeof input === "string" ? input : input.toString();
        return url.includes("/graphql");
      });
      expect(graphqlCalls.length).toBe(2);
      expect(mockCreate).toHaveBeenCalledTimes(4);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.CHAT_DETERMINISTIC_GRAPH;
    }
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

    expect(mockCreate).toHaveBeenCalledTimes(4);

    // Phase 2 call should reuse tool transcript (tool role message present)
    const phase2Call = mockCreate.mock.calls[3]?.[0] as {
      messages?: Array<{ role: string; content?: string | null }>;
    };
    const toolContext = phase2Call.messages?.find((m) => m.role === "tool");
    expect(toolContext).toBeDefined();
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
      choices: [{ finish_reason: "stop", message: { content: null } }],
    });
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
    expect(mockCreate).toHaveBeenCalledTimes(12);
  });
});
