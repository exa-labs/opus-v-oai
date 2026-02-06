"use client";

import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/types";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="animate-bounce-dot-1 h-2 w-2 rounded-full bg-exa-gray-400" />
      <div className="animate-bounce-dot-2 h-2 w-2 rounded-full bg-exa-gray-400" />
      <div className="animate-bounce-dot-3 h-2 w-2 rounded-full bg-exa-gray-400" />
    </div>
  );
}

function SearchingIndicator({ queries }: { queries: string[] }) {
  return (
    <div className="animate-message-in mx-4 rounded-lg border border-exa-blue/20 bg-exa-blue/10 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-exa-blue">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-exa-blue border-t-transparent" />
        Searching the web...
      </div>
      {queries.map((q, i) => (
        <p key={i} className="mt-1 text-xs text-exa-gray-600">
          &ldquo;{q}&rdquo;
        </p>
      ))}
    </div>
  );
}

export default function ChatMessages({
  messages,
  streaming,
  streamContent,
  searching,
  searchQueries,
}: {
  messages: ChatMessage[];
  streaming: boolean;
  streamContent: string;
  searching: boolean;
  searchQueries: string[];
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 && !streaming && (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h3 className="font-arizona mb-2 text-lg font-medium text-exa-black">
              AI Sentiment Chat
            </h3>
            <p className="text-sm text-exa-gray-600">
              Ask about Claude vs OpenAI sentiment, trends, and community opinions.
            </p>
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <div
          key={i}
          className={`animate-message-in mb-4 ${
            msg.role === "user" ? "flex justify-end" : ""
          }`}
        >
          <div
            className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-exa-blue text-white"
                : "bg-exa-gray-200 text-exa-black"
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="prose text-sm">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        </div>
      ))}

      {/* Searching indicator */}
      {searching && <SearchingIndicator queries={searchQueries} />}

      {/* Streaming assistant message */}
      {streaming && streamContent && (
        <div className="animate-message-in mb-4">
          <div className="max-w-[85%] rounded-xl bg-exa-gray-200 px-4 py-3 text-sm text-exa-black">
            <div className="prose text-sm">
              <ReactMarkdown>{streamContent}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Typing indicator */}
      {streaming && !streamContent && !searching && <TypingIndicator />}
    </div>
  );
}
