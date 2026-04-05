# Product Requirements Document
# Gita Mirror — A Reflective Wisdom Chatbot

**Version:** 1.0  
**Date:** April 2026  
**Author:** Rishi  
**Status:** Approved for Development

---

## 1. Product Overview

### 1.1 Vision
Gita Mirror is a conversational AI companion rooted in the wisdom of the Bhagavad Gita. Unlike existing Gita bots that act as shloka search engines, Gita Mirror acts as a reflective guide — asking Socratic questions that help users arrive at their own truth, mirroring the way Krishna guided Arjuna.

### 1.2 Problem Statement
Young adults today face a silent epidemic of purposelessness, burnout, and emotional drift. Existing solutions fall into two camps — secular mental health chatbots (Woebot, Wysa) that are CBT-based and culturally generic, or Gita reference tools (GitaGPT) that retrieve shlokas without emotional intelligence. Neither meets the user in their pain and guides them inward.

### 1.3 Solution
A RAG-powered chatbot grounded in 7 curated versions of the Bhagavad Gita, with smart source-tagged retrieval and a Krishna-mirror persona — warm, reflective, non-prescriptive.

---

## 2. Goals & Non-Goals

### Goals
- Build a deployable, publicly accessible chatbot for portfolio and hackathon demonstration
- Ground every response in actual Gita text via RAG (no hallucinated shlokas)
- Deliver emotionally intelligent, reflective responses — not direct answers
- Keep infrastructure cost at ₹0 using free-tier services
- Establish a solid foundation for future monetization and scaling

### Non-Goals
- Not a clinical mental health tool — no crisis intervention or therapy replacement
- Not a shloka search engine or reference tool
- Not targeting Sanskrit scholars or religious experts
- No user authentication or persistent conversation history in v1
- No mobile app in v1 (web only)

---

## 3. Target Users

### Primary Persona — "The Drifter"
A 20–30 year old experiencing one or more of the following:

- **Directionless:** Finished college/exams, no clear path forward, comparing themselves to peers
- **Grieving:** A relationship ended, failed an exam, lost a job, lost someone
- **Burned out:** Working hard with no sense of why, questioning purpose

**What they want:** Not advice. Not quotes. Someone (or something) that makes them feel heard and then asks the right question that unlocks clarity from within.

**What they don't want:** A lecture. A list of steps. Another productivity framework.

---

## 4. Core Features

### 4.1 Reflective Conversation (MVP)
The chatbot listens to the user's situation and responds with:
1. A brief acknowledgment of their emotional state (empathy first)
2. One powerful reflective question drawn from Gita wisdom
3. Optional: a paraphrased insight from a relevant shloka (not a direct quote dump)

**Example interaction:**
> User: "I studied so hard for placements but everyone around me is getting offers and I'm not. I feel like I'm failing."
>
> Gita Mirror: "That weight of comparison — it's real, and it's heavy. The Gita speaks of a warrior who looked at his peers and felt exactly this. Let me ask you something: if the outcome were completely removed from the picture, what is it that you actually love doing?"

### 4.2 Smart Source Retrieval
Retrieval is routed based on the user's emotional context:

| Emotional State | Primary Sources | Secondary |
|---|---|---|
| Directionless / no purpose | BG As It Is + TTD (Story Mode) | General EXP |
| Grief / loss | Swamy BG + General EXP | TTD |
| Burnout / exhaustion | BG As It Is + G279 | Sloka 117 |
| Wants depth | General EXP + Essay | G279 |
| Wants sharp answer | Swamy BG + G279 | — |

### 4.3 Conversation Memory (Session-level)
Maintains the last 6 message pairs within a session so the conversation feels continuous, not disconnected.

### 4.4 Crisis Disclaimer
If user language suggests acute distress or self-harm, the chatbot gracefully redirects:
> "What you're carrying sounds very heavy. I'm here to reflect, but for what you're feeling right now, please reach out to iCall: 9152987821 (India) — trained counselors who can truly help."

