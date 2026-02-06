const INTERVAL_HOURS = 3;

export interface CountdownInfo {
  nextRunAt: Date;
  relativeText: string;
  isOverdue: boolean;
}

/**
 * Calculate the next expected cron run time
 */
export function getNextCronRunTime(lastRunAt: string | null): Date {
  if (!lastRunAt) {
    // Never run, next run is "now"
    return new Date();
  }
  const last = new Date(lastRunAt);
  return new Date(last.getTime() + INTERVAL_HOURS * 60 * 60 * 1000);
}

/**
 * Get countdown info for the next cron run
 */
export function getCountdownInfo(lastRunAt: string | null): CountdownInfo {
  const nextRunAt = getNextCronRunTime(lastRunAt);
  const now = new Date();
  const diffMs = nextRunAt.getTime() - now.getTime();
  const isOverdue = diffMs <= 0;

  return {
    nextRunAt,
    relativeText: getRelativeTime(diffMs),
    isOverdue,
  };
}

/**
 * Format milliseconds until next run as relative text
 */
export function getRelativeTime(diffMs: number): string {
  if (diffMs <= 0) return "very soon";

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `in ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `in ${hours}h`;
  }
  if (minutes > 1) {
    return `in ${minutes} minutes`;
  }
  return "very soon";
}

/**
 * Format a date for display in the popup
 */
export function formatNextRunTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export const CRON_INTERVAL_HOURS = INTERVAL_HOURS;
