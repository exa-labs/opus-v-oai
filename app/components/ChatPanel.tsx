"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import type { ChatMessage } from "@/lib/types";
import Image from "next/image";

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent]);

  const handleSend = useCallback(
    async (message: string) => {
      // Add user message
      const userMsg: ChatMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);
      setStreamContent("");
      setSearching(false);
      setSearchQueries([]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: [...messages, userMsg],
          }),
        });

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));

              switch (currentEvent) {
                case "content":
                  accumulated += data.content;
                  setStreamContent(accumulated);
                  setSearching(false);
                  break;
                case "search_start":
                  setSearching(true);
                  setSearchQueries(data.queries || []);
                  break;
                case "search_complete":
                  setSearching(false);
                  // Reset accumulated content for the final response
                  accumulated = "";
                  setStreamContent("");
                  break;
                case "done":
                  break;
                case "error":
                  accumulated += `\n\nError: ${data.error}`;
                  setStreamContent(accumulated);
                  break;
              }
            }
          }
        }

        // Finalize: add assistant message
        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: accumulated },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, I encountered an error: ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
          },
        ]);
      } finally {
        setStreaming(false);
        setStreamContent("");
        setSearching(false);
      }
    },
    [messages]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="animate-slide-in-right fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-exa-gray-300 bg-[#0e0e14] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-exa-gray-300 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-exa-black">
              Sentiment Chat
            </h2>
            <span className="flex items-center gap-1 text-xs text-exa-gray-600">
              <Image
                src="/logos/exa-logomark-blue.svg"
                alt="Exa"
                width={12}
                height={12}
              />
              Exa + Gemini
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-exa-gray-500 transition-colors hover:bg-exa-gray-200 hover:text-exa-black"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <ChatMessages
            messages={messages}
            streaming={streaming}
            streamContent={streamContent}
            searching={searching}
            searchQueries={searchQueries}
          />
        </div>

        {/* Input */}
        <div className="border-t border-exa-gray-300 p-4">
          <ChatInput onSend={handleSend} disabled={streaming} />
        </div>
      </div>
    </>
  );
}
