import { Cron } from "croner";
import { runEvaluation } from "./evaluator";
import { sendNotification } from "./notifications";
import { getConfig } from "./config";

let schedulerJob: Cron | null = null;
let lastRunTime: Date | null = null;
let isRunning = false;

/**
 * Run the daily evaluation cycle
 */
async function runDailyEvaluation(): Promise<void> {
  if (isRunning) {
    console.log("[scheduler] Evaluation already running, skipping");
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  console.log(
    `[scheduler] Starting daily evaluation at ${lastRunTime.toISOString()}`,
  );

  try {
    // Run the evaluation
    const evaluation = await runEvaluation();
    console.log(
      `[scheduler] Analysis complete: ${evaluation.analysis.overdueDeadlines.length} overdue, ${evaluation.analysis.upcomingDeadlines.length} upcoming`,
    );

    // Send notifications
    const result = await sendNotification(evaluation);
    console.log(
      `[scheduler] Notifications sent - Push: ${result.pushSent}, SMS: ${result.smsSent}`,
    );
  } catch (error) {
    console.error("[scheduler] Daily evaluation failed:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize the scheduler
 */
export function initScheduler(): void {
  const enabled = getConfig("EVALUATION_ENABLED") !== "false";

  if (!enabled) {
    console.log(
      "[scheduler] Evaluation scheduler disabled via EVALUATION_ENABLED=false",
    );
    return;
  }

  // Get timezone from config or use system default
  const timezone =
    getConfig("EVALUATION_TIMEZONE") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Schedule for 6 PM daily
  // Cron format: second minute hour day-of-month month day-of-week
  const cronExpression = "0 0 18 * * *"; // 6:00 PM

  schedulerJob = new Cron(
    cronExpression,
    {
      timezone,
    },
    runDailyEvaluation,
  );

  const nextRun = schedulerJob.nextRun();
  console.log(
    `[scheduler] Initialized - Next run: ${nextRun?.toISOString()} (${timezone})`,
  );
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
    console.log("[scheduler] Stopped");
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  enabled: boolean;
  running: boolean;
  lastRunTime: string | null;
  nextRunTime: string | null;
  timezone: string;
  cronExpression: string;
} {
  const timezone =
    getConfig("EVALUATION_TIMEZONE") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    enabled: schedulerJob !== null,
    running: isRunning,
    lastRunTime: lastRunTime?.toISOString() ?? null,
    nextRunTime: schedulerJob?.nextRun()?.toISOString() ?? null,
    timezone,
    cronExpression: "0 0 18 * * *", // 6 PM daily
  };
}

/**
 * Restart scheduler after config change.
 */
export async function restartScheduler(): Promise<void> {
  console.log("[scheduler] Restarting with new configuration");
  stopScheduler();
  initScheduler();
}

/**
 * Manually trigger an evaluation (for testing)
 */
export async function triggerEvaluation(): Promise<{
  evaluationId: string;
  pushSent: boolean;
  smsSent: boolean;
}> {
  console.log("[scheduler] Manual evaluation triggered");

  const evaluation = await runEvaluation();
  const result = await sendNotification(evaluation);

  return {
    evaluationId: evaluation.id,
    ...result,
  };
}
