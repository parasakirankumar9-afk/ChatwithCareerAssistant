import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { ChatMessage } from "@/types";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY });
  }
  return _client;
}

interface CompletionOptions {
  system: string;
  messages: Pick<ChatMessage, "role" | "content">[];
}

/**
 * Map our internal message roles to Gemini content roles.
 * Gemini uses "user" and "model" (not "assistant").
 */
function toGeminiRole(role: string): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

/**
 * Build a Gemini `contents` array from our message history.
 * We use models.generateContentStream (not chats.create) for reliability —
 * it handles system prompts and history in a single call.
 */
function buildContents(opts: CompletionOptions) {
  const messages = opts.messages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );
  return messages.map((m) => ({
    role: toGeminiRole(m.role),
    parts: [{ text: m.content }],
  }));
}

/**
 * Stream a response using Gemini's generateContentStream API.
 * Returns an async generator of text deltas.
 *
 * Uses models.generateContentStream() directly — more stable than chats.create()
 * and supports full conversation history + system instructions natively.
 */
export async function* streamComplete(
  opts: CompletionOptions
): AsyncGenerator<string> {
  const env = getEnv();
  const client = getClient();
  const contents = buildContents(opts);

  logger.info("gemini stream request", {
    model: env.GEMINI_CHAT_MODEL,
    turns: contents.length,
    maxTokens: env.LLM_MAX_TOKENS,
  });

  const MAX_RETRIES = 3;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const stream = await client.models.generateContentStream({
        model: env.GEMINI_CHAT_MODEL,
        contents,
        config: {
          systemInstruction: opts.system,
          maxOutputTokens: env.LLM_MAX_TOKENS,
          temperature: 0.3,
        },
      });

      for await (const chunk of stream) {
        const delta = chunk.text;
        if (delta) yield delta;
      }
      return; // success — exit generator
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      if (is429 && attempt < MAX_RETRIES) {
        // Parse Google's suggested retryDelay if present (e.g. "29s")
        const delayMatch = msg.match(/retryDelay['":\s]+(\d+)/);
        const waitMs = delayMatch
          ? parseInt(delayMatch[1]) * 1000 + 1000
          : (attempt + 1) * 5000;
        logger.info("gemini rate limit — retrying", { attempt, waitMs });
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
