import {
  type PersistenceAdapter,
  ElectronIdbRepoAdapter,
  LocalFileAdapter,
  InMemoryAdapter,
} from "./persistence";
import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";
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

// Device tokens for FCM push notifications
export type DeviceToken = {
  id: string;
  token: string; // FCM registration token
  platform: "ios" | "android" | "web";
  createdAt: string;
  active: boolean;
};

// Phone numbers for SMS
export type SmsRecipient = {
  id: string;
  phone: string; // E.164 format: +15551234567
  name?: string;
  createdAt: string;
  active: boolean;
};

// Deadline summary for evaluations
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

// Daily evaluation results
export type Evaluation = {
  id: string;
  createdAt: string;
  status: "pending" | "analyzing" | "sending" | "sent" | "failed";
  analysis: {
    overdueDeadlines: DeadlineSummary[];
    upcomingDeadlines: DeadlineSummary[]; // Next 7 days
    tomorrowActions: string[];
    aiSummary: string; // AI-generated strategic summary
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

// Server configuration (singleton record)
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

const DB_ENCRYPTION_KEY_ENV_VAR = "PROSEVA_DB_ENCRYPTION_KEY";
const DB_ENCRYPTION_PAYLOAD_KEY = "__proseva_encrypted";
const DB_ENCRYPTION_ALGORITHM = "aes-256-gcm";
const DB_ENCRYPTION_KEY_BYTES = 32;
const DB_ENCRYPTION_SALT_BYTES = 16;
const DB_ENCRYPTION_IV_BYTES = 12;
const DB_ENCRYPTION_KDF_ITERATIONS = 310_000;

type DatabaseSnapshot = Record<string, Record<string, unknown>>;

type EncryptedDatabaseEnvelope = {
  version: 1;
  algorithm: typeof DB_ENCRYPTION_ALGORITHM;
  kdf: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

type EncryptionFailureReason = "missing_key" | "invalid_key";

class DatabaseEncryptionError extends Error {
  reason: EncryptionFailureReason;

  constructor(reason: EncryptionFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

function toBase64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

function fromBase64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDatabaseSnapshot(value: unknown): value is DatabaseSnapshot {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isRecord(entry));
}

function normalizePassphrase(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "null"
  ) {
    return undefined;
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

let runtimeDbEncryptionPassphrase = normalizePassphrase(
  process.env[DB_ENCRYPTION_KEY_ENV_VAR],
);

function dbEncryptionPassphrase(): string | undefined {
  return runtimeDbEncryptionPassphrase;
}

export function setDbEncryptionPassphrase(passphrase: string): void {
  runtimeDbEncryptionPassphrase = normalizePassphrase(passphrase);
}

export function clearDbEncryptionPassphrase(): void {
  runtimeDbEncryptionPassphrase = undefined;
}

export function hasDbEncryptionPassphrase(): boolean {
  return dbEncryptionPassphrase() !== undefined;
}

function isEncryptedEnvelope(value: unknown): value is EncryptedDatabaseEnvelope {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    value.algorithm === DB_ENCRYPTION_ALGORITHM &&
    value.kdf === "pbkdf2-sha256" &&
    typeof value.iterations === "number" &&
    typeof value.salt === "string" &&
    typeof value.iv === "string" &&
    typeof value.authTag === "string" &&
    typeof value.ciphertext === "string"
  );
}

function isEncryptedSnapshot(input: DatabaseSnapshot): boolean {
  return isEncryptedEnvelope(input[DB_ENCRYPTION_PAYLOAD_KEY]);
}

function decryptSnapshot(
  input: DatabaseSnapshot,
  passphraseOverride?: string,
): DatabaseSnapshot {
  const maybeEnvelope = input[DB_ENCRYPTION_PAYLOAD_KEY];
  if (!isEncryptedEnvelope(maybeEnvelope)) return input;

  const passphrase = normalizePassphrase(passphraseOverride)
    ?? dbEncryptionPassphrase();
  if (!passphrase) {
    throw new DatabaseEncryptionError(
      "missing_key",
      `Database is encrypted. Set ${DB_ENCRYPTION_KEY_ENV_VAR} to decrypt it.`,
    );
  }

  const salt = fromBase64(maybeEnvelope.salt);
  const iv = fromBase64(maybeEnvelope.iv);
  const authTag = fromBase64(maybeEnvelope.authTag);
  const ciphertext = fromBase64(maybeEnvelope.ciphertext);

  const key = pbkdf2Sync(
    passphrase,
    salt,
    maybeEnvelope.iterations,
    DB_ENCRYPTION_KEY_BYTES,
    "sha256",
  );

  let parsed: unknown;
  try {
    const decipher = createDecipheriv(DB_ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    parsed = JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new DatabaseEncryptionError(
      "invalid_key",
      `Failed to decrypt database. Check ${DB_ENCRYPTION_KEY_ENV_VAR}.`,
    );
  }

  if (!isDatabaseSnapshot(parsed)) {
    throw new Error("Decrypted database payload is invalid.");
  }

  return parsed;
}

function encryptSnapshot(input: DatabaseSnapshot): DatabaseSnapshot {
  const passphrase = dbEncryptionPassphrase();
  if (!passphrase) return input;

  const salt = randomBytes(DB_ENCRYPTION_SALT_BYTES);
  const iv = randomBytes(DB_ENCRYPTION_IV_BYTES);
  const key = pbkdf2Sync(
    passphrase,
    salt,
    DB_ENCRYPTION_KDF_ITERATIONS,
    DB_ENCRYPTION_KEY_BYTES,
    "sha256",
  );

  const cipher = createCipheriv(DB_ENCRYPTION_ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(input), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const envelope: EncryptedDatabaseEnvelope = {
    version: 1,
    algorithm: DB_ENCRYPTION_ALGORITHM,
    kdf: "pbkdf2-sha256",
    iterations: DB_ENCRYPTION_KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    authTag: toBase64(authTag),
    ciphertext: toBase64(ciphertext),
  };

  return { [DB_ENCRYPTION_PAYLOAD_KEY]: envelope };
}

function toMaps(raw: DatabaseSnapshot): Collections {
  const maps: any = {};
  for (const key of COLLECTION_KEYS) {
    maps[key] = new Map(Object.entries(raw[key] ?? {}));
  }
  return maps;
}

function fromMaps(
  collections: Collections,
): DatabaseSnapshot {
  const out: any = {};
  for (const key of COLLECTION_KEYS) {
    out[key] = Object.fromEntries(collections[key]);
  }
  return out;
}

export class Database {
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

  private adapter: PersistenceAdapter;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private locked = false;
  private lockReason: EncryptionFailureReason | null = null;
  private lockedSnapshot: DatabaseSnapshot | null = null;
  private encryptedAtRest = false;

  constructor(adapter: PersistenceAdapter) {
    this.adapter = adapter;
    const raw = adapter.load();
    this.encryptedAtRest = isEncryptedSnapshot(raw);

    let data: DatabaseSnapshot;
    try {
      data = decryptSnapshot(raw);
    } catch (error) {
      if (error instanceof DatabaseEncryptionError) {
        this.locked = true;
        this.lockReason = error.reason;
        this.lockedSnapshot = raw;
        const emptyMaps = toMaps({});
        this.cases = emptyMaps.cases;
        this.contacts = emptyMaps.contacts;
        this.deadlines = emptyMaps.deadlines;
        this.finances = emptyMaps.finances;
        this.evidences = emptyMaps.evidences;
        this.filings = emptyMaps.filings;
        this.notes = emptyMaps.notes;
        this.deviceTokens = emptyMaps.deviceTokens;
        this.smsRecipients = emptyMaps.smsRecipients;
        this.evaluations = emptyMaps.evaluations;
        this.serverConfig = emptyMaps.serverConfig;
        this.estatePlans = emptyMaps.estatePlans;
        this.embeddings = emptyMaps.embeddings;
        this.researchCases = emptyMaps.researchCases;
        this.researchAttachments = emptyMaps.researchAttachments;
        return;
      }
      throw error;
    }

    const maps = toMaps(data);
    this.cases = maps.cases;
    this.contacts = maps.contacts;
    this.deadlines = maps.deadlines;
    this.finances = maps.finances;
    this.evidences = maps.evidences;
    this.filings = maps.filings;
    this.notes = maps.notes;
    this.deviceTokens = maps.deviceTokens;
    this.smsRecipients = maps.smsRecipients;
    this.evaluations = maps.evaluations;
    this.serverConfig = maps.serverConfig;
    this.estatePlans = maps.estatePlans;
    this.embeddings = maps.embeddings;
    this.researchCases = maps.researchCases;
    this.researchAttachments = maps.researchAttachments;
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
      keyLoaded: hasDbEncryptionPassphrase(),
      lockReason: this.lockReason,
    };
  }

  applyRecoveryKey(recoveryKey: string): void {
    const normalized = normalizePassphrase(recoveryKey);
    if (!normalized) throw new Error("Recovery key is required.");

    if (this.locked) {
      if (!this.lockedSnapshot) {
        throw new Error("Database is locked and unavailable.");
      }

      let decrypted: DatabaseSnapshot;
      try {
        decrypted = decryptSnapshot(this.lockedSnapshot, normalized);
      } catch (error) {
        if (error instanceof DatabaseEncryptionError) {
          throw new Error("Invalid recovery key.");
        }
        throw error;
      }

      setDbEncryptionPassphrase(normalized);
      const maps = toMaps(decrypted);
      this.cases = maps.cases;
      this.contacts = maps.contacts;
      this.deadlines = maps.deadlines;
      this.finances = maps.finances;
      this.evidences = maps.evidences;
      this.filings = maps.filings;
      this.notes = maps.notes;
      this.deviceTokens = maps.deviceTokens;
      this.smsRecipients = maps.smsRecipients;
      this.evaluations = maps.evaluations;
      this.serverConfig = maps.serverConfig;
      this.estatePlans = maps.estatePlans;
      this.embeddings = maps.embeddings;
      this.researchCases = maps.researchCases;
      this.researchAttachments = maps.researchAttachments;

      this.locked = false;
      this.lockReason = null;
      this.lockedSnapshot = null;
      this.encryptedAtRest = true;
      return;
    }

    setDbEncryptionPassphrase(normalized);
  }

  /** Debounced write — coalesces rapid mutations into a single disk write. */
  persist(): void {
    if (this.locked) return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      const toSave = encryptSnapshot(fromMaps(this));
      this.encryptedAtRest = isEncryptedSnapshot(toSave);
      this.adapter.save(toSave);
      this.saveTimeout = null;
    }, 100);
  }

  /** Flush synchronously (useful for graceful shutdown). */
  flush(): void {
    if (this.locked) return;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    const toSave = encryptSnapshot(fromMaps(this));
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

export let db = new Database(createDefaultAdapter());

export function resetDb(adapter: PersistenceAdapter): void {
  db = new Database(adapter);
}
