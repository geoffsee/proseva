import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configRouter } from "./config-api";
import { resetDb } from "./db";
import { InMemoryAdapter } from "./persistence";

function setAiConfig(values: {
  openaiApiKey?: string;
  openaiEndpoint?: string;
}) {
  const now = new Date().toISOString();
  const response = configRouter.fetch(
    new Request("http://localhost/api/config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ai: {
          ...values,
          selectedModels: [],
        },
        createdAt: now,
        updatedAt: now,
      }),
    }),
  );
  return response;
}

describe("config API openai-models", () => {
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    resetDb(new InMemoryAdapter());
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }
  });

  it("returns 400 when OpenAI API key is not configured", async () => {
    const response = await configRouter.fetch(
      new Request("http://localhost/api/config/openai-models"),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("API key");
  });

  it("uses default OpenAI models endpoint when endpoint is not configured", async () => {
    await setAiConfig({ openaiApiKey: "test-key" });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "gpt-4o-mini" }, { id: "gpt-4o" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await configRouter.fetch(
      new Request("http://localhost/api/config/openai-models"),
    );
    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://api.openai.com/v1/models",
    );

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.models).toEqual(["gpt-4o", "gpt-4o-mini"]);
  });

  it("normalizes configured endpoint to /v1/models", async () => {
    await setAiConfig({
      openaiApiKey: "test-key",
      openaiEndpoint: "https://example-openai.local/custom-prefix",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "model-a" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const response = await configRouter.fetch(
      new Request("http://localhost/api/config/openai-models"),
    );
    expect(response.status).toBe(200);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://example-openai.local/custom-prefix/v1/models",
    );
  });
});
