import OpenAI from "openai";
import { db } from "./db";
import { getConfig } from "./config";

interface ReportConfig {
  type: "case-summary" | "evidence-analysis" | "financial" | "chronology";
  caseId?: string;
  dateRange?: { from: string; to: string };
  options: {
    includeAI: boolean;
    includeChainOfCustody?: boolean;
  };
}

interface ReportSection {
  heading: string;
  content: string;
  type: "narrative" | "table" | "list";
}

interface GeneratedReport {
  title: string;
  sections: ReportSection[];
  metadata: {
    generatedAt: string;
    caseName?: string;
    dateRange?: string;
  };
}

// Helper function to format dates
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Format deadlines as a table
function formatDeadlinesTable(deadlines: any[]): string {
  if (deadlines.length === 0) {
    return "No deadlines found.";
  }

  let result = "| Date | Title | Type | Status |\n";
  result += "|------|-------|------|--------|\n";

  for (const d of deadlines) {
    const status = d.completed ? "✓ Complete" : "Pending";
    result += `| ${formatDate(d.date)} | ${d.title} | ${d.type} | ${status} |\n`;
  }

  return result;
}

// Format evidence as a list
function formatEvidenceList(
  evidence: any[],
  includeChainOfCustody: boolean = false,
): string {
  if (evidence.length === 0) {
    return "No evidence found.";
  }

  return evidence
    .map((e) => {
      let result = `• ${e.exhibitNumber || "N/A"}: ${e.title}\n`;
      result += `  Type: ${e.type} | Relevance: ${e.relevance} | Admissible: ${e.admissible ? "Yes" : "No"}\n`;

      if (e.description) {
        result += `  Description: ${e.description}\n`;
      }

      if (includeChainOfCustody && e.chain && e.chain.length > 0) {
        result += `  Chain of Custody:\n`;
        for (const entry of e.chain) {
          result += `    - ${formatDate(entry.date)}: ${entry.transferredFrom ? entry.transferredFrom + " → " : ""}${entry.transferredTo} (${entry.purpose})\n`;
        }
      }

      return result;
    })
    .join("\n");
}

// Format filings as a table
function formatFilingsTable(filings: any[]): string {
  if (filings.length === 0) {
    return "No filings found.";
  }

  let result = "| Date | Title | Type | Notes |\n";
  result += "|------|-------|------|-------|\n";

  for (const f of filings) {
    const notes = f.notes
      ? f.notes.substring(0, 50) + (f.notes.length > 50 ? "..." : "")
      : "—";
    result += `| ${formatDate(f.date)} | ${f.title} | ${f.type || "—"} | ${notes} |\n`;
  }

  return result;
}

// Format contacts as a list
function formatContactsList(contacts: any[]): string {
  if (contacts.length === 0) {
    return "No contacts found.";
  }

  return contacts
    .map((c) => {
      let result = `• ${c.name} (${c.role})\n`;
      if (c.organization) result += `  Organization: ${c.organization}\n`;
      if (c.email) result += `  Email: ${c.email}\n`;
      if (c.phone) result += `  Phone: ${c.phone}\n`;
      return result;
    })
    .join("\n");
}

// Format case overview
function formatCaseOverview(caseData: any): string {
  let result = `**Case Name:** ${caseData.name}\n`;
  result += `**Case Number:** ${caseData.caseNumber || "N/A"}\n`;
  result += `**Court:** ${caseData.court || "N/A"}\n`;
  result += `**Case Type:** ${caseData.caseType || "N/A"}\n`;
  result += `**Status:** ${caseData.status}\n`;
  result += `**Created:** ${formatDate(caseData.createdAt)}\n`;

  if (caseData.notes) {
    result += `\n**Notes:**\n${caseData.notes}\n`;
  }

  return result;
}

// AI summary generation
async function generateAISummary(
  caseData: any,
  deadlines: any[],
  evidence: any[],
  filings: any[],
): Promise<string> {
  const apiKey = getConfig("OPENAI_API_KEY");
  const endpoint = getConfig("OPENAI_ENDPOINT");

  if (!apiKey) {
    return "AI analysis unavailable (API key not configured).";
  }

  try {
    const openai = new OpenAI({
      apiKey,
      baseURL: endpoint || undefined,
    });

    const pendingDeadlines = deadlines.filter((d) => !d.completed);
    const highRelevanceEvidence = evidence.filter(
      (e) => e.relevance === "high",
    );

    const prompt = `As a legal case analyst, provide a concise strategic summary:

Case: ${caseData.name}
Type: ${caseData.caseType || "N/A"}
Status: ${caseData.status}
Deadlines: ${deadlines.length} total (${pendingDeadlines.length} pending)
Evidence: ${evidence.length} items (${highRelevanceEvidence.length} high relevance)
Filings: ${filings.length} documents

Provide:
1. Case strength assessment (2-3 sentences)
2. Key upcoming deadlines to prioritize
3. Evidence gaps or recommendations

Keep it concise and actionable for a pro se litigant.`;

    const completion = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return (
      completion.choices[0].message.content ||
      "AI analysis could not be generated."
    );
  } catch (error) {
    console.error("AI summary generation failed:", error);
    return "AI analysis failed to generate.";
  }
}