---

## 5. Knowledge Base

### 5.1 Source Documents (All 7 PDFs — 134MB Total)

| File | Description | Primary Use |
|---|---|---|
| G279 | Proper Shloka & Meaning | Exact verse + clean meaning retrieval |
| General EXP | Elaborative Explanation of verses | Deep-dive, explanatory responses |
| Sloka 117 | All Sanskrit Verses + Transliterations | Sanskrit authenticity, original feel |
| Swamy BG | Verses + Straight on-point meanings | Sharp, concise wisdom responses |
| The Bhagavat Gita (TTD) | Story Mode version | Narrative, relatable responses |
| BG As It Is | Situational Scenario-based Teaching | Scenario-matching, life-situation retrieval |
| Essay | Briefing of all PDFs | System prompt context, summary layer |

### 5.2 Chunking Strategy
- Chunk size: ~300 tokens per chunk
- Overlap: 50 tokens (to preserve context at boundaries)
- Each chunk tagged with: `source_type`, `chapter`, `verse`, `metadata`
- Estimated total chunks: 50,000–70,000
- Estimated vector storage: ~150–160MB (with 384-dim embeddings)

---

## 6. User Experience

### 6.1 Interface
- Clean, minimal chat UI — dark or warm-earth tones (not clinical white)
- Single input field, streaming responses
- No login, no signup — instant access
- Optional: chapter/theme selector for users who want to explore specific Gita topics

### 6.2 Persona Guidelines (Krishna-Mirror)
- Always acknowledge pain before asking a question
- Never prescribe. Always reflect.
- One question per response — no question dumps
- Warm, not cold. Wise, not preachy. Grounded, not mystical
- Never says "I am an AI"
- Speaks as a guide, not a search engine

### 6.3 Response Format
```
[1–2 line empathetic acknowledgment]

[Paraphrased Gita insight — optional, woven naturally]

[One reflective question]
```

---

## 7. Technical Requirements

### 7.1 Performance
- Response latency: < 3 seconds end-to-end (Groq inference is fast)
- Retrieval latency: < 500ms (pgvector similarity search)
- Uptime: best-effort (free tier, not SLA-bound)

### 7.2 Scale (v1)
- Designed for demo-scale: 10–50 concurrent users
- No rate limiting needed in v1
- No persistent storage of conversations

### 7.3 Security & Privacy
- No user data stored beyond session
- No PII collected
- Groq API key stored in environment variables (never client-side)
- Supabase Row Level Security enabled

### 7.4 Platforms
- Web (desktop-first, mobile-responsive)
- Deployed on Vercel (free tier)

---

## 8. Success Metrics (Portfolio/Hackathon)

| Metric | Target |
|---|---|
| Demo-able public URL | ✅ Must have |
| Response quality (judge eval) | Feels wise, not robotic |
| Retrieval accuracy | Responses grounded in actual Gita text |
| Load time | < 2 seconds initial load |
| Conversation depth | Meaningful 3+ turn exchanges |

---

## 9. Constraints & Assumptions

### Constraints
- ₹0 infrastructure budget
- All 7 PDFs must be fully embedded (no partial datasets)
- Embedding model must be free (no OpenAI embeddings)
- Must deploy publicly (no localhost-only solutions)

### Assumptions
- English language first (Hinglish stretch goal)
- Users are not in acute crisis (see Section 4.4 for edge case)
- Free tier services remain available and functional
- Supabase free tier handles ~160MB vector storage comfortably

---

## 10. Future Roadmap (Post v1)

- **v1.1:** Hinglish language support
- **v1.2:** Topic/chapter explorer (browse by theme: duty, grief, action, identity)
- **v2.0:** User accounts + conversation history
- **v2.1:** Voice interface (speak to the guide)
- **v3.0:** Monetization — premium depth mode, guided journeys
- **Long-term:** Mobile app, vernacular language support (Telugu, Hindi, Tamil)
