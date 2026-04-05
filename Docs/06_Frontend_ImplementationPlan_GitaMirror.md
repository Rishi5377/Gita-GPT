# Frontend Implementation Plan
# Gita Mirror — UI Layer Build Guide

**Version:** 1.0
**Date:** April 2026
**Scope:** Chat UI, streaming integration, component architecture, deployment
**Prerequisite:** RAG pipeline (Phases 1–4) must be complete and tested before frontend integration

---

## Build Order

```
Phase 1 — Project Setup & Configuration
Phase 2 — Layout & Global Styles
Phase 3 — Core Chat Components
Phase 4 — API Integration & Streaming
Phase 5 — UX Polish
Phase 6 — Deployment
```

---

## Phase 1: Project Setup & Configuration

### Step 1.1 — Initialize Project

```bash
npx create-next-app@latest gita-mirror \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

cd gita-mirror
```

### Step 1.2 — Install Dependencies

```bash
# UI
npm install lucide-react class-variance-authority clsx tailwind-merge

# shadcn/ui setup
npx shadcn-ui@latest init
# Choose: Default style, Neutral base color, CSS variables: yes

# shadcn components
npx shadcn-ui@latest add button input scroll-area separator badge tooltip

# Backend clients (shared with RAG layer)
npm install @supabase/supabase-js groq-sdk

# Ingest-only (not deployed to Vercel)
npm install -D @xenova/transformers ts-node @types/node
```

### Step 1.3 — Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
```

### Step 1.4 — Tailwind Configuration

Replace `tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        background:  "var(--background)",
        foreground:  "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          hover:   "var(--primary-hover)",
        },
        muted:       "var(--muted)",
        border:      "var(--border)",
        card:        "var(--card)",
      },
      animation: {
        "fade-in":   "fadeIn 0.3s ease-in-out",
        "slide-up":  "slideUp 0.2s ease-out",
        "pulse-dot": "pulseDot 1.4s infinite ease-in-out",
      },
      keyframes: {
        fadeIn:   { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:  { "0%": { transform: "translateY(8px)", opacity: "0" },
                    "100%": { transform: "translateY(0)", opacity: "1" } },
        pulseDot: { "0%, 80%, 100%": { transform: "scale(0)" },
                    "40%": { transform: "scale(1)" } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

### Step 1.5 — Global CSS

Replace `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background:    #FAF7F2;
    --foreground:    #2C1810;
    --card:          #F5F0E8;
    --primary:       #B8621A;
    --primary-hover: #9A4F12;
    --muted:         #8B7355;
    --border:        #E8DFD0;
    --user-bubble:   #EDE4D4;
    --bot-bubble:    #FFFFFF;
    --shadow:        rgba(44, 24, 16, 0.08);

    /* shadcn/ui required variables */
    --radius: 0.75rem;
  }

  * { @apply border-border; }

  body {
    @apply bg-background text-foreground font-sans;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Smooth scrolling for chat */
  html { scroll-behavior: smooth; }

  /* Custom scrollbar — warm, minimal */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--background); }
  ::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover { background: var(--muted); }
}
```

---

## Phase 2: Layout & Root Files

### Step 2.1 — Root Layout (`src/app/layout.tsx`)

```typescript
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Gita Mirror",
  description: "Reflect on life through the wisdom of the Bhagavad Gita",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

### Step 2.2 — Landing Page (`src/app/page.tsx`)

```typescript
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Om symbol */}
      <div className="text-6xl mb-6 opacity-60">🕉</div>

      <h1 className="font-serif text-4xl md:text-5xl text-foreground text-center mb-4">
        Gita Mirror
      </h1>

      <p className="text-muted text-center max-w-md mb-2 leading-relaxed">
        A space to reflect — not to receive answers, but to find them within.
      </p>

      <p className="font-serif text-sm text-muted/70 text-center mb-10 italic">
        Rooted in the wisdom of the Bhagavad Gita
      </p>

      <Link href="/chat">
        <Button
          className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-full
                     font-sans text-sm tracking-wide transition-all duration-200
                     shadow-md hover:shadow-lg"
        >
          Begin Reflecting
        </Button>
      </Link>

      <p className="text-xs text-muted/50 mt-8 text-center max-w-sm">
        Not a substitute for professional mental health support.
        If you are in crisis, please reach out to iCall: 9152987821
      </p>
    </main>
  );
}
```

---

## Phase 3: Core Chat Components

### Step 3.1 — Types (`src/lib/types.ts`)

```typescript
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface SuggestedPrompt {
  label: string;
  text: string;
}

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { label: "Lost",        text: "I feel completely lost and don't know what to do with my life." },
  { label: "Grief",       text: "I'm struggling to move on after a painful loss." },
  { label: "Burnout",     text: "I work so hard but nothing feels meaningful anymore." },
  { label: "Comparison",  text: "Everyone around me seems to be succeeding except me." },
  { label: "Purpose",     text: "I don't know what I'm meant to do with my life." },
];
```

### Step 3.2 — Message Bubble (`src/components/MessageBubble.tsx`)

```typescript
"use client";
import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
}

