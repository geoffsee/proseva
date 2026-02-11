import { types, onSnapshot, applySnapshot, type SnapshotIn } from "mobx-state-tree";
import { CaseStore } from "./CaseStore";
import { DeadlineStore } from "./DeadlineStore";
import { FinanceStore } from "./FinanceStore";
import { ContactStore } from "./ContactStore";
import { ChatStore } from "./ChatStore";
import { DocumentStore } from "./DocumentStore";
import { NoteStore } from "./NoteStore";
import { TaskStore } from "./TaskStore";
import { EvidenceStore } from "./EvidenceStore";
import { FilingStore } from "./FilingStore";
import { EvaluationStore } from "./EvaluationStore";
import { ConfigStore } from "./ConfigStore";
import { EstatePlanStore } from "./EstatePlanStore";
import { ResearchStore } from "./ResearchStore";
import { STORAGE_KEYS, kvLoad, kvSave } from "../lib/kv";

export const RootStore = types
  .model("RootStore", {
    caseStore: CaseStore,
    deadlineStore: DeadlineStore,
    financeStore: FinanceStore,
    contactStore: ContactStore,
    chatStore: ChatStore,
    documentStore: DocumentStore,
    noteStore: NoteStore,
    taskStore: TaskStore,
    evidenceStore: EvidenceStore,
    filingStore: FilingStore,
    evaluationStore: EvaluationStore,
    configStore: ConfigStore,
    estatePlanStore: EstatePlanStore,
    researchStore: ResearchStore,
  })
  .volatile(() => ({
    isHydrated: false,
  }))
  .actions((self) => ({
    setHydrated() {
      self.isHydrated = true;
    },
  }));

export type IRootStore = ReturnType<typeof RootStore.create>;
type CaseSnapshot = SnapshotIn<typeof CaseStore>;

/**
 * Creates a root store with empty defaults (sync, instant).
 * Call hydrateStore() afterward to load persisted data from idb-repo.
 */
export function createRootStore(): IRootStore {
  return RootStore.create({
    caseStore: { cases: [] },
    deadlineStore: {
      deadlines: [],
      selectedType: "all",
      selectedUrgency: "all",
      selectedCaseId: "all",
      searchQuery: "",
    },
    financeStore: { entries: [] },
    contactStore: { contacts: [] },
    chatStore: { messages: [] },
    documentStore: { documents: [] },
    noteStore: { notes: [] },
    taskStore: { tasks: [] },
    evidenceStore: {
      evidences: [],
      selectedType: "all",
      selectedRelevance: "all",
      selectedCaseId: "all",
      selectedAdmissible: "all",
      searchQuery: "",
    },
    filingStore: {
      filings: [],
      selectedType: "all",
      selectedCaseId: "all",
      searchQuery: "",
      dateFrom: "",
      dateTo: "",
    },
    evaluationStore: {
      evaluations: [],
      deviceTokens: [],
      smsRecipients: [],
      schedulerStatus: null,
      isLoading: false,
      isTriggering: false,
    },
    configStore: {
      config: null,
      isLoading: false,
      isTesting: false,
      error: null,
    },
    estatePlanStore: {
      plans: [],
      selectedStatus: "all",
      searchQuery: "",
    },
    researchStore: {
      messages: [],
    },
  });
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}

/**
 * Check if there's existing data in localStorage that needs migration to idb-repo.
 */
function migrateFromLocalStorage(): Record<string, unknown[]> | null {
  const keys = Object.values(STORAGE_KEYS);
  const hasAnyData = keys.some((key) => localStorage.getItem(key) !== null);
  if (!hasAnyData) return null;

  const migrated: Record<string, unknown[]> = {};
  for (const key of keys) {
    migrated[key] = loadJSON(key, []);
  }
  return migrated;
}

/**
 * Hydrate the store from idb-repo KV data store (async).
 * Falls back to localStorage migration if KV is empty.
 * Registers onSnapshot watchers for async persistence after hydration.
 */
