import { applySnapshot } from "mobx-state-tree";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/kv", async () => {
  const actual = await vi.importActual<typeof import("../lib/kv")>("../lib/kv");
  return {
    ...actual,
    kvLoad: vi.fn(),
    kvSave: vi.fn(),
  };
});

import { STORAGE_KEYS, kvLoad, kvSave } from "../lib/kv";
import { createRootStore, hydrateStore } from "./RootStore";

const caseSnapshot = {
  id: "case-1",
  name: "Persisted Case",
  caseNumber: "CL-2026-1001",
  court: "Fairfax Circuit Court",
  caseType: "Civil",
  status: "active" as const,
  parties: [],
  filings: [],
  notes: "stored",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const deadlineSnapshot = {
  id: "deadline-1",
  caseId: "case-1",
  title: "Initial filing",
  date: "2026-03-01",
  type: "filing" as const,
  completed: false,
  description: "",
  priority: "high" as const,
};

const financeSnapshot = {
  id: "finance-1",
  category: "expense" as const,
  subcategory: "filing-fee",
  amount: 120,
  frequency: "one-time" as const,
  date: "2026-01-03",
  description: "Circuit filing fee",
};

const contactSnapshot = {
  id: "contact-1",
  name: "Jordan Clerk",
  role: "Clerk",
  organization: "Fairfax Circuit Court",
  phone: "",
  email: "",
  address: "",
  notes: "",
  caseId: "case-1",
};

const chatSnapshot = {
  id: "chat-1",
  role: "assistant" as const,
  text: "Persisted chat message",
  createdAt: "2026-01-04T00:00:00.000Z",
};

const noteSnapshot = {
  id: "note-1",
  title: "Persisted note",
  content: "This was loaded from storage",
  category: "general" as const,
  tags: ["storage"],
  caseId: "case-1",
  createdAt: "2026-01-05T00:00:00.000Z",
  updatedAt: "2026-01-05T00:00:00.000Z",
  isPinned: false,
};

const taskSnapshot = {
  id: "task-1",
  title: "Persisted task",
  description: "",
  status: "todo" as const,
  priority: "medium" as const,
  dueDate: null,
  createdAt: "2026-01-06T00:00:00.000Z",
  updatedAt: "2026-01-06T00:00:00.000Z",
};

const evidenceSnapshot = {
  id: "evidence-1",
  caseId: "case-1",
  exhibitNumber: "A-1",
  title: "Receipt",
  description: "",
  type: "document" as const,
  fileUrl: "",
  dateCollected: "2026-01-07",
  location: "Fairfax",
  tags: ["expense"],
  relevance: "high" as const,
  admissible: true,
  chain: [],
  notes: "",
  createdAt: "2026-01-07T00:00:00.000Z",
  updatedAt: "2026-01-07T00:00:00.000Z",
};

const filingSnapshot = {
  id: "filing-1",
  title: "Motion to compel",
  date: "2026-01-08",
  type: "motion",
  notes: "",
  caseId: "case-1",
};

const estatePlanSnapshot = {
  id: "estate-1",
  title: "Estate Plan",
  status: "planning" as const,
  testatorName: "Alex Smith",
  testatorDateOfBirth: "",
  testatorAddress: "",
  executorName: "",
  executorPhone: "",
  executorEmail: "",
  guardianName: "",
  guardianPhone: "",
  beneficiaries: [],
  assets: [],
  documents: [],
  notes: "",
  createdAt: "2026-01-09T00:00:00.000Z",
  updatedAt: "2026-01-09T00:00:00.000Z",
};

const researchSnapshot = {
  id: "research-1",
  role: "assistant" as const,
  text: "Persisted research",
  createdAt: "2026-01-10T00:00:00.000Z",
  toolResults: [],
};

function createLocalStorageMock(): Storage {
  const data: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const key of Object.keys(data)) delete data[key];
    },
    getItem(key: string) {
      return key in data ? data[key] : null;
    },
    key(index: number) {
      return Object.keys(data)[index] ?? null;
    },
    removeItem(key: string) {
      delete data[key];
    },
    setItem(key: string, value: string) {
      data[key] = String(value);
    },
  };
}

