import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the sw-bridge by loading it into an environment with a mock
// electronAPI and verifying that window.fetch is patched to intercept
// the correct URL prefixes.

const mockSend = vi.fn();
const originalFetch = vi.fn();
vi.stubGlobal("fetch", originalFetch);

const windowAny = window as any;

describe("sw-bridge fetch interception", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
    originalFetch.mockReset();
    originalFetch.mockResolvedValue(new Response("original"));
  });

  afterEach(() => {
    // Restore original fetch so later tests aren't affected
    vi.stubGlobal("fetch", originalFetch);
    delete windowAny.electronAPI;
  });

  async function loadBridge(withElectronAPI: boolean) {
    if (withElectronAPI) {
      windowAny.electronAPI = { send: mockSend };
    } else {
      delete windowAny.electronAPI;
    }
    // Import the module fresh — it patches window.fetch on load
    await import("./sw-bridge");
  }

  describe("with electronAPI present", () => {
    it("intercepts /api/ paths via IPC", async () => {
      mockSend.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { "content-type": "application/json" },
        text: '{"ok":true}',
      });
      await loadBridge(true);

      const res = await window.fetch("/api/health");
      expect(mockSend).toHaveBeenCalledOnce();
      expect(mockSend.mock.calls[0][0]).toBe("ipcMain-bridge-http");
      expect(res.status).toBe(200);
    });

    it("intercepts /explorer/ paths via IPC", async () => {
      mockSend.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { "content-type": "application/json" },
        text: '{"data":{"stats":{"nodeCount":42}}}',
      });
      await loadBridge(true);

      const res = await window.fetch("/explorer/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ stats { nodeCount } }" }),
      });
      expect(mockSend).toHaveBeenCalledOnce();
      const payload = mockSend.mock.calls[0][1];
      expect(payload.url).toContain("/explorer/graphql");
      expect(res.status).toBe(200);
    });

    it("does not intercept non-api/non-explorer paths", async () => {
      await loadBridge(true);

      await window.fetch("/some/other/path");
      expect(mockSend).not.toHaveBeenCalled();
      expect(originalFetch).toHaveBeenCalledOnce();
    });

    it("does not intercept plain root path", async () => {
      await loadBridge(true);

      await window.fetch("/");
      expect(mockSend).not.toHaveBeenCalled();
      expect(originalFetch).toHaveBeenCalledOnce();
    });
  });

  describe("without electronAPI", () => {
    it("does not intercept /api/ paths", async () => {
      await loadBridge(false);

      await window.fetch("/api/health");
      expect(mockSend).not.toHaveBeenCalled();
      expect(originalFetch).toHaveBeenCalledOnce();
    });

    it("does not intercept /explorer/ paths", async () => {
      await loadBridge(false);

      await window.fetch("/explorer/graphql");
      expect(mockSend).not.toHaveBeenCalled();
      expect(originalFetch).toHaveBeenCalledOnce();
    });
  });
});
