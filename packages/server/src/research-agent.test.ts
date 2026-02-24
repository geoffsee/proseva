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
    executeExplorerTool: (...args: unknown[]) => mockExecuteExplorerTool(...args),
  };
});

import { handleResearchChat } from "./research-agent";
import { getConfig } from "./config";

// Mock the config to provide required values
vi.mock("./config", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getConfig: (key: string) => {
      const configMap: Record<string, string> = {
        OPENAI_API_KEY: "test-key",
        TEXT_MODEL_SMALL: "gpt-4o-mini",
        TEXT_MODEL_LARGE: "gpt-4o",
      };
      return configMap[key] || null;
    },
  };
});

describe("Research Agent", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockExecuteExplorerTool.mockReset();
  });

  it("executes tool calls with proper type compliance", async () => {
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
                  function: {
                    name: "search_opinions",
                    arguments: '{"query":"contract law"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                "I found relevant contract law opinions. Here are the key findings...",
            },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Find case law about contract law" },
    ]);

    expect(response.reply).toBeDefined();
    expect(typeof response.reply).toBe("string");
    expect(response.toolResults).toBeDefined();
    expect(Array.isArray(response.toolResults)).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("handles multiple sequential tool calls", async () => {
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
                    name: "search_opinions",
                    arguments: '{"query":"patent infringement"}',
                  },
                },
                {
                  id: "call_2",
                  type: "function",
                  function: {
                    name: "search_statutes",
                    arguments: '{"query":"patent","state":"US"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                "Based on my research, here is what I found about patents...",
            },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Research patent infringement laws" },
    ]);

    expect(response.reply).toBeDefined();
    expect(response.toolResults).toBeDefined();
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("handles citation lookup tool", async () => {
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
                    name: "lookup_citation",
                    arguments: '{"citation":"410 U.S. 113"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "Here is information about that landmark case...",
            },
          },
        ],
      });

    const response = await handleResearchChat([
      {
        role: "user",
        content: "What is the case at 410 U.S. 113?",
      },
    ]);

    expect(response.reply).toContain("landmark case");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("handles docket search tool", async () => {
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
                    name: "search_dockets",
                    arguments: '{"query":"class action","court":"ca4"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                "I found several class action dockets in the Fourth Circuit...",
            },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Find class action dockets in the Fourth Circuit" },
    ]);

    expect(response.reply).toContain("Fourth Circuit");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("handles government info search tool", async () => {
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
                    name: "search_govinfo",
                    arguments: '{"query":"bankruptcy","collection":"USCODE"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                "The United States Code contains several bankruptcy provisions...",
            },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Search government documents for bankruptcy law" },
    ]);

    expect(response.reply).toContain("bankruptcy");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("handles academic research search tool", async () => {
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
                    name: "search_academic",
                    arguments: '{"query":"tort reform"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                "Academic research on tort reform shows several perspectives...",
            },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Find academic papers on tort reform" },
    ]);

    expect(response.reply).toContain("tort reform");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("handles lawyer search tool", async () => {
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
                    name: "search_lawyers",
                    arguments: '{"location":"New York","specialty":"corporate"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content:
                "I found several corporate law attorneys in New York...",
            },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Find corporate law attorneys in New York" },
    ]);

    expect(response.reply).toContain("corporate");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("returns error when tool calls lack type property", async () => {
    // This test ensures that tool calls WITHOUT type property are skipped
    // which matches the implementation's check: if (toolCall.type !== "function") continue;
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              // Missing type property - should be skipped
              tool_calls: [
                {
                  id: "call_1",
                  function: {
                    name: "search_opinions",
                    arguments: '{"query":"test"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "No results found." },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Search for something" },
    ]);

    // Phase 1: tool_calls (skipped) → stop, Phase 2: final answer
    expect(response.reply).toBe("No results found.");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("handles mixed tool call types (skips non-function types)", async () => {
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
                    name: "search_opinions",
                    arguments: '{"query":"test"}',
                  },
                },
                {
                  id: "call_2",
                  type: "other_type",
                  function: {
                    name: "some_other_tool",
                    arguments: "{}",
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Research complete." },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Do research" },
    ]);

    expect(response.reply).toBe("Research complete.");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("reaches max iterations gracefully", async () => {
    // All 5 Phase 1 iterations return tool_calls, then Phase 2 provides the reply
    for (let i = 0; i < 5; i++) {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: `call_${i}`,
                  type: "function",
                  function: {
                    name: "search_opinions",
                    arguments: '{"query":"test"}',
                  },
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
          message: { content: "Research completed with available data." },
        },
      ],
    });

    const response = await handleResearchChat([
      { role: "user", content: "Research something" },
    ]);

    expect(response.reply).toBe("Research completed with available data.");
    expect(mockCreate).toHaveBeenCalledTimes(6);
  });

  it("handles malformed tool call arguments gracefully", async () => {
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
                    name: "search_opinions",
                    arguments: "{{invalid json",
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "Research completed with some limitations.",
            },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Search for cases" },
    ]);

    expect(response.reply).toBeDefined();
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("includes tool results in response", async () => {
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
                    name: "search_opinions",
                    arguments: '{"query":"contract"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Found relevant opinions." },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Search contract law" },
    ]);

    expect(response.toolResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "search_opinions",
        }),
      ])
    );
  });

  it("includes explorer tools in the tools sent to OpenAI", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Here is info." } },
        ],
      });

    await handleResearchChat([
      { role: "user", content: "Virginia FOIA" },
    ]);

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

  it("dispatches search_nodes explorer tool and accumulates result", async () => {
    mockExecuteExplorerTool.mockResolvedValue(
      JSON.stringify({ nodes: { total: 2, nodes: [{ id: 10 }, { id: 11 }] } }),
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
                  id: "call_ex_1",
                  type: "function",
                  function: {
                    name: "search_nodes",
                    arguments: '{"search":"jurisdiction","type":"section"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Found jurisdiction sections." },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Research Virginia court jurisdiction" },
    ]);

    expect(response.reply).toBe("Found jurisdiction sections.");
    expect(response.toolResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolName: "search_nodes" }),
      ]),
    );
    expect(mockExecuteExplorerTool).toHaveBeenCalledWith("search_nodes", {
      search: "jurisdiction",
      type: "section",
    });
  });

  it("dispatches get_node explorer tool", async () => {
    mockExecuteExplorerTool.mockResolvedValue(
      JSON.stringify({ node: { id: 10, sourceText: "Full text" } }),
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
                  id: "call_ex_2",
                  type: "function",
                  function: {
                    name: "get_node",
                    arguments: '{"id":10}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Here is the section." } },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Read node 10" },
    ]);

    expect(response.reply).toBe("Here is the section.");
    expect(mockExecuteExplorerTool).toHaveBeenCalledWith("get_node", { id: 10 });
  });

  it("handles explorer tool failure gracefully and accumulates error", async () => {
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
                  id: "call_ex_fail",
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
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Explorer unavailable, using other sources." },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Get knowledge graph stats" },
    ]);

    expect(response.reply).toBe("Explorer unavailable, using other sources.");
    expect(response.toolResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "get_stats",
          results: expect.objectContaining({ error: expect.any(String) }),
        }),
      ]),
    );
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("includes knowledge graph note in system prompt", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "OK." } },
        ],
      });

    await handleResearchChat([
      { role: "user", content: "hi" },
    ]);

    const firstCall = mockCreate.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content?: string }>;
    };
    const systemMessage = firstCall.messages?.find((m) => m.role === "system");
    expect(systemMessage?.content).toContain("knowledge graph");
    expect(systemMessage?.content).toContain("search_nodes");
  });

  it("handles mixed explorer and research tool calls in same turn", async () => {
    mockExecuteExplorerTool.mockResolvedValue(
      JSON.stringify({ nodes: { total: 1, nodes: [{ id: 5 }] } }),
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
                  id: "call_research",
                  type: "function",
                  function: {
                    name: "search_opinions",
                    arguments: '{"query":"FOIA Virginia"}',
                  },
                },
                {
                  id: "call_explorer",
                  type: "function",
                  function: {
                    name: "search_nodes",
                    arguments: '{"search":"FOIA"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Combined research results." },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Research Virginia FOIA" },
    ]);

    expect(response.reply).toBe("Combined research results.");
    expect(response.toolResults).toHaveLength(2);
    const toolNames = response.toolResults.map((r) => r.toolName);
    expect(toolNames).toContain("search_opinions");
    expect(toolNames).toContain("search_nodes");
  });

  it("Phase 2 uses TEXT_MODEL_LARGE without tools parameter", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Hello!" } },
        ],
      });

    await handleResearchChat([
      { role: "user", content: "hi" },
    ]);

    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Phase 1 call should have tools
    const phase1Call = mockCreate.mock.calls[0]?.[0] as {
      model?: string;
      tools?: unknown;
    };
    expect(phase1Call.tools).toBeDefined();
    expect(phase1Call.model).toBe("gpt-4o-mini");

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
                  function: {
                    name: "search_opinions",
                    arguments: '{"query":"test"}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: null } },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { finish_reason: "stop", message: { content: "Here are the opinions." } },
        ],
      });

    await handleResearchChat([
      { role: "user", content: "Search opinions" },
    ]);

    expect(mockCreate).toHaveBeenCalledTimes(3);

    // Phase 2 call should include an assistant message with tool results
    const phase2Call = mockCreate.mock.calls[2]?.[0] as {
      messages?: Array<{ role: string; content?: string }>;
    };
    const assistantContext = phase2Call.messages?.find(
      (m) => m.role === "assistant" && m.content?.includes("[search_opinions]:"),
    );
    expect(assistantContext).toBeDefined();
    expect(assistantContext?.content).toContain("I retrieved the following data");
  });
});
