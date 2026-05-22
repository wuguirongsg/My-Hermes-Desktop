// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  cost?: number;
  model?: string;
  /** Latest user message, shown as the sidebar subtitle. Absent for single-turn sessions. */
  last_message?: string;
}

// ─── Message Blocks ───────────────────────────────────────────────────────────

export interface TextBlock {
  type: "text";
  content: string;
}

export interface ThinkBlock {
  type: "think";
  content: string;
}

export interface ToolCallBlock {
  type: "tool";
  name: string;
  input: string;
  output: string;
  outputDone: boolean;
}

export interface ImageBlock {
  type: "image";
  dataUrl: string;
  filename?: string;
}

export type MessageBlock = TextBlock | ThinkBlock | ToolCallBlock | ImageBlock;

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant";
  blocks: MessageBlock[];
  rawOutput?: string;
  timestamp: string;
  status?: "streaming" | "done" | "error";
}

// ─── Stream ───────────────────────────────────────────────────────────────────

export interface StreamChunk {
  kind:
    | "text"
    | "think"
    | "think_start"
    | "think_end"
    | "tool_name"
    | "tool_input"
    | "tool_output"
    | "tool_output_end"
    | "status"
    | "session_stat"
    | "done"
    | "error"
    | "new_session_id"
    | "raw";
  content: string;
  session_id: string;
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface HermesStatus {
  model: string;
  tokensUsed: string;
  tokensMax: string;
  cost: string;
  duration: string;
  msgCount: string;
  raw: string;
}
