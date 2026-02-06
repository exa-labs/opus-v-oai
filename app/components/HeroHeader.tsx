"use client";

import Image from "next/image";
import CountdownButton from "./CountdownButton";

export default function HeroHeader({
  totalAnalyzed,
  lastUpdated,
}: {
  totalAnalyzed: number;
  lastUpdated: string | null;
}) {
  return (
    <header className="border-b border-exa-gray-300 bg-[#0a0a0f]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-exa-gray-200 py-3">
          <a
            href="https://exa.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-exa-gray-500 transition-colors hover:text-exa-gray-700"
          >
            <Image
              src="/logos/exa-logomark-blue.svg"
              alt="Exa"
              width={18}
              height={18}
            />
            <span className="text-xs font-medium text-exa-gray-600">Powered by Exa</span>
          </a>
          <CountdownButton />
        </div>

        {/* Main header */}
        <div className="py-8 text-center">
          {/* Title */}
          <h1 className="font-arizona text-4xl font-medium tracking-tight text-exa-black sm:text-5xl">
            Opus 4.6 vs Codex 5.3
          </h1>

          {/* Logo row — below title */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2.5">
              <Image src="/logos/claude.svg" alt="Claude" width={28} height={28} />
              <span className="text-lg font-medium text-exa-gray-700">Anthropic</span>
            </div>
            <span className="text-lg text-exa-gray-500">vs</span>
            <div className="flex items-center gap-2.5">
              <Image src="/logos/openai-white.svg" alt="OpenAI" width={28} height={28} />
              <span className="text-lg font-medium text-exa-gray-700">OpenAI</span>
            </div>
          </div>

          {/* Subtitle */}
          <p className="mt-3 text-lg text-exa-gray-600">
            What engineers are saying about today&apos;s model releases
          </p>

          {/* Source count */}
          {totalAnalyzed > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <a
                href="https://exa.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-base text-exa-gray-600 transition-colors hover:text-exa-blue"
              >
                <Image src="/logos/exa-logomark-blue.svg" alt="Exa" width={18} height={18} />
                <span>
                  <span className="font-semibold text-exa-blue">Exa</span> search analyzed{" "}
                  <span className="font-semibold text-exa-black">{totalAnalyzed.toLocaleString()}</span>{" "}
                  sources
                </span>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
