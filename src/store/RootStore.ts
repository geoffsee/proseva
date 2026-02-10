import { types, onSnapshot } from "mobx-state-tree";
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

export const RootStore = types.model("RootStore", {
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
});

export type IRootStore = ReturnType<typeof RootStore.create>;

const STORAGE_KEYS = {
  cases: "cases",
  deadlines: "deadlines",
  finances: "finances",
  contacts: "contacts",
  chat: "chat",
  notes: "notes",
  tasks: "tasks",
  evidences: "evidences",
  filings: "filings",
  estatePlans: "estate_plans",
} as const;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}

export function createRootStore(): IRootStore {
  const store = RootStore.create({
    caseStore: { cases: loadJSON(STORAGE_KEYS.cases, []) },
    deadlineStore: {
      deadlines: loadJSON(STORAGE_KEYS.deadlines, []),
      selectedType: "all",
      selectedUrgency: "all",
      selectedCaseId: "all",
      searchQuery: "",
    },
    financeStore: { entries: loadJSON(STORAGE_KEYS.finances, []) },
    contactStore: { contacts: loadJSON(STORAGE_KEYS.contacts, []) },
    chatStore: { messages: loadJSON(STORAGE_KEYS.chat, []) },
    documentStore: { documents: [] },
    noteStore: { notes: loadJSON(STORAGE_KEYS.notes, []) },
    taskStore: { tasks: loadJSON(STORAGE_KEYS.tasks, []) },
    evidenceStore: {
      evidences: loadJSON(STORAGE_KEYS.evidences, []),
      selectedType: "all",
      selectedRelevance: "all",
      selectedCaseId: "all",
      selectedAdmissible: "all",
      searchQuery: "",
    },
    filingStore: {
      filings: loadJSON(STORAGE_KEYS.filings, []),
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
      plans: loadJSON(STORAGE_KEYS.estatePlans, []),
      selectedStatus: "all",
      searchQuery: "",
    },
  });

  onSnapshot(store.caseStore, (snap) => {
    localStorage.setItem(STORAGE_KEYS.cases, JSON.stringify(snap.cases));
  });
  onSnapshot(store.deadlineStore, (snap) => {
    localStorage.setItem(
      STORAGE_KEYS.deadlines,
      JSON.stringify(snap.deadlines),
    );
  });
  onSnapshot(store.financeStore, (snap) => {
    localStorage.setItem(STORAGE_KEYS.finances, JSON.stringify(snap.entries));
  });
  onSnapshot(store.contactStore, (snap) => {
    localStorage.setItem(STORAGE_KEYS.contacts, JSON.stringify(snap.contacts));
  });
  onSnapshot(store.chatStore, (snap) => {
    localStorage.setItem(STORAGE_KEYS.chat, JSON.stringify(snap.messages));
  });
  onSnapshot(store.noteStore, (snap) => {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(snap.notes));
  });
  onSnapshot(store.taskStore, (snap) => {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(snap.tasks));
  });
  onSnapshot(store.evidenceStore, (snap) => {
    localStorage.setItem(
      STORAGE_KEYS.evidences,
      JSON.stringify(snap.evidences),
    );
  });
  onSnapshot(store.filingStore, (snap) => {
    localStorage.setItem(STORAGE_KEYS.filings, JSON.stringify(snap.filings));
  });
  onSnapshot(store.estatePlanStore, (snap) => {
    localStorage.setItem(STORAGE_KEYS.estatePlans, JSON.stringify(snap.plans));
  });

  return store;
}
