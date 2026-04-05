# Gita Mirror | Reflect on Eternal Wisdom

**Gita Mirror** is a high-craft AI application that leverages the timeless wisdom of the **Bhagavad Gita** to provide a reflective, non-prescriptive mental health and self-discovery experience.

Inspired by the dialogue between **Krishna** and **Arjuna**, this tool is designed to help users find their own answers by reflecting their emotions and situations through the lens of ancient wisdom.

## ✨ Key Features

*   **Reflective AI Orchestration**: Uses a customized RAG (Retrieval-Augmented Generation) pipeline to transform Gita passages into empathetic, inquiry-based responses.
*   **Vector Search & RAG**: Efficient similarity-based retrieval using **Supabase (pgvector)** and **Xenova/all-MiniLM-L6-v2** local embeddings.
*   **Premium Editorial UI**: A minimalist, high-aesthetic interface built with **Next.js 15**, **Tailwind CSS 4**, and **Framer Motion**.
*   **Real-time Streaming**: Instant conversational feedback powered by **LangChain** and **Groq (Kimi K2 Instruct)**.
*   **Modular Architecture**: Professional, layered directory structure for scalability and maintainability.

## 🚀 Quick Start

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/your-repo/gita-mirror.git
    cd gita-mirror
    npm install
    ```
2.  **Environment Variables**:
    Create a `.env` file with your credentials:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=...
    SUPABASE_SERVICE_KEY=...
    GROQ_API_KEY=...
    ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 📂 Repository Structure

*   **/src/app**: Next.js App Router (Pages & API routes).
*   **/src/core**: Foundational types, constants, and utilities.
*   **/src/services**: AI prompting and Database retrieval logic.
*   **/src/features**: Domain-specific UI components and specialized state (e.g., `useChat`).
*   **/src/components**: Shared UI primitive components.
*   **/tools**: Data engineering and research scripts for Gita content extraction.

## 🏛️ Architecture

For a deep dive into the system design, RAG pipeline, and reflective logic, refer to [**ARCHITECTURE.md**](./ARCHITECTURE.md).

## 🛡️ Crisis Disclaimer

Gita Mirror is an AI guide and is NOT a substitute for professional therapy or crisis intervention. If you are in immediate distress, please contact emergency services or a mental health professional.
