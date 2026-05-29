import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY });
  }
  return _client;
}

/**
 * Generate embeddings for an array of text strings using Gemini.
 * Uses @google/genai (v1 stable API) — parallel calls, 20 at a time.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const env = getEnv();
  const client = getClient();
  const embeddings: number[][] = new Array(texts.length);

  logger.info("embedding texts", {
    model: env.GEMINI_EMBEDDING_MODEL,
    count: texts.length,
  });

  const CONCURRENCY = 4;
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const batch = texts.slice(i, i + CONCURRENCY);
    logger.info("embedding batch", { batchStart: i, batchSize: batch.length });

    const results = await Promise.all(
      batch.map((text) =>
        embedWithRetry(
          client,
          env.GEMINI_EMBEDDING_MODEL,
          text,
          "RETRIEVAL_DOCUMENT"
        )
      )
    );

    results.forEach((res, idx) => {
      embeddings[i + idx] = res.embeddings?.[0]?.values ?? [];
    });
  }

  return embeddings;
}

/**
 * Generate a single query embedding using RETRIEVAL_QUERY task type.
 */
export async function embedText(text: string): Promise<number[]> {
  const env = getEnv();
  const client = getClient();

  const result = await embedWithRetry(
    client,
    env.GEMINI_EMBEDDING_MODEL,
    text,
    "RETRIEVAL_QUERY"
  );

  return result.embeddings?.[0]?.values ?? [];
}

async function embedWithRetry(
  client: GoogleGenAI,
  model: string,
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
) {
  const maxRetries = 3;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.models.embedContent({
        model,
        contents: text,
        config: { taskType },
      });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("503") ||
        msg.includes("UNAVAILABLE");

      if (!retryable || attempt === maxRetries) break;

      const waitMs = getRetryDelayMs(msg, attempt);
      logger.warn("gemini embedding retry", { attempt, waitMs, taskType });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastErr;
}

function getRetryDelayMs(message: string, attempt: number): number {
  const delayMatch = message.match(/retryDelay['":\s]+(\d+)/);
  return delayMatch
    ? parseInt(delayMatch[1], 10) * 1000 + 1000
    : (attempt + 1) * 3000;
}