// Typing animation for streaming state
function TypingDots() {
  return (
    <span className="flex gap-1 items-center py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full animate-slide-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Guide avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center
                        justify-center text-sm mr-3 mt-1 shrink-0 font-serif
                        text-primary">
          🕉
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-[var(--user-bubble)] text-foreground rounded-br-sm"
            : "bg-[var(--bot-bubble)] text-foreground rounded-bl-sm border border-border"
        )}
      >
        {/* Streaming dots or message content */}
        {message.isStreaming && !message.content ? (
          <TypingDots />
        ) : (
          <p
            className={cn(
              "leading-relaxed text-sm md:text-base",
              !isUser && "font-serif"   // guide responses in serif
            )}
          >
            {message.content}
          </p>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-muted/50 mt-1 text-right">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </p>
      </div>
    </div>
  );
}
```

### Step 3.3 — Chat Input (`src/components/ChatInput.tsx`)

```typescript
"use client";
import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`; // max 5 lines
  };

  return (
    <div className="flex items-end gap-3 p-4 border-t border-border bg-background">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Share what's on your mind..."
        rows={1}
        disabled={isLoading}
        className={cn(
          "flex-1 resize-none rounded-xl border border-border bg-card",
          "px-4 py-3 text-sm font-sans text-foreground placeholder:text-muted/50",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
          "transition-all duration-200 leading-relaxed",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      />
      <Button
        onClick={handleSend}
        disabled={!value.trim() || isLoading}
        className={cn(
          "h-10 w-10 rounded-full p-0 shrink-0",
          "bg-primary hover:bg-primary-hover text-white",
          "transition-all duration-200",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        <Send size={16} />
      </Button>
    </div>
  );
}
```

### Step 3.4 — Suggested Prompts (`src/components/SuggestedPrompts.tsx`)

