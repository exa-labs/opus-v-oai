"use client";

import { Clock, Activity, X } from "lucide-react";
import { formatNextRunTimeClient, formatDate } from "@/lib/cron-utils-client";
import type { CronRun } from "@/lib/types";

export default function MonitorPopup({
  nextRunAt,
  lastRun,
  onClose,
}: {
  nextRunAt: Date;
  lastRun: CronRun | null;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-exa-gray-300 bg-exa-gray-100 p-5 shadow-lg">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-3 top-3 rounded-md p-1 text-exa-gray-500 hover:bg-exa-gray-200 hover:text-exa-gray-700"
      >
        <X size={14} />
      </button>

      <div className="mb-4 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-xs font-medium text-green-600">Active monitoring</span>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium text-exa-gray-600">
          <Clock size={12} />
          Next scan
        </div>
        <p className="text-sm font-semibold text-exa-black">
          {formatNextRunTimeClient(nextRunAt)}
        </p>
      </div>

      {lastRun && (
        <div className="border-t border-exa-gray-200 pt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-exa-gray-600">
            <Activity size={12} />
            Last scan
          </div>
          <p className="mb-2 text-xs text-exa-gray-500">
            {lastRun.completed_at ? formatDate(lastRun.completed_at) : "Running..."}
          </p>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-exa-gray-500">Found </span>
              <span className="font-semibold text-exa-black">{lastRun.posts_found}</span>
              <span className="text-exa-gray-500"> sources</span>
            </div>
            <div>
              <span className="text-exa-gray-500">New </span>
              <span className="font-semibold text-exa-blue">{lastRun.posts_new}</span>
            </div>
          </div>
        </div>
      )}

      {!lastRun && (
        <p className="text-xs text-exa-gray-500">
          No scans completed yet.
        </p>
      )}
    </div>
  );
}
