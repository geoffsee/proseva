import {
  type PersistenceAdapter,
  SqliteAdapter,
  InMemoryAdapter,
  StorageEncryptionError,
} from "./persistence";
import {
  type DatabaseSnapshot,
  type EncryptionFailureReason,
  DatabaseEncryptionError,
  isEncryptedSnapshot,
  decryptSnapshot,
} from "./encryption";
import {
  normalizeEncryptionKey,
  setEncryptionKey as setEncryptionPassphrase,
  clearEncryptionKey as clearEncryptionPassphrase,
  hasEncryptionKey as hasEncryptionPassphrase,
} from "./db-key-provider";
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

export type Correspondence = {
  id: string;
  caseId: string;
  date: string;
  direction: "incoming" | "outgoing";
  channel: "email" | "mail" | "fax" | "phone" | "sms" | "other";
  subject: string;
  sender: string;
  recipient: string;
  summary: string;
  notes: string;
  attachments: CorrespondenceAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type CorrespondenceAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  hash: string;
  createdAt: string;
};

export type Contact = {
  id: string;
  name: string;
  role:
    | "attorney"
    | "judge"
    | "clerk"
    | "witness"
    | "expert"
    | "opposing_party"
    | "other";
  organization: string;
  phone: string;
  fax: string;
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
    largeModel?: string;
    smallModel?: string;
    reasoningModel?: string;
    embeddingsModel?: string;
    embeddingsEndpoint?: string;
  };

  autoIngest?: {
    directory?: string;
  };

  legalResearch?: {
    courtListenerApiToken?: string;
    legiscanApiKey?: string;
    govInfoApiKey?: string;
    serpapiBase?: string;
    serpapiApiKey?: string;
  };

  prompts?: {
    chatSystemPrompt?: string;
    caseSummaryPrompt?: string;
    evaluatorPrompt?: string;
  };

  faxGateway?: {
    url?: string;
    username?: string;
    password?: string;
  };

  documentScanner?: {
    enabled?: boolean;
    endpoints?: string;
    outputDirectory?: string;
  };

  email?: {
    instanceId?: string;
    emailAddress?: string;
    apiKey?: string;
    publicKeyJwk?: string;
    privateKeyJwk?: string;
    workerUrl?: string;
    pollingEnabled?: boolean;
    pollingIntervalSeconds?: number;
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
  savedSearches: unknown[];
  documents: unknown[];
  summaries: unknown[];
  contextItems: unknown[];
  generatedDocuments?: unknown[];
};

export type ResearchAttachment = {
  id: string;
  userEmail: string;
  data: number[];
  type: string;
  name: string;
};

export type FileMetadata = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  hash: string;
  createdAt: string;
  ownerEmail?: string;
  sourceType:
    | "research-attachment"
    | "correspondence-attachment"
    | "evidence"
    | "document"
    | "other";
  sourceRef?: string;
};

export type DocumentRecord = {
  id: string;
  filename: string;
  category: string;
  title: string;
  pageCount: number;
  dates: string[];
  fileSize: number;
  hash: string;
  caseId: string;
  extractedText: string;
  createdAt: string;
};

export type FaxJob = {
  id: string;
  filingId: string;
  caseId: string;
  recipientName: string;
  recipientFax: string;
  documentPath?: string;
  status: "pending" | "sending" | "sent" | "failed";
  provider: string;
  providerJobId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};

type Collections = {
  cases: Map<string, Case>;
  contacts: Map<string, Contact>;
  deadlines: Map<string, Deadline>;
  finances: Map<string, FinancialEntry>;
  evidences: Map<string, Evidence>;
  filings: Map<string, Filing>;
  correspondences: Map<string, Correspondence>;
  notes: Map<string, Note>;
  deviceTokens: Map<string, DeviceToken>;
  smsRecipients: Map<string, SmsRecipient>;
  evaluations: Map<string, Evaluation>;
  serverConfig: Map<string, ServerConfig>;
  estatePlans: Map<string, EstatePlan>;
  embeddings: Map<string, Embedding>;
  researchCases: Map<string, ResearchCase>;
  researchAttachments: Map<string, ResearchAttachment>;
  fileMetadata: Map<string, FileMetadata>;
  documents: Map<string, DocumentRecord>;
  faxJobs: Map<string, FaxJob>;
};

const COLLECTION_KEYS: (keyof Collections)[] = [
  "cases",
  "contacts",
  "deadlines",
  "finances",
  "evidences",
  "filings",
  "correspondences",
  "notes",
  "deviceTokens",
  "smsRecipients",
  "evaluations",
  "serverConfig",
  "estatePlans",
  "embeddings",
  "researchCases",
  "researchAttachments",
  "fileMetadata",
  "documents",
  "faxJobs",
];