```typescript
"use client";
import { SUGGESTED_PROMPTS } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface SuggestedPromptsProps {
  onSelect: (text: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 px-4 animate-fade-in">
      <div className="text-4xl">🕉</div>
      <h2 className="font-serif text-2xl text-foreground text-center">
        What is weighing on you?
      </h2>
      <p className="text-muted text-sm text-center max-w-sm leading-relaxed">
        Share freely. This is a space for reflection, not judgment.
      </p>

      <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-md">
        {SUGGESTED_PROMPTS.map(prompt => (
          <Button
            key={prompt.label}
            variant="outline"
            onClick={() => onSelect(prompt.text)}
            className="rounded-full border-border text-muted hover:text-foreground
                       hover:bg-card hover:border-primary/40 font-sans text-sm
                       transition-all duration-200"
          >
            {prompt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

---

## Phase 4: API Integration & Streaming

### Step 4.1 — Chat API Route (`src/app/api/chat/route.ts`)

```typescript
import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { retrieveShlokas } from "@/lib/retriever";
import { KRISHNA_MIRROR_PROMPT, buildContextFromShlokas } from "@/lib/prompts";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // Keep last 6 message pairs for context window
    const recentHistory = messages.slice(-6);
    const latestUserMessage = [...recentHistory]
      .reverse()
      .find((m: { role: string }) => m.role === "user")?.content ?? "";

    // Retrieve relevant shlokas via master index
    const shlokas = await retrieveShlokas(latestUserMessage);
    const gitaContext = buildContextFromShlokas(shlokas);

    // Stream from Groq
    const stream = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      max_tokens: 500,
      stream: true,
      messages: [
        { role: "system", content: KRISHNA_MIRROR_PROMPT },
        ...(gitaContext
          ? [{ role: "system" as const, content: gitaContext }]
          : []),
        ...recentHistory,
      ],
    });

    // Pass token stream directly to client
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content ?? "";
            if (token) controller.enqueue(encoder.encode(token));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[/api/chat] Error:", error);
    return new Response("Something went wrong. Please try again.", {
      status: 500,
    });
  }
}
```

### Step 4.2 — Main Chat Page (`src/app/chat/page.tsx`)

```typescript
"use client";
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { SuggestedPrompts } from "@/components/SuggestedPrompts";
import { Message } from "@/lib/types";
import { nanoid } from "nanoid"; // or use crypto.randomUUID()

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages
            .filter(m => !m.isStreaming)
            .map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error("API error");

      // Read stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: accumulated, isStreaming: true }
              : m
          )
        );
      }

      // Mark streaming complete
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, isStreaming: false }
            : m
        )
      );
    } catch (error) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content: "Something went quiet. Please try again.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3
                         border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🕉</span>
          <span className="font-serif text-lg text-foreground">Gita Mirror</span>
        </div>
        <span className="text-xs text-muted/60 font-sans">
          Reflect. Don't just seek answers.
        </span>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="flex flex-col gap-4 py-4">
          {messages.length === 0 ? (
            <SuggestedPrompts onSelect={sendMessage} />
          ) : (
            messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
```

---

## Phase 5: UX Polish

### Step 5.1 — Crisis Disclaimer Component

```typescript
// src/components/CrisisDisclaimer.tsx
export function CrisisDisclaimer() {
  return (
    <p className="text-xs text-muted/50 text-center px-4 py-2 border-t border-border">
      This is a reflective tool, not a mental health service.
      In crisis? Call iCall: <span className="text-primary">9152987821</span>
    </p>
  );
}
```

Add this below `<ChatInput />` in `chat/page.tsx`.

### Step 5.2 — Loading State for Initial Retrieval

The gap between user sending and first token arriving (~1-2 seconds) should show the typing dots. This is already handled by `isStreaming: true` + empty `content` in `MessageBubble` — the `TypingDots` component renders during this window.

### Step 5.3 — Mobile Responsiveness Checklist
- [ ] Chat bubbles: `max-w-[75%] md:max-w-[65%]` — narrower on desktop
- [ ] Input: full width on all screens
- [ ] Header: hidden subtitle on very small screens (`hidden sm:block`)
- [ ] Font sizes: `text-sm md:text-base` on message bubbles
- [ ] Scroll area: `h-screen` minus header minus input height

---

## Phase 6: Deployment

### Step 6.1 — Pre-deployment Checks

```bash
# Build locally first — catch errors before Vercel does
npm run build

# Test production build locally
npm run start
```

### Step 6.2 — Deploy to Vercel

```bash
# First time
npx vercel --prod

# Subsequent deploys (auto on git push if connected to GitHub)
git push origin main
```

### Step 6.3 — Set Environment Variables in Vercel Dashboard

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

Add all 4:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
GROQ_API_KEY
```

**Do NOT add** `HF_API_TOKEN` or anything related to `@xenova/transformers` — those are ingest-only and never run on Vercel.

### Step 6.4 — Verify Deployment

- [ ] Public URL loads landing page
- [ ] "Begin Reflecting" navigates to /chat
- [ ] Suggested prompts appear on empty chat
- [ ] Sending a message triggers streaming response
- [ ] Response feels warm, ends with a reflective question
- [ ] Mobile layout works on phone screen
- [ ] Crisis disclaimer visible at bottom

---

## Estimated Timeline

| Phase | Task | Time |
|---|---|---|
| Phase 1 | Setup, dependencies, env vars | 1 hour |
| Phase 2 | Layout, global styles, landing page | 1 hour |
| Phase 3 | MessageBubble, ChatInput, SuggestedPrompts | 2 hours |
| Phase 4 | API route + streaming integration | 2 hours |
| Phase 5 | UX polish, mobile, crisis disclaimer | 1 hour |
| Phase 6 | Deploy + verify | 30 min |
| **Total** | | **~7–8 hours** |

---

## Full Project File Tree (After Frontend Complete)

```
gita-mirror/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing
│   │   ├── globals.css
│   │   ├── chat/
│   │   │   └── page.tsx                # Main chat UI
│   │   └── api/
│   │       └── chat/
│   │           └── route.ts            # Streaming LLM endpoint
│   ├── components/
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   ├── SuggestedPrompts.tsx
│   │   ├── CrisisDisclaimer.tsx
│   │   └── ui/                         # shadcn components
│   └── lib/
│       ├── types.ts
│       ├── utils.ts                    # cn() helper from shadcn
│       ├── prompts.ts                  # Krishna-mirror system prompt
│       ├── retriever.ts                # Master index retrieval
│       ├── classifier.ts               # Emotion classifier
│       └── supabase.ts                 # Supabase client
├── scripts/
│   ├── sourceMap.ts
│   ├── embedder.ts                     # @xenova/transformers (ingest only)
│   ├── buildIndex.ts                   # Kimi K2 tagging script
│   ├── uploadIndex.ts                  # Push master index to Supabase
│   └── ingest_chunks.ts               # PDF → chunks → Supabase
├── Assets/                             # 7 PDFs (gitignored)
├── .cache/                             # Xenova model cache (gitignored)
├── .env.local                          # (gitignored)
├── .gitignore
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## .gitignore Additions

```
# Environment
.env.local
.env*.local

# PDF assets (large files)
Assets/

# Xenova local model cache
.cache/

# Next.js
.next/
out/
```
