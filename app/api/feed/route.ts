import { NextRequest, NextResponse } from "next/server";
import { getFeedPosts, getTotalPosts } from "@/lib/db";
import type { FeedFilter, FeedResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const filter = (searchParams.get("filter") || "all") as FeedFilter;
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const since = searchParams.get("since") || undefined;

  const posts = getFeedPosts(filter, limit, offset, since);
  const total = getTotalPosts(filter);

  const response: FeedResponse = {
    posts,
    total,
    hasMore: offset + posts.length < total,
  };

  return NextResponse.json(response);
}
