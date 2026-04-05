interface GitaChunk {
  source_type: string;
  content: string;
  [key: string]: unknown;
}

interface MasterShloka {
  chapter: number;
  verse: number;
  anchor_text: string;
  psychological_state: string;
  trigger_scenario: string;
  [key: string]: unknown;
}

export function buildContextFromShlokas(chunks: GitaChunk[], masterShloka: MasterShloka | null) {
  if (!masterShloka && chunks.length === 0) return "";

  let context = "### Bhagavad Gita Wisdom Context:\n\n";

  if (masterShloka) {
    context += `**Core Shloka (BG ${masterShloka.chapter}.${masterShloka.verse}):**\n`;
    context += `Anchor Text: ${masterShloka.anchor_text}\n`;
    context += `Psychological State: ${masterShloka.psychological_state}\n`;
    context += `Trigger Scenario: ${masterShloka.trigger_scenario}\n\n`;
  }

  if (chunks.length > 0) {
    context += "**Relevant Context Snippets:**\n";
    chunks.forEach((chunk, i) => {
      context += `- [Snippet ${i + 1} from ${chunk.source_type}]: ${chunk.content}\n`;
    });
  }

  return context;
}
