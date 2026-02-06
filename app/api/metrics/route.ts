import { NextResponse } from "next/server";
import { getLatestMetrics, getLatestCompletedRun } from "@/lib/db";
import type { MetricsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const claude = getLatestMetrics("claude");
  const openai = getLatestMetrics("openai");
  const lastRun = getLatestCompletedRun();

  const response: MetricsResponse = {
    claude,
    openai,
    lastRun,
  };

  return NextResponse.json(response);
}
