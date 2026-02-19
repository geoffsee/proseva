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
      };
      return configMap[key] || null;
    },
  };
});

describe("Research Agent", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("executes tool calls with proper type compliance", async () => {
    // First call returns tool_calls with type property, second returns final answer
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
          {
            finish_reason: "stop",
            message: { content: "No results found." },
          },
        ],
      });

    const response = await handleResearchChat([
      { role: "user", content: "Search for something" },
    ]);

    // When tool calls are skipped due to missing type, the response should be
    // from the second API call which returns the fallback message
    expect(response.reply).toBe("No results found.");
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("reaches max iterations gracefully", async () => {
    // Mock 5 responses that all return tool_calls (will hit max iterations of 5)
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

    const response = await handleResearchChat([
      { role: "user", content: "Research something" },
    ]);

    // After 5 iterations, should return with empty content
    expect(response.reply).toBeDefined();
    expect(mockCreate).toHaveBeenCalledTimes(5);
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
    expect(mockCreate).toHaveBeenCalledTimes(2);
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
});