// Case Summary Report Generator
export async function generateCaseSummary(
  config: ReportConfig,
): Promise<Response> {
  if (!config.caseId) {
    return new Response("Case ID required", { status: 400 });
  }

  const caseData = db.cases.get(config.caseId);
  if (!caseData) {
    return new Response("Case not found", { status: 404 });
  }

  const deadlines = [...db.deadlines.values()].filter(
    (d) => d.caseId === config.caseId,
  );
  const evidence = [...db.evidences.values()].filter(
    (e) => e.caseId === config.caseId,
  );
  const filings = [...db.filings.values()].filter(
    (f) => f.caseId === config.caseId,
  );
  const contacts = [...db.contacts.values()].filter(
    (c) => c.caseId === config.caseId,
  );

  const sections: ReportSection[] = [
    {
      heading: "Case Overview",
      content: formatCaseOverview(caseData),
      type: "narrative",
    },
    {
      heading: "Deadlines",
      content: formatDeadlinesTable(deadlines),
      type: "table",
    },
    {
      heading: "Evidence",
      content: formatEvidenceList(evidence),
      type: "list",
    },
    {
      heading: "Filings",
      content: formatFilingsTable(filings),
      type: "table",
    },
    {
      heading: "Key Contacts",
      content: formatContactsList(contacts),
      type: "list",
    },
  ];

  // Optional AI analysis
  if (config.options.includeAI) {
    const aiSummary = await generateAISummary(
      caseData,
      deadlines,
      evidence,
      filings,
    );
    sections.push({
      heading: "AI Strategic Analysis",
      content: aiSummary,
      type: "narrative",
    });
  }

  const report: GeneratedReport = {
    title: `Case Summary: ${caseData.name}`,
    sections,
    metadata: {
      generatedAt: new Date().toISOString(),
      caseName: caseData.name,
    },
  };

  return Response.json(report);
}

// Evidence Analysis Report Generator
export async function generateEvidenceAnalysis(
  config: ReportConfig,
): Promise<Response> {
  if (!config.caseId) {
    return new Response("Case ID required", { status: 400 });
  }

  const caseData = db.cases.get(config.caseId);
  if (!caseData) {
    return new Response("Case not found", { status: 404 });
  }

  const evidence = [...db.evidences.values()].filter(
    (e) => e.caseId === config.caseId,
  );

  // Group evidence by relevance
  const highRelevance = evidence.filter((e) => e.relevance === "high");
  const mediumRelevance = evidence.filter((e) => e.relevance === "medium");
  const lowRelevance = evidence.filter((e) => e.relevance === "low");

  const sections: ReportSection[] = [
    {
      heading: "Summary Statistics",
      content:
        `Total Evidence Items: ${evidence.length}\n` +
        `High Relevance: ${highRelevance.length}\n` +
        `Medium Relevance: ${mediumRelevance.length}\n` +
        `Low Relevance: ${lowRelevance.length}\n` +
        `Admissible: ${evidence.filter((e) => e.admissible).length}\n` +
        `Not Admissible: ${evidence.filter((e) => !e.admissible).length}`,
      type: "narrative",
    },
    {
      heading: "High Relevance Evidence",
      content: formatEvidenceList(
        highRelevance,
        config.options.includeChainOfCustody,
      ),
      type: "list",
    },
    {
      heading: "Medium Relevance Evidence",
      content: formatEvidenceList(
        mediumRelevance,
        config.options.includeChainOfCustody,
      ),
      type: "list",
    },
    {
      heading: "Low Relevance Evidence",
      content: formatEvidenceList(
        lowRelevance,
        config.options.includeChainOfCustody,
      ),
      type: "list",
    },
  ];

  const report: GeneratedReport = {
    title: `Evidence Analysis: ${caseData.name}`,
    sections,
    metadata: {
      generatedAt: new Date().toISOString(),
      caseName: caseData.name,
    },
  };

  return Response.json(report);
}

