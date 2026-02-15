/**
 * AI Chat Types
 *
 * Type definitions for the AI chat feature
 */

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolCall?: ToolCall;
}

export interface ToolCall {
  tool: string;
  args: Record<string, any>;
}

export interface FilterTunesArgs {
  genre?: string;
  key?: string;
  mode?: string;
  type?: string;
  status?: "new" | "learning" | "review" | "relearning";
}

export interface LogPracticeArgs {
  tune_title: string;
  quality?: 1 | 2 | 3 | 4;
}

export interface AddNoteArgs {
  tune_title: string;
  note_content: string;
}

export interface GetTuneDetailsArgs {
  tune_title: string;
}

export type ToolArgs =
  | FilterTunesArgs
  | LogPracticeArgs
  | AddNoteArgs
  | GetTuneDetailsArgs;

export interface AIResponse {
  type: "text" | "tool_call";
  content?: string;
  tool?: string;
  args?: ToolArgs;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}
