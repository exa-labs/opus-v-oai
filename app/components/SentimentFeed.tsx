"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FeedCard from "./FeedCard";
import FilterTabs from "./FilterTabs";
import type { Post, FeedFilter, FeedResponse } from "@/lib/types";

export default function SentimentFeed({
  initialPosts,
}: {
  initialPosts: Post[];
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(initialPosts.length);
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(
    async (newFilter: FeedFilter, reset = true) => {
      setLoading(true);
      try {
        const newOffset = reset ? 0 : offset;
        const res = await fetch(
          `/api/feed?filter=${newFilter}&limit=50&offset=${newOffset}`
        );
        const data: FeedResponse = await res.json();

        if (reset) {
          setPosts(data.posts);
          setOffset(data.posts.length);
        } else {
          setPosts((prev) => [...prev, ...data.posts]);
          setOffset((prev) => prev + data.posts.length);
        }
        setHasMore(data.hasMore);
      } catch (err) {
        console.error("Failed to fetch feed:", err);
      } finally {
        setLoading(false);
      }
    },
    [offset]
  );

  const handleFilterChange = (newFilter: FeedFilter) => {
    setFilter(newFilter);
    setOffset(0);
    setHasMore(true);
    fetchPosts(newFilter, true);
  };

  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchPosts(filter, false);
        }
      },
      { threshold: 0.1 }
    );

    const current = observerRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, [hasMore, loading, filter, fetchPosts]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs active={filter} onChange={handleFilterChange} />
        <span className="text-xs text-white/30">
          {posts.length} sources
        </span>
      </div>

      <div className="space-y-2">
        {posts.map((post) => (
          <FeedCard key={post.id} post={post} />
        ))}

        {posts.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
            <p className="text-sm text-white/40">
              No posts yet. Run a cron scan to discover sources.
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="shimmer-bg h-24 rounded-lg opacity-10" />
            ))}
          </div>
        )}
      </div>

      {hasMore && <div ref={observerRef} className="h-10" />}
    </div>
  );
}
