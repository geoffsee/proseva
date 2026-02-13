import createClient from "openapi-fetch";
import type { paths, components } from "./api-types.js";
import type { ReportConfig } from "../types";
import {
  saveAuthToken as kvSaveAuthToken,
  loadAuthToken as kvLoadAuthToken,
  clearAuthToken as kvClearAuthToken,
} from "./kv";

export type Case = components["schemas"]["Case"];
export type Party = components["schemas"]["Party"];
export type Filing = components["schemas"]["Filing"];
export type Contact = components["schemas"]["Contact"];
export type Deadline = components["schemas"]["Deadline"];
export type FinancialEntry = components["schemas"]["FinancialEntry"];
export type Evidence = components["schemas"]["Evidence"];
export type Note = components["schemas"]["Note"];
export type DocumentEntry = components["schemas"]["DocumentEntry"];

// --- Token Management ---
export async function setAuthToken(token: string): Promise<void> {
  try {
    await kvSaveAuthToken(token);
  } catch (error) {
    console.error("Failed to store auth token:", error);
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await kvLoadAuthToken();
  } catch (error) {
    console.error("Failed to retrieve auth token:", error);
    return null;
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await kvClearAuthToken();
  } catch (error) {
    console.error("Failed to clear auth token:", error);
  }
}

// Create client and configure with middleware for dynamic auth headers
export const client = createClient<paths>({
  baseUrl: "/api",
});

// Add middleware to inject auth token on every request
client.use({
  async onRequest({ request }) {
    const token = await getAuthToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
});

// Helper to create fetch headers with auth token
async function getAuthHeaders(additional?: HeadersInit): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(new Headers(additional || {}).entries()),
  };
  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// --- Convenience wrappers preserving the existing api.* interface ---

// Authentication expiration callback
let onAuthExpired: (() => void) | null = null;

export function setAuthExpiredCallback(callback: () => void): void {
  onAuthExpired = callback;
}