export async function hydrateStore(store: IRootStore): Promise<void> {
  // Try loading from KV first
  let cases: unknown[] | null;
  try {
    cases = await kvLoad<unknown[] | null>(STORAGE_KEYS.cases, null);
  } catch {
    // KV not initialized (e.g., test environment without encryption setup).
    // Keep the empty defaults from createRootStore() and skip hydration.
    registerPersistenceWatchers(store);
    store.setHydrated();
    return;
  }

  // If KV is empty, try migrating from localStorage
  if (cases === null) {
    const migrated = migrateFromLocalStorage();
    if (migrated) {
      // Write all migrated data to KV
      await Promise.all(
        Object.entries(migrated).map(([key, value]) => kvSave(key, value)),
      );
      // Clear localStorage after successful migration
      for (const key of Object.values(STORAGE_KEYS)) {
        localStorage.removeItem(key);
      }
      cases = migrated[STORAGE_KEYS.cases] ?? [];
    } else {
      cases = [];
    }
  }

  // Load remaining keys from KV (cases already loaded above)
  const [
    deadlines,
    finances,
    contacts,
    chat,
    notes,
    tasks,
    evidences,
    filings,
    estatePlans,
    research,
  ] = await Promise.all([
    kvLoad(STORAGE_KEYS.deadlines, []),
    kvLoad(STORAGE_KEYS.finances, []),
    kvLoad(STORAGE_KEYS.contacts, []),
    kvLoad(STORAGE_KEYS.chat, []),
    kvLoad(STORAGE_KEYS.notes, []),
    kvLoad(STORAGE_KEYS.tasks, []),
    kvLoad(STORAGE_KEYS.evidences, []),
    kvLoad(STORAGE_KEYS.filings, []),
    kvLoad(STORAGE_KEYS.estatePlans, []),
    kvLoad(STORAGE_KEYS.research, []),
  ]);

  // Apply snapshots to hydrate the store
  applySnapshot(store.caseStore, {
    cases: cases as CaseSnapshot["cases"],
  });
  applySnapshot(store.deadlineStore, {
    deadlines,
    selectedType: "all",
    selectedUrgency: "all",
    selectedCaseId: "all",
    searchQuery: "",
  });
  applySnapshot(store.financeStore, { entries: finances });
  applySnapshot(store.contactStore, { contacts });
  applySnapshot(store.chatStore, { messages: chat });
  applySnapshot(store.noteStore, { notes });
  applySnapshot(store.taskStore, { tasks });
  applySnapshot(store.evidenceStore, {
    evidences,
    selectedType: "all",
    selectedRelevance: "all",
    selectedCaseId: "all",
    selectedAdmissible: "all",
    searchQuery: "",
  });
  applySnapshot(store.filingStore, {
    filings,
    selectedType: "all",
    selectedCaseId: "all",
    searchQuery: "",
    dateFrom: "",
    dateTo: "",
  });
  applySnapshot(store.estatePlanStore, {
    plans: estatePlans,
    selectedStatus: "all",
    searchQuery: "",
  });
  applySnapshot(store.researchStore, { messages: research });

  // Register debounced onSnapshot watchers AFTER hydration to avoid
  // persisting the empty defaults that were set during construction.
  registerPersistenceWatchers(store);

  store.setHydrated();
}

function createDebouncedPersister(key: string, delayMs = 200) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (data: unknown) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      void kvSave(key, data).catch((err: unknown) =>
        console.error(`Failed to persist ${key}:`, err),
      );
    }, delayMs);
  };
}

function registerPersistenceWatchers(store: IRootStore): void {
  const persistCases = createDebouncedPersister(STORAGE_KEYS.cases);
  const persistDeadlines = createDebouncedPersister(STORAGE_KEYS.deadlines);
  const persistFinances = createDebouncedPersister(STORAGE_KEYS.finances);
  const persistContacts = createDebouncedPersister(STORAGE_KEYS.contacts);
  const persistChat = createDebouncedPersister(STORAGE_KEYS.chat);
  const persistNotes = createDebouncedPersister(STORAGE_KEYS.notes);
  const persistTasks = createDebouncedPersister(STORAGE_KEYS.tasks);
  const persistEvidences = createDebouncedPersister(STORAGE_KEYS.evidences);
  const persistFilings = createDebouncedPersister(STORAGE_KEYS.filings);
  const persistEstatePlans = createDebouncedPersister(STORAGE_KEYS.estatePlans);
  const persistResearch = createDebouncedPersister(STORAGE_KEYS.research);

  onSnapshot(store.caseStore, (snap) => persistCases(snap.cases));
  onSnapshot(store.deadlineStore, (snap) => persistDeadlines(snap.deadlines));
  onSnapshot(store.financeStore, (snap) => persistFinances(snap.entries));
  onSnapshot(store.contactStore, (snap) => persistContacts(snap.contacts));
  onSnapshot(store.chatStore, (snap) => persistChat(snap.messages));
  onSnapshot(store.noteStore, (snap) => persistNotes(snap.notes));
  onSnapshot(store.taskStore, (snap) => persistTasks(snap.tasks));
  onSnapshot(store.evidenceStore, (snap) => persistEvidences(snap.evidences));
  onSnapshot(store.filingStore, (snap) => persistFilings(snap.filings));
  onSnapshot(store.estatePlanStore, (snap) => persistEstatePlans(snap.plans));
  onSnapshot(store.researchStore, (snap) => persistResearch(snap.messages));
}
