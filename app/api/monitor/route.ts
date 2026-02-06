import { NextResponse } from "next/server";
import { getLatestCompletedRun } from "@/lib/db";
import { CRON_INTERVAL_HOURS } from "@/lib/cron-utils";
import type { MonitorResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const lastRun = await getLatestCompletedRun();

  const response: MonitorResponse = {
    lastRunAt: lastRun?.completed_at || null,
    intervalHours: CRON_INTERVAL_HOURS,
    lastRun,
    status: lastRun ? "active" : "never_run",
  };

  return NextResponse.json(response);
}
