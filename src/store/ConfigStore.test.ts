import { describe, it, expect, vi } from "vitest";
import { ConfigStore } from "./ConfigStore";
import * as apiModule from "../lib/api";

vi.spyOn(apiModule.api.config, "get").mockResolvedValue({} as any);
vi.spyOn(apiModule.api.config, "update").mockResolvedValue({ success: true });
vi.spyOn(apiModule.api.config, "reset").mockResolvedValue({ success: true });
vi.spyOn(apiModule.api.config, "deleteKey").mockResolvedValue({
  success: true,
});
vi.spyOn(apiModule.api.config, "testFirebase").mockResolvedValue({
  success: true,
});
vi.spyOn(apiModule.api.config, "testTwilio").mockResolvedValue({
  success: true,
});
vi.spyOn(apiModule.api.config, "testOpenAI").mockResolvedValue({
  success: true,
});
vi.spyOn(apiModule.api.config, "reinitialize").mockResolvedValue({
  success: true,
});

function createStore() {
  return ConfigStore.create({});
}

describe("ConfigStore", () => {
  it("loadConfig loads config from api", async () => {
    const mockConfig = { ai: { openaiApiKey: "test-key" } };
    vi.spyOn(apiModule.api.config, "get").mockResolvedValue(mockConfig as any);

    const store = createStore();
    await store.loadConfig();

    expect(store.config?.ai?.openaiApiKey).toBe("test-key");
    expect(apiModule.api.config.get).toHaveBeenCalled();
  });

  it("updateConfig updates and reloads", async () => {
    const store = createStore();
    const updateSpy = vi.spyOn(apiModule.api.config, "update");
    const getSpy = vi
      .spyOn(apiModule.api.config, "get")
      .mockResolvedValue({ ai: { openaiApiKey: "updated" } } as any);

    await store.updateConfig({ ai: { openaiApiKey: "updated" } });

    expect(updateSpy).toHaveBeenCalledWith({ ai: { openaiApiKey: "updated" } });
    expect(getSpy).toHaveBeenCalled();
    expect(store.config?.ai?.openaiApiKey).toBe("updated");
  });

  it("resetConfig resets and reloads", async () => {
    const store = createStore();
    const resetSpy = vi.spyOn(apiModule.api.config, "reset");
    const getSpy = vi.spyOn(apiModule.api.config, "get");

    await store.resetConfig();

    expect(resetSpy).toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalled();
  });

  it("deleteConfigKey deletes and reloads", async () => {
    const store = createStore();
    const deleteSpy = vi.spyOn(apiModule.api.config, "deleteKey");
    const getSpy = vi.spyOn(apiModule.api.config, "get");

    await store.deleteConfigKey("ai", "openaiApiKey");

    expect(deleteSpy).toHaveBeenCalledWith("ai", "openaiApiKey");
    expect(getSpy).toHaveBeenCalled();
  });

  it("testFirebase returns success", async () => {
    const store = createStore();
    vi.spyOn(apiModule.api.config, "testFirebase").mockResolvedValue({
      success: true,
    });

    const result = await store.testFirebase();

    expect(result.success).toBe(true);
    expect(apiModule.api.config.testFirebase).toHaveBeenCalled();
  });

  it("testTwilio returns success", async () => {
    const store = createStore();
    vi.spyOn(apiModule.api.config, "testTwilio").mockResolvedValue({
      success: true,
    });

    const result = await store.testTwilio("1234567890");

    expect(result.success).toBe(true);
    expect(apiModule.api.config.testTwilio).toHaveBeenCalledWith("1234567890");
  });

  it("testOpenAI returns success", async () => {
    const store = createStore();
    vi.spyOn(apiModule.api.config, "testOpenAI").mockResolvedValue({
      success: true,
    });

    const result = await store.testOpenAI();

    expect(result.success).toBe(true);
    expect(apiModule.api.config.testOpenAI).toHaveBeenCalled();
  });

  it("reinitializeService calls api", async () => {
    const store = createStore();
    const reinitSpy = vi.spyOn(apiModule.api.config, "reinitialize");

    await store.reinitializeService("firebase");

    expect(reinitSpy).toHaveBeenCalledWith("firebase");
  });
});
