import {
  type PersistenceAdapter,
  ElectronIdbRepoAdapter,
  LocalFileAdapter,
  InMemoryAdapter,
} from "./persistence";
import {
  type DatabaseSnapshot,
  type EncryptionFailureReason,
  DatabaseEncryptionError,
  normalizePassphrase,
  setPassphrase as setEncryptionPassphrase,
  hasPassphrase as hasEncryptionPassphrase,
  isEncryptedSnapshot,
  decryptSnapshot,
  encryptSnapshot,
} from "./encryption";
export type { PersistenceAdapter };

export type Case = {
  id: string;
  name: string;
  caseNumber: string;
  court: string;
  caseType: string;
  status: "active" | "closed" | "pending";
  parties: Party[];
  filings: Filing[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Party = {
  id: string;
  name: string;
  role: string;
  contact: string;
};

export type Filing = {
  id: string;
  title: string;
  date: string;
  type: string;
  notes: string;
  caseId: string;
};

export type Contact = {
  id: string;
  name: string;
  role: string;
  organization: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  caseId: string;
};

export type Deadline = {
  id: string;
  caseId: string;
  title: string;
  date: string;
  type: "filing" | "hearing" | "discovery" | "other";
  completed: boolean;
};

export type FinancialEntry = {
  id: string;
  category: "income" | "expense";
  subcategory: string;
  amount: number;
  frequency: "one-time" | "weekly" | "biweekly" | "monthly" | "annually";
  date: string;
  description: string;
};

export type ChainOfCustodyEntry = {
  id: string;
  date: string;
  transferredFrom: string;
  transferredTo: string;
  purpose: string;
  notes: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  category: "case-notes" | "research" | "todo" | "general" | "other";
  tags: string[];
  caseId: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeviceToken = {
  id: string;
  token: string;
  platform: "ios" | "android" | "web";
  createdAt: string;
  active: boolean;
};

export type SmsRecipient = {
  id: string;
  phone: string;
  name?: string;
  createdAt: string;
  active: boolean;
};

export type DeadlineSummary = {
  id: string;
  title: string;
  date: string;
  caseId: string;
  caseName?: string;
  type: string;
  daysOverdue?: number;
  daysUntil?: number;
};

export type Evaluation = {
  id: string;
  createdAt: string;
  status: "pending" | "analyzing" | "sending" | "sent" | "failed";
  analysis: {
    overdueDeadlines: DeadlineSummary[];
    upcomingDeadlines: DeadlineSummary[];
    tomorrowActions: string[];
    aiSummary: string;
  };
  notification: {
    title: string;
    body: string;
    sentAt?: string;
    pushSent?: boolean;
    smsSent?: boolean;
  };
  error?: string;
};

export type Evidence = {
  id: string;
  caseId: string;
  exhibitNumber: string;
  title: string;
  description: string;
  type:
    | "document"
    | "photo"
    | "video"
    | "audio"
    | "physical"
    | "testimony"
    | "digital"
    | "other";
  fileUrl: string;
  dateCollected: string;
  location: string;
  tags: string[];
  relevance: "high" | "medium" | "low";
  admissible: boolean;
  chain: ChainOfCustodyEntry[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ServerConfig = {
  id: "singleton";
  createdAt: string;
  updatedAt: string;

  firebase?: {
    projectId?: string;
    privateKey?: string;
    clientEmail?: string;
  };

  twilio?: {
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;
  };

  scheduler?: {
    timezone?: string;
    enabled?: boolean;
  };

  ai?: {
    openaiApiKey?: string;
    openaiEndpoint?: string;
    selectedModels?: string[];
    vlmModel?: string;
  };

  autoIngest?: {
    directory?: string;
  };

  legalResearch?: {
    courtListenerApiToken?: string;
    legiscanApiKey?: string;
    govInfoApiKey?: string;
    serpapiBase?: string;
  };

  prompts?: {
    chatSystemPrompt?: string;
    caseSummaryPrompt?: string;
    evaluatorPrompt?: string;
  };
};

export type Beneficiary = {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

export type EstateAsset = {
  id: string;
  name: string;
  category:
    | "real-property"
    | "bank-account"
    | "investment"
    | "retirement"
    | "insurance"
    | "vehicle"
    | "personal-property"
    | "business-interest"
    | "digital-asset"
    | "other";
  estimatedValue: number;
  ownershipType: string;
  accountNumber: string;
  institution: string;
  beneficiaryIds: string[];
  notes: string;
};

export type EstateDocument = {
  id: string;
  type:
    | "last-will"
    | "living-will"
    | "power-of-attorney-financial"
    | "power-of-attorney-healthcare"
    | "healthcare-directive"
    | "trust"
    | "beneficiary-designation"
    | "letter-of-instruction"
    | "other";
  title: string;
  status: "not-started" | "draft" | "review" | "signed" | "notarized" | "filed";
  content: string;
  fieldValues: Record<string, string>;
  templateId: string;
  reviewDate: string;
  signedDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Embedding = {
  id: string;
  source: string;
  content: string;
  embedding: number[];
};

export type EstatePlan = {
  id: string;
  title: string;
  status: "planning" | "drafting" | "review" | "complete";
  testatorName: string;
  testatorDateOfBirth: string;
  testatorAddress: string;
  executorName: string;
  executorPhone: string;
  executorEmail: string;
  guardianName: string;
  guardianPhone: string;
  beneficiaries: Beneficiary[];
  assets: EstateAsset[];
  documents: EstateDocument[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchCase = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  userEmail: string;
  savedSearches: any[];
  documents: any[];
  summaries: any[];
  contextItems: any[];
  generatedDocuments?: any[];
};

export type ResearchAttachment = {
  id: string;
  userEmail: string;
  data: number[];
  type: string;
  name: string;
};

type Collections = {
  cases: Map<string, Case>;
  contacts: Map<string, Contact>;
  deadlines: Map<string, Deadline>;
  finances: Map<string, FinancialEntry>;
  evidences: Map<string, Evidence>;
  filings: Map<string, Filing>;
  notes: Map<string, Note>;
  deviceTokens: Map<string, DeviceToken>;
  smsRecipients: Map<string, SmsRecipient>;
  evaluations: Map<string, Evaluation>;
  serverConfig: Map<string, ServerConfig>;
  estatePlans: Map<string, EstatePlan>;
  embeddings: Map<string, Embedding>;
  researchCases: Map<string, ResearchCase>;
  researchAttachments: Map<string, ResearchAttachment>;
};

const COLLECTION_KEYS: (keyof Collections)[] = [
  "cases",
  "contacts",
  "deadlines",
  "finances",
  "evidences",
  "filings",
  "notes",
  "deviceTokens",
  "smsRecipients",
  "evaluations",
  "serverConfig",
  "estatePlans",
  "embeddings",
  "researchCases",
  "researchAttachments",
];

function toMaps(raw: DatabaseSnapshot): Collections {
  const maps: any = {};
  for (const key of COLLECTION_KEYS) {
    maps[key] = new Map(Object.entries(raw[key] ?? {}));
  }
  return maps;
}

function fromMaps(collections: Collections): DatabaseSnapshot {
  const out: any = {};
  for (const key of COLLECTION_KEYS) {
    out[key] = Object.fromEntries(collections[key]);
  }
  return out;
}

function assignMaps(target: Database, maps: Collections): void {
  target.cases = maps.cases;
  target.contacts = maps.contacts;
  target.deadlines = maps.deadlines;
  target.finances = maps.finances;
  target.evidences = maps.evidences;
  target.filings = maps.filings;
  target.notes = maps.notes;
  target.deviceTokens = maps.deviceTokens;
  target.smsRecipients = maps.smsRecipients;
  target.evaluations = maps.evaluations;
  target.serverConfig = maps.serverConfig;
  target.estatePlans = maps.estatePlans;
  target.embeddings = maps.embeddings;
  target.researchCases = maps.researchCases;
  target.researchAttachments = maps.researchAttachments;
}

export class Database {
  cases!: Map<string, Case>;
  contacts!: Map<string, Contact>;
  deadlines!: Map<string, Deadline>;
  finances!: Map<string, FinancialEntry>;
  evidences!: Map<string, Evidence>;
  filings!: Map<string, Filing>;
  notes!: Map<string, Note>;
  deviceTokens!: Map<string, DeviceToken>;
  smsRecipients!: Map<string, SmsRecipient>;
  evaluations!: Map<string, Evaluation>;
  serverConfig!: Map<string, ServerConfig>;
  estatePlans!: Map<string, EstatePlan>;
  embeddings!: Map<string, Embedding>;
  researchCases!: Map<string, ResearchCase>;
  researchAttachments!: Map<string, ResearchAttachment>;

  private adapter: PersistenceAdapter;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private locked = false;
  private lockReason: EncryptionFailureReason | null = null;
  private lockedSnapshot: DatabaseSnapshot | null = null;
  private encryptedAtRest = false;

  private constructor(adapter: PersistenceAdapter) {
    this.adapter = adapter;
    assignMaps(this, toMaps({}));
  }

  static async create(adapter: PersistenceAdapter): Promise<Database> {
    const db = new Database(adapter);
    const raw = adapter.load();
    db.encryptedAtRest = isEncryptedSnapshot(raw);

    let data: DatabaseSnapshot;
    try {
      data = await decryptSnapshot(raw);
    } catch (error) {

      if (error instanceof DatabaseEncryptionError) {
        db.locked = true;
        db.lockReason = error.reason;
        db.lockedSnapshot = raw;
        return db;
      }
      throw error;
    }

    assignMaps(db, toMaps(data));
    return db;
  }

  isLocked(): boolean {
    return this.locked;
  }

  securityStatus(): {
    locked: boolean;
    encryptedAtRest: boolean;
    keyLoaded: boolean;
    lockReason: EncryptionFailureReason | null;
  } {
    return {
      locked: this.locked,
      encryptedAtRest: this.encryptedAtRest,
      keyLoaded: hasEncryptionPassphrase(),
      lockReason: this.lockReason,
    };
  }

  async applyRecoveryKey(recoveryKey: string): Promise<void> {
    const normalized = normalizePassphrase(recoveryKey);
    if (!normalized) throw new Error("Recovery key is required.");

    if (this.locked) {
      if (!this.lockedSnapshot) {
        throw new Error("Database is locked and unavailable.");
      }

      let decrypted: DatabaseSnapshot;
      try {
        decrypted = await decryptSnapshot(this.lockedSnapshot, normalized);
      } catch (error) {
        if (error instanceof DatabaseEncryptionError) {
          throw new Error("Invalid recovery key.");
        }
        throw error;
      }

      await setEncryptionPassphrase(normalized);
      assignMaps(this, toMaps(decrypted));

      this.locked = false;
      this.lockReason = null;
      this.lockedSnapshot = null;
      this.encryptedAtRest = true;
      return;
    }

    await setEncryptionPassphrase(normalized);
  }

  /** Debounced write — coalesces rapid mutations into a single disk write. */
  persist(): void {
    if (this.locked) return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      void this.persistAsync();
    }, 100);
  }

  private async persistAsync(): Promise<void> {
    try {
      const toSave = await encryptSnapshot(fromMaps(this));
      this.encryptedAtRest = isEncryptedSnapshot(toSave);
      this.adapter.save(toSave);
    } catch (err) {
      console.error("Failed to persist database:", err);
    }
    this.saveTimeout = null;
  }

  /** Flush to disk. Use for graceful shutdown. */
  async flush(): Promise<void> {
    if (this.locked) return;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    const toSave = await encryptSnapshot(fromMaps(this));
    this.encryptedAtRest = isEncryptedSnapshot(toSave);
    this.adapter.save(toSave);
  }
}

function createDefaultAdapter(): PersistenceAdapter {
  const isElectron =
    Boolean(process.versions.electron) || process.env.PROSEVA_DATA_DIR != null;
  try {
    if (isElectron) return new ElectronIdbRepoAdapter();
    return new LocalFileAdapter();
  } catch {
    return new InMemoryAdapter();
  }
}

export let db: Database;

/** Initialize the database. Must be called (and awaited) before handling requests. */
export async function initDb(
  adapter: PersistenceAdapter = createDefaultAdapter(),
): Promise<Database> {
  db = await Database.create(adapter);
  return db;
}

export async function resetDb(adapter: PersistenceAdapter): Promise<void> {
  db = await Database.create(adapter);
}

// Re-export encryption utilities for backward compatibility
export {
  setPassphrase as setDbEncryptionPassphrase,
  clearPassphrase as clearDbEncryptionPassphrase,
  hasPassphrase as hasDbEncryptionPassphrase,
} from "./encryption";
