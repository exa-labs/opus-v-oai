"use client";

import CountdownButton from "./CountdownButton";
import { MessageCircle } from "lucide-react";
import Image from "next/image";

export default function PageHeader({
  onOpenChat,
}: {
  onOpenChat: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-exa-black/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Left: countdown */}
        <CountdownButton />

        {/* Center: title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/logos/claude.svg" alt="" className="h-5 w-5" />
            <h1 className="font-arizona text-lg font-medium tracking-tight text-white">
              vs
            </h1>
            <img src="/logos/openai.svg" alt="" className="h-5 w-5 brightness-0 invert" />
          </div>
          <span className="text-sm font-medium text-white/50">Sentiment Tracker</span>
        </div>

        {/* Right: chat + powered by */}
        <div className="flex items-center gap-3">
          <a
            href="https://exa.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-exa-blue-light sm:flex"
          >
            <span>Powered by</span>
            <Image
              src="/logos/exa-logomark-blue.svg"
              alt="Exa"
              width={16}
              height={16}
            />
          </a>
          <button
            onClick={onOpenChat}
            className="flex items-center gap-2 rounded-lg bg-exa-blue px-4 py-2 text-xs font-medium text-white shadow-button-sm transition-all hover:bg-exa-blue-light"
          >
            <MessageCircle size={14} />
            Ask AI
          </button>
        </div>
      </div>
    </header>
  );
}
