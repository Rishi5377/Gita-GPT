import { ChatGroq } from "@langchain/groq";
import { INTENT_EXTRACTION_PROMPT } from "@/core/constants/prompts";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export interface UserIntent {
  emotions: string[];
  themes: string[];
  keywords: string[];
}

export async function extractUserIntent(input: string): Promise<UserIntent | null> {
  try {
    // Prefer GROQ_API_KEY_1 to split the rate limits between intent and chat
    const apiKey = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;

    const model = new ChatGroq({
      apiKey: apiKey,
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
    });

    const messages = [
      new SystemMessage(INTENT_EXTRACTION_PROMPT),
      new HumanMessage(input)
    ];

    const result = await model.invoke(messages);

    let resultString = typeof result.content === "string" ? result.content : "";

    // Sometimes the model might wrap in markdown ```json ... ```
    if (resultString.includes("```json")) {
      resultString = resultString.split("```json")[1].split("```")[0];
    } else if (resultString.includes("```")) {
      resultString = resultString.split("```")[1].split("```")[0];
    }

    const parsed = JSON.parse(resultString.trim()) as UserIntent;

    // Normalize arrays
    return {
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions.map(e => e.toLowerCase().trim()) : [],
      themes: Array.isArray(parsed.themes) ? parsed.themes.map(t => t.toLowerCase().trim()) : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(k => k.toLowerCase().trim()) : [],
    };
  } catch (error) {
    console.warn("⚠️ Intent extraction failed or parsed incorrectly:", error);
    return null;
  }
}
