/**
 * Parse an ISO date string (YYYY-MM-DD) as a local date without timezone conversion
 * This prevents dates from shifting due to timezone offsets
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a date string (YYYY-MM-DD) for display
 */
export function formatDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString("en-US", options);
}

/**
 * Parse an ISO timestamp string (with time) as a Date
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}
