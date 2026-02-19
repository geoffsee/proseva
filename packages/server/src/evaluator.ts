import OpenAI from "openai";
import {
  db,
  type Deadline,
  type Case,
  type DeadlineSummary,
  type Evaluation,
} from "./db";
import { getConfig } from "./config";
import { getEvaluatorPrompt } from "./prompts";

/**
 * Parse an ISO date string (YYYY-MM-DD) as a local date without timezone conversion
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate days difference between a date and today
 */
function getDaysDiff(dateStr: string): number {
  const targetDate = parseLocalDate(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(
    (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Convert deadline to summary with case info
 */
function toDeadlineSummary(
  deadline: Deadline,
  cases: Map<string, Case>,
): DeadlineSummary {
  const caseInfo = deadline.caseId ? cases.get(deadline.caseId) : undefined;
  const daysDiff = getDaysDiff(deadline.date);

  return {
    id: deadline.id,
    title: deadline.title,
    date: deadline.date,
    caseId: deadline.caseId,
    caseName: caseInfo?.name,
    type: deadline.type,
    daysOverdue: daysDiff < 0 ? Math.abs(daysDiff) : undefined,
    daysUntil: daysDiff >= 0 ? daysDiff : undefined,
  };
}

/**
 * Analyze deadlines and generate evaluation data
 */
export async function analyzeDeadlines(): Promise<{
  overdueDeadlines: DeadlineSummary[];
  upcomingDeadlines: DeadlineSummary[];
  tomorrowActions: string[];
  aiSummary: string;
}> {
  const deadlines = [...db.deadlines.values()];
  const cases = db.cases;

  // Filter incomplete deadlines
  const activeDeadlines = deadlines.filter((d) => !d.completed);

  // Categorize by urgency
  const overdue: DeadlineSummary[] = [];
  const upcoming: DeadlineSummary[] = []; // Next 7 days

  for (const deadline of activeDeadlines) {
    const daysDiff = getDaysDiff(deadline.date);
    const summary = toDeadlineSummary(deadline, cases);

    if (daysDiff < 0) {
      overdue.push(summary);
    } else if (daysDiff <= 7) {
      upcoming.push(summary);
    }
  }

  // Sort overdue by most overdue first
  overdue.sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0));

  // Sort upcoming by nearest first
  upcoming.sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));

  // Generate tomorrow's specific actions
  const tomorrowDeadlines = upcoming.filter((d) => d.daysUntil === 1);
  const tomorrowActions = tomorrowDeadlines.map((d) => {
    const caseRef = d.caseName ? ` (${d.caseName})` : "";
    return `${d.title}${caseRef} - ${d.type}`;
  });

  // Generate AI summary
  const aiSummary = await generateAiSummary({
    overdue,
    upcoming,
    tomorrowActions,
    totalActive: activeDeadlines.length,
  });

  return {
    overdueDeadlines: overdue,
    upcomingDeadlines: upcoming,
    tomorrowActions,
    aiSummary,
  };
}

/**
 * Generate AI-powered strategic summary
 */
async function generateAiSummary(data: {
  overdue: DeadlineSummary[];
  upcoming: DeadlineSummary[];
  tomorrowActions: string[];
  totalActive: number;
}): Promise<string> {
  // If no deadlines, return simple message
  if (data.totalActive === 0) {
    return "No active deadlines. Your calendar is clear.";
  }

  if (data.overdue.length === 0 && data.upcoming.length === 0) {
    return "No immediate deadlines. All items are scheduled for more than a week out.";
  }

  try {
    const openai = new OpenAI({
      apiKey: getConfig('OPENAI_API_KEY'),
      baseURL: getConfig('OPENAI_ENDPOINT'),
    });


    const overdueText =
      data.overdue.length > 0
        ? `OVERDUE (${data.overdue.length}):\n${data.overdue
            .map(
              (d) =>
                `- ${d.title}${d.caseName ? ` (${d.caseName})` : ""}: ${d.daysOverdue} days overdue`,
            )
            .join("\n")}`
        : "No overdue deadlines.";

    const upcomingText =
      data.upcoming.length > 0
        ? `UPCOMING (next 7 days, ${data.upcoming.length}):\n${data.upcoming
            .map(
              (d) =>
                `- ${d.title}${d.caseName ? ` (${d.caseName})` : ""}: ${d.daysUntil === 0 ? "TODAY" : d.daysUntil === 1 ? "TOMORROW" : `in ${d.daysUntil} days`}`,
            )
            .join("\n")}`
        : "No upcoming deadlines in the next 7 days.";

    // Get the configured prompt template and substitute values
    const promptTemplate = getEvaluatorPrompt();
    const replacements: Record<string, string> = {
      "{overdueText}": overdueText,
      "{upcomingText}": upcomingText,
    };
    const prompt = promptTemplate.replace(
      /\{overdueText\}|\{upcomingText\}/g,
      (match) => replacements[match] || match,
    );

    const completion = await openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });

    return (
      completion.choices[0]?.message?.content?.trim() ??
      "Unable to generate summary."
    );
  } catch (error) {
    console.error("[evaluator] AI summary generation failed:", error);

    // Fallback to basic summary
    const parts: string[] = [];
    if (data.overdue.length > 0) {
      parts.push(
        `${data.overdue.length} overdue deadline${data.overdue.length > 1 ? "s" : ""} requiring immediate attention`,
      );
    }
    if (data.upcoming.length > 0) {
      parts.push(
        `${data.upcoming.length} deadline${data.upcoming.length > 1 ? "s" : ""} in the next 7 days`,
      );
    }
    if (data.tomorrowActions.length > 0) {
      parts.push(
        `${data.tomorrowActions.length} item${data.tomorrowActions.length > 1 ? "s" : ""} due tomorrow`,
      );
    }

    return parts.join(". ") + ".";
  }
}

