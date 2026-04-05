import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { StringOutputParser } from "@langchain/core/output_parsers";
import { retrieveContext } from "@/services/database/retriever";
import { buildContextFromShlokas } from "@/services/ai/prompts";
import { KRISHNA_MIRROR_PROMPT } from "@/core/constants/prompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1].content;

    // 1. Retrieve relevant context (RAG)
    const { chunks, masterShloka } = await retrieveContext(latestMessage);
    const gitaContext = buildContextFromShlokas(chunks, masterShloka);

    // 2. Initialize LangChain ChatGroq
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "moonshotai/kimi-k2-instruct-0905",
      temperature: 0.7,
      streaming: true,
    });

    // 3. Create the prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", KRISHNA_MIRROR_PROMPT],
      ["placeholder", "{chat_history}"],
      ["human", "Context from the Gita:\n{context}\n\nUser's current state: {input}"],
    ]);

    // 4. Create the chain
    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    // 5. Execute streaming
    const stream = await chain.stream({
      context: gitaContext,
      input: latestMessage,
      chat_history: messages.slice(0, -1), // Pass previous messages if needed
    });

    // 6. Convert LangChain stream to Response-compatible ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "The Mirror is currently clouded.";
    console.error("❌ LangChain Chat API error:", error);
    return new Response(errorMsg, {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    });
  }
}