// Financial Summary Report Generator
export async function generateFinancialReport(
  config: ReportConfig,
): Promise<Response> {
  let finances = [...db.finances.values()];

  // Apply date range filter if provided
  if (config.dateRange?.from && config.dateRange?.to) {
    finances = finances.filter((f) => {
      const fDate = new Date(f.date);
      const fromDate = new Date(config.dateRange!.from);
      const toDate = new Date(config.dateRange!.to);
      return fDate >= fromDate && fDate <= toDate;
    });
  }

  // Calculate totals
  const expenses = finances.filter((f) => f.category === "expense");
  const income = finances.filter((f) => f.category === "income");

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  // Group expenses by subcategory
  const expensesByCategory: Record<string, number> = {};
  for (const expense of expenses) {
    expensesByCategory[expense.subcategory] =
      (expensesByCategory[expense.subcategory] || 0) + expense.amount;
  }

  // Format expense breakdown
  let expenseBreakdown = "| Category | Amount |\n|----------|--------|\n";
  for (const [category, amount] of Object.entries(expensesByCategory)) {
    expenseBreakdown += `| ${category} | $${amount.toFixed(2)} |\n`;
  }
  expenseBreakdown += `| **Total** | **$${totalExpenses.toFixed(2)}** |\n`;

  const sections: ReportSection[] = [
    {
      heading: "Summary",
      content:
        `Total Income: $${totalIncome.toFixed(2)}\n` +
        `Total Expenses: $${totalExpenses.toFixed(2)}\n` +
        `Net Balance: $${netBalance.toFixed(2)}`,
      type: "narrative",
    },
    {
      heading: "Expense Breakdown",
      content: expenseBreakdown,
      type: "table",
    },
  ];

  const dateRangeStr = config.dateRange
    ? `${formatDate(config.dateRange.from)} - ${formatDate(config.dateRange.to)}`
    : "All Time";

  const report: GeneratedReport = {
    title: "Financial Summary",
    sections,
    metadata: {
      generatedAt: new Date().toISOString(),
      dateRange: dateRangeStr,
    },
  };

  return Response.json(report);
}

// Chronology Report Generator
export async function generateChronologyReport(
  config: ReportConfig,
): Promise<Response> {
  // Collect all events from different sources
  interface TimelineEvent {
    date: string;
    type: string;
    title: string;
    details?: string;
  }

  const events: TimelineEvent[] = [];

  // Add deadlines
  for (const deadline of db.deadlines.values()) {
    if (config.dateRange) {
      const dDate = new Date(deadline.date);
      const fromDate = new Date(config.dateRange.from);
      const toDate = new Date(config.dateRange.to);
      if (dDate < fromDate || dDate > toDate) continue;
    }

    events.push({
      date: deadline.date,
      type: "Deadline",
      title: deadline.title,
      details: `Type: ${deadline.type} | Status: ${deadline.completed ? "Complete" : "Pending"}`,
    });
  }

  // Add filings
  for (const filing of db.filings.values()) {
    if (config.dateRange) {
      const fDate = new Date(filing.date);
      const fromDate = new Date(config.dateRange.from);
      const toDate = new Date(config.dateRange.to);
      if (fDate < fromDate || fDate > toDate) continue;
    }

    events.push({
      date: filing.date,
      type: "Filing",
      title: filing.title,
      details: filing.type || undefined,
    });
  }

  // Add evidence collection dates
  for (const evidence of db.evidences.values()) {
    if (evidence.dateCollected) {
      if (config.dateRange) {
        const eDate = new Date(evidence.dateCollected);
        const fromDate = new Date(config.dateRange.from);
        const toDate = new Date(config.dateRange.to);
        if (eDate < fromDate || eDate > toDate) continue;
      }

      events.push({
        date: evidence.dateCollected,
        type: "Evidence",
        title: evidence.title,
        details: `Type: ${evidence.type}`,
      });
    }
  }

  // Sort events chronologically
  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Format as a list
  let chronologyContent = "";
  if (events.length === 0) {
    chronologyContent = "No events found in the specified date range.";
  } else {
    chronologyContent = events
      .map((e) => {
        let result = `**${formatDate(e.date)}** - [${e.type}] ${e.title}`;
        if (e.details) {
          result += `\n  ${e.details}`;
        }
        return result;
      })
      .join("\n\n");
  }

  const dateRangeStr = config.dateRange
    ? `${formatDate(config.dateRange.from)} - ${formatDate(config.dateRange.to)}`
    : "All Time";

  const report: GeneratedReport = {
    title: "Case Chronology",
    sections: [
      {
        heading: "Timeline of Events",
        content: chronologyContent,
        type: "list",
      },
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      dateRange: dateRangeStr,
    },
  };

  return Response.json(report);
}

/**
 * Test OpenAI connection by making a simple completion request.
 */
export async function testOpenAIConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  const apiKey = getConfig("OPENAI_API_KEY");
  const endpoint = getConfig("OPENAI_ENDPOINT");

  if (!apiKey) {
    return { success: false, error: "OpenAI API key not configured" };
  }

  try {
    const openai = new OpenAI({
      apiKey,
      baseURL: endpoint || undefined,
    });

    const completion = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
      messages: [{ role: "user", content: "Test connection. Reply with OK." }],
      max_tokens: 10,
    });

    const response = completion.choices[0].message.content || "";
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}
