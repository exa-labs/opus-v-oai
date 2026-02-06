"use client";

import { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import MonitorPopup from "./MonitorPopup";
import { getRelativeTimeClient } from "@/lib/cron-utils-client";
import type { MonitorResponse } from "@/lib/types";

export default function CountdownButton() {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [countdown, setCountdown] = useState("Loading...");
  const [nextRunAt, setNextRunAt] = useState<Date | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchMonitor() {
      try {
        const res = await fetch("/api/monitor");
        const json: MonitorResponse = await res.json();
        setData(json);
        if (json.lastRunAt) {
          const next = new Date(
            new Date(json.lastRunAt).getTime() +
              json.intervalHours * 60 * 60 * 1000
          );
          setNextRunAt(next);
        }
      } catch {
        setCountdown("Offline");
      }
    }
    fetchMonitor();
  }, []);

  useEffect(() => {
    if (!nextRunAt) return;
    function tick() {
      const diffMs = nextRunAt!.getTime() - Date.now();
      setCountdown(getRelativeTimeClient(diffMs));
    }
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [nextRunAt]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setShowPopup(false);
      }
    }
    if (showPopup) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showPopup]);

  return (
    <div ref={buttonRef} className="relative">
      <button
        onClick={() => setShowPopup(!showPopup)}
        className="flex items-center gap-2 rounded-lg border border-exa-gray-300 bg-exa-gray-100 px-3 py-2 text-xs font-medium text-exa-gray-700 shadow-button-sm transition-all hover:border-exa-gray-400 hover:text-exa-black"
      >
        <Clock size={14} className="text-exa-blue" />
        <span>Next update {countdown}</span>
      </button>

      {showPopup && nextRunAt && (
        <MonitorPopup
          nextRunAt={nextRunAt}
          lastRun={data?.lastRun || null}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}
