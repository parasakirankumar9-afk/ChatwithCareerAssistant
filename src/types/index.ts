// ─────────────────────────────────────────────────────────
// Document & Chunk types
// ─────────────────────────────────────────────────────────

export type DocumentKind = "resume" | "job";

export interface ParsedDocument {
  id: string;
  kind: DocumentKind;
  filename: string;
  rawText: string;
  /** Parsed title, e.g. "Senior Engineer @ Acme" for jobs */
  title?: string;
  company?: string;
  uploadedAt: string; // ISO string
}

export interface Chunk {
  id: string;
  documentId: string;
  documentKind: DocumentKind;
  /** Human-readable label for citations, e.g. "resume §3" or "Job #2 §1" */
  sourceLabel: string;
  text: string;
  chunkIndex: number;
  embedding?: number[];
}

// ─────────────────────────────────────────────────────────
// Vector store
// ─────────────────────────────────────────────────────────

export interface RetrievedChunk extends Chunk {
  score: number;
}

// ─────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  citations?: Citation[];
  createdAt: string;
}

export interface Citation {
  sourceLabel: string;
  snippet: string;
}

// ─────────────────────────────────────────────────────────
// API request/response shapes
// ─────────────────────────────────────────────────────────

export interface IngestRequest {
  filename: string;
  kind: DocumentKind;
  /** Base64-encoded file content */
  content: string;
  mimeType: string;
  /** Optional custom title for job descriptions */
  customTitle?: string;
}

export interface IngestResponse {
  document: Omit<ParsedDocument, "rawText">;
  chunksCreated: number;
}

export interface ChatRequest {
  messages: Pick<ChatMessage, "role" | "content">[];
  documentIds?: string[]; // scope retrieval; empty = use all
}

export interface ChatResponse {
  message: ChatMessage;
  retrievedChunks: RetrievedChunk[];
}

// ─────────────────────────────────────────────────────────
// App state (client-side)
// ─────────────────────────────────────────────────────────

export interface AppState {
  documents: Array<Omit<ParsedDocument, "rawText">>;
  messages: ChatMessage[];
  isIngesting: boolean;
  isChatLoading: boolean;
  error: string | null;
}