describe("RootStore persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("hydrates persisted data for all storage-backed stores", async () => {
    const persistedByKey: Record<string, unknown[]> = {
      [STORAGE_KEYS.cases]: [caseSnapshot],
      [STORAGE_KEYS.deadlines]: [deadlineSnapshot],
      [STORAGE_KEYS.finances]: [financeSnapshot],
      [STORAGE_KEYS.contacts]: [contactSnapshot],
      [STORAGE_KEYS.chat]: [chatSnapshot],
      [STORAGE_KEYS.notes]: [noteSnapshot],
      [STORAGE_KEYS.tasks]: [taskSnapshot],
      [STORAGE_KEYS.evidences]: [evidenceSnapshot],
      [STORAGE_KEYS.filings]: [filingSnapshot],
      [STORAGE_KEYS.estatePlans]: [estatePlanSnapshot],
      [STORAGE_KEYS.research]: [researchSnapshot],
    };

    vi.mocked(kvLoad).mockImplementation(async (key, fallback) => {
      return (persistedByKey[key] as typeof fallback | undefined) ?? fallback;
    });
    vi.mocked(kvSave).mockResolvedValue(undefined);

    const store = createRootStore();
    await hydrateStore(store);

    expect(store.isHydrated).toBe(true);
    expect(store.caseStore.cases[0].name).toBe("Persisted Case");
    expect(store.deadlineStore.deadlines[0].title).toBe("Initial filing");
    expect(store.financeStore.entries[0].amount).toBe(120);
    expect(store.contactStore.contacts[0].name).toBe("Jordan Clerk");
    expect(store.chatStore.messages[0].text).toBe("Persisted chat message");
    expect(store.noteStore.notes[0].title).toBe("Persisted note");
    expect(store.taskStore.tasks[0].title).toBe("Persisted task");
    expect(store.evidenceStore.evidences[0].title).toBe("Receipt");
    expect(store.filingStore.filings[0].title).toBe("Motion to compel");
    expect(store.estatePlanStore.plans[0].title).toBe("Estate Plan");
    expect(store.researchStore.messages[0].text).toBe("Persisted research");
  });

  it("migrates localStorage data into KV when KV is empty", async () => {
    const kvState: Record<string, unknown[] | null> = {
      [STORAGE_KEYS.cases]: null,
    };

    localStorage.setItem(STORAGE_KEYS.cases, JSON.stringify([caseSnapshot]));
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify([noteSnapshot]));

    vi.mocked(kvLoad).mockImplementation(async (key, fallback) => {
      return (kvState[key] as typeof fallback | undefined) ?? fallback;
    });
    vi.mocked(kvSave).mockImplementation(async (key, value) => {
      kvState[key] = value as unknown[];
    });

    const store = createRootStore();
    await hydrateStore(store);

    expect(store.isHydrated).toBe(true);
    expect(store.caseStore.cases).toHaveLength(1);
    expect(store.noteStore.notes).toHaveLength(1);
    expect(vi.mocked(kvSave)).toHaveBeenCalledTimes(
      Object.values(STORAGE_KEYS).length,
    );
    expect(localStorage.getItem(STORAGE_KEYS.cases)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.notes)).toBeNull();
  });

  it("persists debounced updates from multiple stores", async () => {
    vi.mocked(kvLoad).mockImplementation(async (_key, fallback) => fallback);
    vi.mocked(kvSave).mockResolvedValue(undefined);

    const store = createRootStore();
    await hydrateStore(store);

    applySnapshot(store.caseStore, { cases: [caseSnapshot] });
    applySnapshot(store.noteStore, { notes: [noteSnapshot] });
    applySnapshot(store.taskStore, { tasks: [taskSnapshot] });
    applySnapshot(store.researchStore, { messages: [researchSnapshot] });

    vi.advanceTimersByTime(199);
    expect(vi.mocked(kvSave)).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    const savedByKey = new Map<string, unknown>(
      vi
        .mocked(kvSave)
        .mock.calls.map(([key, value]) => [key, value] as const),
    );

    expect(savedByKey.get(STORAGE_KEYS.cases)).toEqual([caseSnapshot]);
    expect(savedByKey.get(STORAGE_KEYS.notes)).toEqual([noteSnapshot]);
    expect(savedByKey.get(STORAGE_KEYS.tasks)).toEqual([taskSnapshot]);
    expect(savedByKey.get(STORAGE_KEYS.research)).toEqual([researchSnapshot]);
  });
});
