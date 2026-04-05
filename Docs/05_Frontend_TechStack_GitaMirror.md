# Frontend Tech Stack Document
# Gita Mirror — UI Layer Technology Decisions

**Version:** 1.0
**Date:** April 2026
**Scope:** Frontend UI, routing, styling, streaming, deployment
**Excludes:** RAG pipeline, embeddings, vector DB (see RAG Implementation Plan)

---

## Stack at a Glance

| Layer | Technology | Purpose | Cost |
|---|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack React + API routes | Free |
| Language | TypeScript | Type safety across frontend + backend | Free |
| Styling | Tailwind CSS | Utility-first CSS | Free |
| Components | shadcn/ui | Accessible, copy-paste UI components | Free |
| Icons | Lucide React | Clean icon set, ships with shadcn | Free |
| Fonts | Google Fonts (Cormorant Garamond + Inter) | Spiritual serif + clean sans | Free |
| State Management | React useState + useRef | Session-level chat state, no Redux needed | Free |
| Streaming | Web Streams API (ReadableStream) | Token-by-token LLM response streaming | Native |
| Deployment | Vercel | Zero-config Next.js hosting, public URL | Free |
| **Total** | | | **₹0** |

---

## 1. Framework — Next.js 14 (App Router)

### Why App Router over Pages Router
- **Server Components** — initial page load is fast; no JS sent for static parts
- **Streaming built-in** — `ReadableStream` works natively in API route handlers
- **Layouts** — shared chat shell without re-rendering on navigation
- **`use client` directive** — precise control over which components are interactive

### Key Files Structure
```
app/
├── layout.tsx           # Root layout — fonts, metadata, global styles
├── page.tsx             # Landing page → redirects to /chat
├── chat/
│   └── page.tsx         # Main chat interface (client component)
├── api/
│   ├── chat/
│   │   └── route.ts     # Streaming LLM endpoint (server)
│   └── classify/
│       └── route.ts     # Emotion classifier endpoint (server)
└── globals.css          # Tailwind base + custom CSS variables
```

---

## 2. Styling — Tailwind CSS + shadcn/ui

### Design Direction
Gita Mirror is not a tech product — it's a contemplative space. The UI must feel:
- **Warm** — not clinical white, not dark-mode hacker aesthetic
- **Grounded** — earthy, ancient, trustworthy
- **Minimal** — nothing competes with the conversation

### Color Palette (CSS Variables in `globals.css`)
```css
:root {
  --background:     #FAF7F2;   /* warm parchment — not pure white */
  --foreground:     #2C1810;   /* deep brown — not harsh black */
  --card:           #F5F0E8;   /* slightly darker parchment for chat bubbles */
  --primary:        #B8621A;   /* saffron-amber — the accent */
  --primary-hover:  #9A4F12;   /* darker saffron on hover */
  --muted:          #8B7355;   /* warm grey-brown for secondary text */
  --border:         #E8DFD0;   /* soft warm border */
  --user-bubble:    #EDE4D4;   /* user message background */
  --bot-bubble:     #FFFFFF;   /* guide response — clean white on parchment */
  --shadow:         rgba(44, 24, 16, 0.08); /* warm shadow */
}
```

### Typography
```css
/* In layout.tsx */
import { Cormorant_Garamond, Inter } from "next/font/google";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif"    // for Gita passages, guide name, headers
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans"     // for UI text, user messages, buttons
});
```

### shadcn/ui Components Used
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input scroll-area separator badge tooltip
```

| Component | Used for |
|---|---|
| `Button` | Send button, suggested prompts |
| `Input` | Message input field |
| `ScrollArea` | Chat message scroll container |
| `Separator` | Divider between sections |
| `Badge` | Emotion tag display (optional) |
| `Tooltip` | Hover hints on UI elements |

---

## 3. Chat State Management

No Redux, no Zustand — `useState` is sufficient for session-level chat state.

```typescript
// Types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}
```

No persistence between sessions in v1 — by design. Each conversation starts fresh, like sitting down with a guide anew.

---

## 4. Streaming Architecture

### How token streaming works end-to-end
```
User sends message
       ↓
fetch("/api/chat", { method: "POST", body: messages })
       ↓
API route → Groq streams tokens → ReadableStream passed to response
       ↓
Client reads stream via response.body.getReader()
       ↓
Each token appended to assistant message in state
       ↓
React re-renders incrementally — text appears word by word
```

### Client-side stream reader pattern
```typescript
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages })
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let assistantMessage = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  assistantMessage += decoder.decode(value, { stream: true });

  // Update the streaming message in state
  setMessages(prev => prev.map(m =>
    m.id === streamingId
      ? { ...m, content: assistantMessage }
      : m
  ));
}
```

---

## 5. Deployment — Vercel

### Why Vercel
- Next.js is made by Vercel — zero configuration needed
- Free tier: unlimited personal projects, 100GB bandwidth/month
- Every `git push` auto-deploys — judges always see latest version
- Environment variables managed in Vercel dashboard (never in code)
- Serverless functions for API routes — no server to manage

### Deployment Steps (one-time)
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Environment Variables to Set in Vercel Dashboard
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
GROQ_API_KEY
```

Note: `HF_API_TOKEN` and `@xenova/transformers` are **ingest-only** — they never run on Vercel. The deployed app only calls Groq + Supabase.

---

## 6. Performance Considerations

| Concern | Solution |
|---|---|
| Initial load speed | Server components for shell, client only for chat |
| Streaming latency | Groq LPU inference — fastest available free option |
| Scroll behavior | `useEffect` + `scrollIntoView` on new messages |
| Input UX | Disable send button while streaming, re-enable on complete |
| Mobile responsiveness | Tailwind responsive prefixes (`sm:`, `md:`) — mobile-first |

---

## 7. Dependencies Summary

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "lucide-react": "^0.383.0",
    "@supabase/supabase-js": "^2.43.0",
    "groq-sdk": "^0.3.3",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38"
  }
}
```

---

## 8. Decision Log

| Decision | Chosen | Alternatives | Reason |
|---|---|---|---|
| Framework | Next.js 14 App Router | Pages Router, Vite+React | Built-in streaming, server components, Vercel native |
| Styling | Tailwind + shadcn/ui | CSS Modules, Chakra UI | Speed, no runtime overhead, copy-paste components |
| State | useState + useRef | Zustand, Redux | Session-only state — no persistence needed in v1 |
| Fonts | Cormorant Garamond + Inter | System fonts, Playfair | Spiritual serif elevates the contemplative aesthetic |
| Streaming | Web Streams API | Server-Sent Events, WebSockets | Native to Next.js API routes, no extra setup |
| Deployment | Vercel | Railway, Netlify | Tightest Next.js integration, zero config |
| Local embeddings | @xenova/transformers | HuggingFace API | Rate limit free, offline, one-time 23MB download |
