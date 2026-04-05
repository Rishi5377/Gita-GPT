"use client";

import { Message } from "@/core/types/chat";
import { cn } from "@/core/utils/cn";
import { motion } from "framer-motion";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full mb-8",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] px-1",
          isAssistant ? "w-full" : "w-auto"
        )}
      >
        {!isAssistant && (
          <div className="bg-white/5 border border-border px-5 py-3 rounded-2xl text-[14px] leading-relaxed text-foreground/90 ml-auto w-fit">
            {message.content}
          </div>
        )}

        {isAssistant && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2 opacity-50">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                G
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold">Gita-GPT</span>
            </div>
            
            <div className="font-serif text-[18px] md:text-[20px] leading-[1.6] text-foreground/95 antialiased whitespace-pre-wrap">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-5 bg-primary/50 ml-1 animate-pulse align-middle" />
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
