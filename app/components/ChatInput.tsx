"use client";

import { useState, useRef } from "react";
import { Send } from "lucide-react";

const SUGGESTIONS = [
  "Which model is winning on coding?",
  "What's the sentiment on Claude Code?",
  "How does the community feel about GPT-5?",
  "OpenAI vs Anthropic pricing sentiment",
];

export default function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <div>
      {/* Suggestion tags */}
      {!disabled && value === "" && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              className="rounded-full border border-exa-gray-300 bg-exa-gray-100 px-3 py-1 text-xs text-exa-gray-700 shadow-tag transition-all hover:border-exa-blue hover:text-exa-blue"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about AI sentiment..."
          disabled={disabled}
          className="flex-1 rounded-lg border border-exa-gray-300 bg-exa-gray-100 px-4 py-2.5 text-sm text-exa-black placeholder:text-exa-gray-500 focus:border-exa-blue focus:outline-none focus:ring-1 focus:ring-exa-blue disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="gradient-arrow-btn flex items-center justify-center rounded-lg px-4 py-2.5 text-white shadow-button-sm transition-all hover:opacity-90 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
