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
  emotion: string;
}

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { label: "Anxiety",   emotion: "Anxiety",   text: "I feel anxious about the future and my responsibilities." },
  { label: "Doubt",     emotion: "Doubt",     text: "I am filled with doubt about my current path in life." },
  { label: "Duty",      emotion: "Duty",      text: "I struggle to understand my duty in a difficult situation." },
  { label: "Grief",     emotion: "Grief",     text: "I am searching for peace after a painful loss." },
  { label: "Purpose",   emotion: "Purpose",   text: "I am looking for my true purpose and meaning." },
];
