"use client";

import { useRef, useEffect, useState } from "react";
import { Plus, Mic, Send, ChevronDown } from "lucide-react";
import { Plus, Mic, Send, ChevronDown } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-8 pt-2">
      <div className="relative bg-sidebar border border-border rounded-2xl shadow-xl transition-all">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="How can I help you today?"
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-[15px] pt-4 pb-12 px-12 leading-relaxed placeholder:text-muted/50 scrollbar-hidden"
          />

          {/* Left Accessory */}
          <button
            type="button"
            className="absolute left-3 bottom-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-muted"
          >
            <Plus size={18} />
          </button>

          {/* Right Accessories */}
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-[12px] text-muted font-medium"
            >
              Kimi K2 <ChevronDown size={14} />
            </button>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted"
            >
              <Mic size={18} />
            </button>
            {input.trim() && (
              <button
                type="submit"
                disabled={isLoading}
                className="p-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
