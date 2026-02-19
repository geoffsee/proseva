import { describe, it, expect, vi, beforeEach } from "vitest";
import * as kv from "./kv";

// Mock idb-repo
vi.mock("idb-repo", () => ({
  createKV: vi.fn(() => ({
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  PassphraseEncryptionProvider: {
    create: vi.fn().mockResolvedValue({
      getSalt: vi.fn(() => new Uint8Array(16)),
    }),
  },
  WasmMlKemProvider: {
    fromKeys: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({
      exportKeys: vi.fn(() => ({
        publicKey: new Uint8Array(32),
        secretKey: new Uint8Array(32),
      })),
    }),
  },
  WebCryptoEncryptionProvider: vi.fn().mockImplementation(function () {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
    };
  }),
  kvGetJson: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();
vi.stubGlobal("localStorage", localStorageMock);

describe("kv", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await kv.resetKV();
  });

  it("initializes auth store", async () => {
    const store = await kv.initAuthStore();
    expect(store).toBeDefined();
    expect(localStorage.getItem("proseva-auth-device-key")).toBeDefined();
  });

  it("saves and loads auth token", async () => {
    await kv.initAuthStore();
    const store = kv.getAuthStore();
    vi.mocked(store.get).mockResolvedValue("test-token");

    await kv.saveAuthToken("test-token");
    expect(store.put).toHaveBeenCalledWith("auth-token", "test-token");

    const token = await kv.loadAuthToken();
    expect(token).toBe("test-token");
  });

  it("clears auth token", async () => {
    await kv.initAuthStore();
    const store = kv.getAuthStore();
    await kv.clearAuthToken();
    expect(store.delete).toHaveBeenCalledWith("auth-token");
  });

  it("initializes keys store", async () => {
    const store = await kv.initKeysStore("password");
    expect(store).toBeDefined();
    expect(localStorage.getItem("proseva-keys-store-salt")).toBeDefined();
  });

  it("throws if store accessed before init", () => {
    expect(() => kv.getDataStore()).toThrow("Data store not initialized");
    expect(() => kv.getKeysStore()).toThrow("Keys store not initialized");
  });
});