/**
 * Create notification content from analysis
 */
export function createNotificationContent(analysis: {
  overdueDeadlines: DeadlineSummary[];
  upcomingDeadlines: DeadlineSummary[];
  tomorrowActions: string[];
  aiSummary: string;
}): { title: string; body: string } {
  const { overdueDeadlines, upcomingDeadlines, tomorrowActions } = analysis;

  // Determine title based on urgency
  let title = "Daily Case Update";
  if (overdueDeadlines.length > 0) {
    title = `⚠️ ${overdueDeadlines.length} Overdue Deadline${overdueDeadlines.length > 1 ? "s" : ""}`;
  } else if (tomorrowActions.length > 0) {
    title = `📅 ${tomorrowActions.length} Due Tomorrow`;
  }

  // Build body
  const parts: string[] = [];

  if (overdueDeadlines.length > 0) {
    parts.push(`${overdueDeadlines.length} overdue`);
  }
  if (tomorrowActions.length > 0) {
    parts.push(`${tomorrowActions.length} due tomorrow`);
  }
  if (upcomingDeadlines.length > 0) {
    parts.push(`${upcomingDeadlines.length} this week`);
  }

  let body = parts.join(", ");

  // Add top priority item if exists
  const topPriority = overdueDeadlines[0] ?? upcomingDeadlines[0];
  if (topPriority) {
    body += `. Top priority: ${topPriority.title}`;
  }

  // Fallback if nothing to report
  if (!body) {
    body = "No immediate deadlines. Calendar is clear.";
  }

  return { title, body };
}

/**
 * Run a full evaluation cycle
 */
export async function runEvaluation(): Promise<Evaluation> {
  const evaluation: Evaluation = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
    analysis: {
      overdueDeadlines: [],
      upcomingDeadlines: [],
      tomorrowActions: [],
      aiSummary: "",
    },
    notification: {
      title: "",
      body: "",
    },
  };

  try {
    // Save initial pending state
    db.evaluations.set(evaluation.id, evaluation);
    db.persist();

    // Run analysis
    evaluation.status = "analyzing";
    db.persist();

    const analysis = await analyzeDeadlines();
    evaluation.analysis = analysis;

    // Create notification content
    const notificationContent = createNotificationContent(analysis);
    evaluation.notification.title = notificationContent.title;
    evaluation.notification.body = notificationContent.body;

    evaluation.status = "sending";
    db.persist();

    return evaluation;
  } catch (error) {
    evaluation.status = "failed";
    evaluation.error = error instanceof Error ? error.message : "Unknown error";
    db.evaluations.set(evaluation.id, evaluation);
    db.persist();
    throw error;
  }
}

/**
 * Mark evaluation as sent
 */
export function markEvaluationSent(
  evaluationId: string,
  results: { pushSent?: boolean; smsSent?: boolean },
): void {
  const evaluation = db.evaluations.get(evaluationId);
  if (evaluation) {
    evaluation.status = "sent";
    evaluation.notification.sentAt = new Date().toISOString();
    evaluation.notification.pushSent = results.pushSent;
    evaluation.notification.smsSent = results.smsSent;
    db.persist();
  }
}

/**
 * Mark evaluation as failed
 */
export function markEvaluationFailed(
  evaluationId: string,
  error: string,
): void {
  const evaluation = db.evaluations.get(evaluationId);
  if (evaluation) {
    evaluation.status = "failed";
    evaluation.error = error;
    db.persist();
  }
}