async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T | null> {
  try {
    const { data, error, response } = await promise;

    // Handle authentication errors
    if (response.status === 401) {
      await clearAuthToken();
      if (onAuthExpired) {
        onAuthExpired();
      }
      throw new Error("Authentication required. Please log in again.");
    }

    if (response.status === 404) return null;
    if (response.status === 204) return null;
    if (!response.ok || error)
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    return (data as T) ?? null;
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

export const casesApi = {
  list: () => unwrap(client.GET("/cases")),
  get: (id: string) =>
    unwrap(client.GET("/cases/{caseId}", { params: { path: { caseId: id } } })),
  create: (data: components["schemas"]["CaseCreate"]) =>
    unwrap(client.POST("/cases", { body: data })),
  update: (id: string, updates: components["schemas"]["CaseUpdate"]) =>
    unwrap(
      client.PATCH("/cases/{caseId}", {
        params: { path: { caseId: id } },
        body: updates,
      }),
    ),
  delete: (id: string) =>
    unwrap(
      client.DELETE("/cases/{caseId}", { params: { path: { caseId: id } } }),
    ),
  addParty: (caseId: string, party: components["schemas"]["PartyCreate"]) =>
    unwrap(
      client.POST("/cases/{caseId}/parties", {
        params: { path: { caseId } },
        body: party,
      }),
    ),
  removeParty: (caseId: string, partyId: string) =>
    unwrap(
      client.DELETE("/cases/{caseId}/parties/{partyId}", {
        params: { path: { caseId, partyId } },
      }),
    ),
  addFiling: (caseId: string, filing: components["schemas"]["FilingCreate"]) =>
    unwrap(
      client.POST("/cases/{caseId}/filings", {
        params: { path: { caseId } },
        body: filing,
      }),
    ),
  removeFiling: (caseId: string, filingId: string) =>
    unwrap(
      client.DELETE("/cases/{caseId}/filings/{filingId}", {
        params: { path: { caseId, filingId } },
      }),
    ),
};

export const contactsApi = {
  list: () => unwrap(client.GET("/contacts")),
  get: (id: string) =>
    unwrap(
      client.GET("/contacts/{contactId}", {
        params: { path: { contactId: id } },
      }),
    ),
  create: (data: components["schemas"]["ContactCreate"]) =>
    unwrap(client.POST("/contacts", { body: data })),
  update: (id: string, updates: components["schemas"]["ContactUpdate"]) =>
    unwrap(
      client.PATCH("/contacts/{contactId}", {
        params: { path: { contactId: id } },
        body: updates,
      }),
    ),
  delete: (id: string) =>
    unwrap(
      client.DELETE("/contacts/{contactId}", {
        params: { path: { contactId: id } },
      }),
    ),
};

export const deadlinesApi = {
  list: () => unwrap(client.GET("/deadlines")),
  get: (id: string) =>
    unwrap(
      client.GET("/deadlines/{deadlineId}", {
        params: { path: { deadlineId: id } },
      }),
    ),
  create: (data: components["schemas"]["DeadlineCreate"]) =>
    unwrap(client.POST("/deadlines", { body: data })),
  update: (id: string, updates: components["schemas"]["DeadlineUpdate"]) =>
    unwrap(
      client.PATCH("/deadlines/{deadlineId}", {
        params: { path: { deadlineId: id } },
        body: updates,
      }),
    ),
  delete: (id: string) =>
    unwrap(
      client.DELETE("/deadlines/{deadlineId}", {
        params: { path: { deadlineId: id } },
      }),
    ),
  toggleComplete: (id: string) =>
    unwrap(
      client.POST("/deadlines/{deadlineId}/toggle-complete", {
        params: { path: { deadlineId: id } },
      }),
    ),
};

export const financesApi = {
  list: () => unwrap(client.GET("/finances")),
  get: (id: string) =>
    unwrap(
      client.GET("/finances/{entryId}", { params: { path: { entryId: id } } }),
    ),
  create: (data: components["schemas"]["FinancialEntryCreate"]) =>
    unwrap(client.POST("/finances", { body: data })),
  update: (
    id: string,
    updates: components["schemas"]["FinancialEntryUpdate"],
  ) =>
    unwrap(
      client.PATCH("/finances/{entryId}", {
        params: { path: { entryId: id } },
        body: updates,
      }),
    ),
  delete: (id: string) =>
    unwrap(
      client.DELETE("/finances/{entryId}", {
        params: { path: { entryId: id } },
      }),
    ),
};

export const evidencesApi = {
  list: () => unwrap(client.GET("/evidences")),
  get: (id: string) =>
    unwrap(
      client.GET("/evidences/{evidenceId}", {
        params: { path: { evidenceId: id } },
      }),
    ),
  create: (data: components["schemas"]["EvidenceCreate"]) =>
    unwrap(client.POST("/evidences", { body: data })),
  update: (id: string, updates: components["schemas"]["EvidenceUpdate"]) =>
    unwrap(
      client.PATCH("/evidences/{evidenceId}", {
        params: { path: { evidenceId: id } },
        body: updates,
      }),
    ),
  delete: (id: string) =>
    unwrap(
      client.DELETE("/evidences/{evidenceId}", {
        params: { path: { evidenceId: id } },
      }),
    ),
};

export const filingsApi = {
  list: () => unwrap(client.GET("/filings")),
  get: (id: string) =>
    unwrap(
      client.GET("/filings/{filingId}", { params: { path: { filingId: id } } }),
    ),
  create: (data: components["schemas"]["FilingCreate"]) =>
    unwrap(client.POST("/filings", { body: data })),
  update: (id: string, updates: components["schemas"]["FilingUpdate"]) =>
    unwrap(
      client.PATCH("/filings/{filingId}", {
        params: { path: { filingId: id } },
        body: updates,
      }),
    ),
  delete: (id: string) =>
    unwrap(
      client.DELETE("/filings/{filingId}", {
        params: { path: { filingId: id } },
      }),
    ),
};

export const notesApi = {
  list: () => unwrap(client.GET("/notes")),
  get: (id: string) =>
    unwrap(client.GET("/notes/{noteId}", { params: { path: { noteId: id } } })),
  create: (data: components["schemas"]["NoteCreate"]) =>
    unwrap(client.POST("/notes", { body: data })),
  update: (id: string, updates: components["schemas"]["NoteUpdate"]) =>
    unwrap(
      client.PATCH("/notes/{noteId}", {
        params: { path: { noteId: id } },
        body: updates,
      }),
    ),
  delete: (id: string) =>
    unwrap(
      client.DELETE("/notes/{noteId}", { params: { path: { noteId: id } } }),
    ),
};

export const reportsApi = {
  generate: (config: ReportConfig) =>
    unwrap(client.POST("/reports", { body: config })),
};

export const searchApi = {
  search: async (
    query: string,
    options?: {
      types?: string[];
      caseId?: string;
      limit?: number;
      offset?: number;
    },
  ) => {
    const params = new URLSearchParams();
    params.set("q", query);
    if (options?.types?.length) {
      params.set("types", options.types.join(","));
    }
    if (options?.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options?.offset !== undefined) {
      params.set("offset", String(options.offset));
    }
    if (options?.caseId) {
      params.set("caseId", options.caseId);
    }
    const res = await fetch(`/api/search?${params.toString()}`, {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
};

// --- Evaluations API ---
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

export type EvaluationType = {
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

export type SchedulerStatus = {
  enabled: boolean;
  running: boolean;
  lastRunTime: string | null;
  nextRunTime: string | null;
  timezone: string;
  cronExpression: string;
  channels: {
    firebase: { configured: boolean; tokenCount: number };
    twilio: { configured: boolean; recipientCount: number };
  };
};

export const deviceTokensApi = {
  list: async (): Promise<DeviceToken[]> => {
    const res = await fetch("/api/device-tokens", {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  create: async (data: {
    token: string;
    platform: "ios" | "android" | "web";
  }): Promise<DeviceToken> => {
    const res = await fetch("/api/device-tokens", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`/api/device-tokens/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  },
};

export const smsRecipientsApi = {
  list: async (): Promise<SmsRecipient[]> => {
    const res = await fetch("/api/sms-recipients", {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  create: async (data: {
    phone: string;
    name?: string;
  }): Promise<SmsRecipient> => {
    const res = await fetch("/api/sms-recipients", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`/api/sms-recipients/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  },
};

export const evaluationsApi = {
  list: async (): Promise<EvaluationType[]> => {
    const res = await fetch("/api/evaluations", {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  get: async (id: string): Promise<EvaluationType | null> => {
    const res = await fetch(`/api/evaluations/${id}`, {
      headers: await getAuthHeaders(),
    });
    if (res.status === 404) return null;
    return res.json();
  },
  trigger: async (): Promise<{
    evaluationId: string;
    pushSent: boolean;
    smsSent: boolean;
  }> => {
    const res = await fetch("/api/evaluations/trigger", {
      method: "POST",
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
};

export const schedulerApi = {
  status: async (): Promise<SchedulerStatus> => {
    const res = await fetch("/api/scheduler/status", {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
};

export interface ServerConfig {
  firebase?: {
    projectId?: string;
    privateKey?: string;
    clientEmail?: string;
    projectIdSource?: "database" | "environment";
    privateKeySource?: "database" | "environment";
    clientEmailSource?: "database" | "environment";
  };
  twilio?: {
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;
    accountSidSource?: "database" | "environment";
    authTokenSource?: "database" | "environment";
    phoneNumberSource?: "database" | "environment";
  };
  scheduler?: {
    timezone?: string;
    enabled?: boolean;
    timezoneSource?: "database" | "environment";
    enabledSource?: "database" | "environment";
  };
  ai?: {
    openaiApiKey?: string;
    openaiEndpoint?: string;
    selectedModels?: string[];
    vlmModel?: string;
    openaiApiKeySource?: "database" | "environment";
    openaiEndpointSource?: "database" | "environment";
    selectedModelsSource?: "database" | "environment";
    vlmModelSource?: "database" | "environment";
  };
  autoIngest?: {
    directory?: string;
    directorySource?: "database" | "environment";
  };
  legalResearch?: {
    courtListenerApiToken?: string;
    legiscanApiKey?: string;
    govInfoApiKey?: string;
    serpapiBase?: string;
    courtListenerApiTokenSource?: "database" | "environment";
    legiscanApiKeySource?: "database" | "environment";
    govInfoApiKeySource?: "database" | "environment";
    serpapiBaseSource?: "database" | "environment";
  };
  prompts?: {
    chatSystemPrompt?: string;
    caseSummaryPrompt?: string;
    evaluatorPrompt?: string;
    chatSystemPromptSource?: "database" | "default";
    caseSummaryPromptSource?: "database" | "default";
    evaluatorPromptSource?: "database" | "default";
  };
}

export type DbSecurityStatus = {
  locked: boolean;
  encryptedAtRest: boolean;
  keyLoaded: boolean;
  lockReason: "missing_key" | "invalid_key" | null;
  passphraseConfigured: boolean;
};

export type OpenAIModelsResponse = {
  success: boolean;
  models: string[];
  endpoint?: string;
  error?: string;
};

export const configApi = {
  get: async (): Promise<ServerConfig> => {
    const res = await fetch("/api/config", {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  update: async (
    updates: Partial<ServerConfig>,
  ): Promise<{ success: boolean }> => {
    const res = await fetch("/api/config", {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },
  reset: async (): Promise<{ success: boolean }> => {
    const res = await fetch("/api/config/reset", {
      method: "POST",
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  deleteKey: async (
    group: string,
    key: string,
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/config/${group}/${key}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  testFirebase: async (): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch("/api/config/test-firebase", {
      method: "POST",
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  testTwilio: async (
    testPhone: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch("/api/config/test-twilio", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ testPhone }),
    });
    return res.json();
  },
  testOpenAI: async (): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch("/api/config/test-openai", {
      method: "POST",
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  reinitialize: async (service: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/config/reinitialize/${service}`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  getOpenAIModels: async (endpoint?: string): Promise<OpenAIModelsResponse> => {
    const url = new URL("/api/config/openai-models", window.location.origin);
    if (endpoint && endpoint.trim()) {
      url.searchParams.set("endpoint", endpoint.trim());
    }
    const res = await fetch(url.pathname + url.search, {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
};

export const securityApi = {
  status: async (token?: string): Promise<DbSecurityStatus> => {
    const res = await fetch("/api/security/status", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.json();
  },
  setupPassphrase: async (
    passphrase: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch("/api/security/setup-passphrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    return res.json();
  },
  verifyPassphrase: async (
    passphrase: string,
  ): Promise<{ valid: boolean; error?: string }> => {
    const res = await fetch("/api/security/verify-passphrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    return res.json();
  },
  applyRecoveryKey: async (
    recoveryKey: string,
  ): Promise<{
    success: boolean;
    status?: DbSecurityStatus;
    error?: string;
  }> => {
    const res = await fetch("/api/security/recovery-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryKey }),
    });
    return res.json();
  },
};

export const authApi = {
  login: async (
    passphrase: string,
    ttl?: string,
  ): Promise<{
    success: boolean;
    token: string;
    expiresIn: number;
    error?: string;
  }> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase, ttl }),
    });
    return res.json();
  },
};

// --- Estate Plans API ---
export type EstatePlanType = {
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
  beneficiaries: {
    id: string;
    name: string;
    relationship: string;
    dateOfBirth: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
  }[];
  assets: {
    id: string;
    name: string;
    category: string;
    estimatedValue: number;
    ownershipType: string;
    accountNumber: string;
    institution: string;
    beneficiaryIds: string[];
    notes: string;
  }[];
  documents: {
    id: string;
    type: string;
    title: string;
    status: string;
    content: string;
    fieldValues: Record<string, string>;
    templateId: string;
    reviewDate: string;
    signedDate: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  }[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const estatePlansApi = {
  list: async (): Promise<EstatePlanType[]> => {
    const res = await fetch("/api/estate-plans", {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  get: async (id: string): Promise<EstatePlanType | null> => {
    const res = await fetch(`/api/estate-plans/${id}`, {
      headers: await getAuthHeaders(),
    });
    if (res.status === 404) return null;
    return res.json();
  },
  create: async (data: Partial<EstatePlanType>): Promise<EstatePlanType> => {
    const res = await fetch("/api/estate-plans", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  update: async (
    id: string,
    updates: Partial<EstatePlanType>,
  ): Promise<EstatePlanType> => {
    const res = await fetch(`/api/estate-plans/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`/api/estate-plans/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  },
  addBeneficiary: async (
    planId: string,
    data: Record<string, unknown>,
  ): Promise<unknown> => {
    const res = await fetch(`/api/estate-plans/${planId}/beneficiaries`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  removeBeneficiary: async (planId: string, id: string): Promise<void> => {
    await fetch(`/api/estate-plans/${planId}/beneficiaries/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  },
  addAsset: async (
    planId: string,
    data: Record<string, unknown>,
  ): Promise<unknown> => {
    const res = await fetch(`/api/estate-plans/${planId}/assets`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  removeAsset: async (planId: string, id: string): Promise<void> => {
    await fetch(`/api/estate-plans/${planId}/assets/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  },
  addDocument: async (
    planId: string,
    data: Record<string, unknown>,
  ): Promise<unknown> => {
    const res = await fetch(`/api/estate-plans/${planId}/documents`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  updateDocument: async (
    planId: string,
    docId: string,
    updates: Record<string, unknown>,
  ): Promise<unknown> => {
    const res = await fetch(`/api/estate-plans/${planId}/documents/${docId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },
  removeDocument: async (planId: string, id: string): Promise<void> => {
    await fetch(`/api/estate-plans/${planId}/documents/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  },
};

// --- Fax API ---
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

export type FaxStatus = {
  configured: boolean;
  provider: string;
};

export const faxApi = {
  list: async (): Promise<FaxJob[]> => {
    const res = await fetch("/api/fax-jobs", {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
  get: async (id: string): Promise<FaxJob | null> => {
    const res = await fetch(`/api/fax-jobs/${id}`, {
      headers: await getAuthHeaders(),
    });
    if (res.status === 404) return null;
    return res.json();
  },
  send: async (data: {
    filingId: string;
    caseId?: string;
    recipientName?: string;
    recipientFax: string;
    documentPath?: string;
  }): Promise<FaxJob> => {
    const res = await fetch("/api/fax-jobs", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`/api/fax-jobs/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  },
  status: async (): Promise<FaxStatus> => {
    const res = await fetch("/api/fax/status", {
      headers: await getAuthHeaders(),
    });
    return res.json();
  },
};

export const researchAgentApi = {
  chat: async (
    messages: Array<{ role: string; content: string }>,
  ): Promise<{
    reply: string;
    toolResults: Array<{ toolName: string; results: unknown }>;
  }> => {
    const res = await fetch("/api/research/agent/chat", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`Research agent error: ${res.status}`);
    return res.json();
  },
};

export const api = {
  cases: casesApi,
  contacts: contactsApi,
  deadlines: deadlinesApi,
  finances: financesApi,
  notes: notesApi,
  evidences: evidencesApi,
  filings: filingsApi,
  reports: reportsApi,
  search: searchApi,
  deviceTokens: deviceTokensApi,
  smsRecipients: smsRecipientsApi,
  evaluations: evaluationsApi,
  scheduler: schedulerApi,
  config: configApi,
  security: securityApi,
  auth: authApi,
  estatePlans: estatePlansApi,
  researchAgent: researchAgentApi,
  fax: faxApi,
};