function toMaps(raw: Partial<DatabaseSnapshot>): Collections {
  const maps = {} as Collections;
  for (const key of COLLECTION_KEYS) {
    const data = raw[key] || {};
    // @ts-expect-error - Map constructor with string keys matches our collection types
    maps[key] = new Map(Object.entries(data));
  }
  return maps;
}

function fromMaps(collections: Collections): DatabaseSnapshot {
  const out = {} as DatabaseSnapshot;
  for (const key of COLLECTION_KEYS) {
    const data = Object.fromEntries(collections[key]);
    (out as Record<string, Record<string, unknown>>)[key] = data;
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
  target.correspondences = maps.correspondences;
  target.notes = maps.notes;
  target.deviceTokens = maps.deviceTokens;
  target.smsRecipients = maps.smsRecipients;
  target.evaluations = maps.evaluations;
  target.serverConfig = maps.serverConfig;
  target.estatePlans = maps.estatePlans;
  target.embeddings = maps.embeddings;
  target.researchCases = maps.researchCases;
  target.researchAttachments = maps.researchAttachments;
  target.fileMetadata = maps.fileMetadata;
  target.documents = maps.documents;
  target.faxJobs = maps.faxJobs;
}

export class Database {
  cases!: Map<string, Case>;
  contacts!: Map<string, Contact>;
  deadlines!: Map<string, Deadline>;
  finances!: Map<string, FinancialEntry>;
  evidences!: Map<string, Evidence>;
  filings!: Map<string, Filing>;
  correspondences!: Map<string, Correspondence>;
  notes!: Map<string, Note>;
  deviceTokens!: Map<string, DeviceToken>;
  smsRecipients!: Map<string, SmsRecipient>;
  evaluations!: Map<string, Evaluation>;
  serverConfig!: Map<string, ServerConfig>;
  estatePlans!: Map<string, EstatePlan>;
  embeddings!: Map<string, Embedding>;
  researchCases!: Map<string, ResearchCase>;
  researchAttachments!: Map<string, ResearchAttachment>;
  fileMetadata!: Map<string, FileMetadata>;
  documents!: Map<string, DocumentRecord>;
  faxJobs!: Map<string, FaxJob>;

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
    let raw: DatabaseSnapshot;
    try {
      raw = await adapter.load();
    } catch (error) {
      if (error instanceof StorageEncryptionError) {
        db.locked = true;
        db.lockReason = error.reason;
        db.lockedSnapshot = null;
        db.encryptedAtRest = true;
        return db;
      }
      throw error;
    }

    db.encryptedAtRest = hasEncryptionPassphrase();
    const legacyEncryptedSnapshot = isEncryptedSnapshot(raw);

    let data: DatabaseSnapshot;
    try {
      data = legacyEncryptedSnapshot ? await decryptSnapshot(raw) : raw;
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

    if (legacyEncryptedSnapshot) {
      // One-time migration from legacy app-layer envelope to plain snapshot.
      await adapter.save(data).catch((err) => {
        console.error("Failed to migrate legacy encrypted snapshot:", err);
      });
    }

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
    const normalized = normalizeEncryptionKey(recoveryKey);
    if (!normalized) throw new Error("Recovery key is required.");

    if (this.locked) {
      await setEncryptionPassphrase(normalized);
      try {
        const raw = this.lockedSnapshot ?? (await this.adapter.load());
        const legacyEncryptedSnapshot = isEncryptedSnapshot(raw);
        const decrypted = legacyEncryptedSnapshot
          ? await decryptSnapshot(raw)
          : raw;
        assignMaps(this, toMaps(decrypted));

        if (legacyEncryptedSnapshot) {
          await this.adapter.save(decrypted);
        }
      } catch (error) {
        clearEncryptionPassphrase();
        if (
          error instanceof DatabaseEncryptionError ||
          error instanceof StorageEncryptionError
        ) {
          throw new Error("Invalid recovery key.");
        }
        throw error;
      }

      this.locked = false;
      this.lockReason = null;
      this.lockedSnapshot = null;
      this.encryptedAtRest = hasEncryptionPassphrase();
      return;
    }

    await setEncryptionPassphrase(normalized);
    this.encryptedAtRest = hasEncryptionPassphrase();
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
      await this.adapter.save(fromMaps(this));
      this.encryptedAtRest = hasEncryptionPassphrase();
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
    await this.adapter.save(fromMaps(this));
    this.encryptedAtRest = hasEncryptionPassphrase();
  }
}

function createDefaultAdapter(): PersistenceAdapter {
  try {
    return new SqliteAdapter();
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

// Re-export encryption key utilities for backward compatibility.
export {
  setEncryptionKey as setDbEncryptionPassphrase,
  clearEncryptionKey as clearDbEncryptionPassphrase,
  hasEncryptionKey as hasDbEncryptionPassphrase,
} from "./db-key-provider";
