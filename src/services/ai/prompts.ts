export function buildContextFromShlokas(chunks: any[], masterShloka: any) {
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
