import { NextResponse } from "next/server";
import { getLatestMetrics, getLatestCompletedRun } from "@/lib/db";
import type { MetricsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const claude = await getLatestMetrics("claude");
  const openai = await getLatestMetrics("openai");
  const lastRun = await getLatestCompletedRun();

  const response: MetricsResponse = {
    claude,
    openai,
    lastRun,
  };

  return NextResponse.json(response);
}
