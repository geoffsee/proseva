export interface Party {
  id: string;
  name: string;
  role: string; // e.g. "Plaintiff", "Defendant", "Attorney"
  contact?: string;
}

export interface Filing {
  id: string;
  title: string;
  date: string; // ISO date
  type: string; // e.g. "Motion", "Order", "Response"
  notes?: string;
  caseId?: string;
}

export interface Case {
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
}

export interface Deadline {
  id: string;
  caseId?: string;
  title: string;
  date: string;
  type: "filing" | "hearing" | "discovery" | "other";
  completed: boolean;
  description?: string;
  priority?: "low" | "medium" | "high";
  urgency?: "overdue" | "urgent" | "upcoming" | "future";
  daysUntil?: number;
}

export interface FinancialEntry {
  id: string;
  category: "income" | "expense";
  subcategory: string;
  amount: number;
  frequency: "one-time" | "weekly" | "biweekly" | "monthly" | "annually";
  date: string;
  description?: string;
}

export interface Contact {
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
  organization?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  caseId?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  fields: TemplateField[];
  outputFormat: string; // template string with {{fieldName}} placeholders
}

export interface TemplateField {
  name: string;
  label: string;
  type: "text" | "date" | "textarea" | "select";
  required: boolean;
  options?: string[]; // for select fields
}

export interface Note {
  id: string;
  title: string;
  content: string; // Markdown content
  category: "case-notes" | "research" | "todo" | "general" | "other";
  tags: string[];
  caseId?: string;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
}

export interface Evidence {
  id: string;
  caseId?: string;
  exhibitNumber?: string; // e.g., "Exhibit A", "Exhibit 1"
  title: string;
  description?: string;
  type:
    | "document"
    | "photo"
    | "video"
    | "audio"
    | "physical"
    | "testimony"
    | "digital"
    | "other";
  fileUrl?: string;
  dateCollected?: string;
  location?: string;
  tags: string[];
  relevance: "high" | "medium" | "low";
  admissible?: boolean;
  chain: ChainOfCustodyEntry[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChainOfCustodyEntry {
  id: string;
  date: string;
  transferredFrom?: string;
  transferredTo: string;
  purpose: string;
  notes?: string;
}

export interface Beneficiary {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface EstateAsset {
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
  accountNumber?: string;
  institution?: string;
  beneficiaryIds: string[];
  notes?: string;
}

export interface EstateDocument {
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
  templateId?: string;
  reviewDate?: string;
  signedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EstatePlan {
  id: string;
  title: string;
  status: "planning" | "drafting" | "review" | "complete";
  testatorName: string;
  testatorDateOfBirth?: string;
  testatorAddress?: string;
  executorName: string;
  executorPhone?: string;
  executorEmail?: string;
  guardianName?: string;
  guardianPhone?: string;
  beneficiaries: Beneficiary[];
  assets: EstateAsset[];
  documents: EstateDocument[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportConfig {
  type: "case-summary" | "evidence-analysis" | "financial" | "chronology";
  caseId?: string;
  dateRange?: { from: string; to: string };
  options: {
    includeAI: boolean;
    includeChainOfCustody?: boolean;
  };
  [key: string]: unknown;
}

export interface ReportSection {
  heading: string;
  content: string;
  type: "narrative" | "table" | "list";
}

export interface GeneratedReport {
  title: string;
  sections: ReportSection[];
  metadata: {
    generatedAt: string;
    caseName?: string;
    dateRange?: string;
  };
}
