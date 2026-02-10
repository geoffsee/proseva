import {
  type PersistenceAdapter,
  LocalFileAdapter,
  InMemoryAdapter,
} from "./persistence";
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
  };

  autoIngest?: {
    directory?: string;
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
];

function toMaps(raw: Record<string, Record<string, unknown>>): Collections {
  const maps: any = {};
  for (const key of COLLECTION_KEYS) {
    maps[key] = new Map(Object.entries(raw[key] ?? {}));
  }
  return maps;
}

function fromMaps(
  collections: Collections,
): Record<string, Record<string, unknown>> {
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

  private adapter: PersistenceAdapter;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(adapter: PersistenceAdapter) {
    this.adapter = adapter;
    const data = adapter.load();
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
  }

  /** Debounced write — coalesces rapid mutations into a single disk write. */
  persist(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.adapter.save(fromMaps(this));
      this.saveTimeout = null;
    }, 100);
  }

  /** Flush synchronously (useful for graceful shutdown). */
  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.adapter.save(fromMaps(this));
  }
}

function createDefaultAdapter(): PersistenceAdapter {
  try {
    return new LocalFileAdapter();
  } catch {
    return new InMemoryAdapter();
  }
}

export let db = new Database(createDefaultAdapter());

export function resetDb(adapter: PersistenceAdapter): void {
  db = new Database(adapter);
}
