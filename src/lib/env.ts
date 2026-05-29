import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  /** Gemini model for chat completions */
  GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-flash-lite"),
  /** Gemini embedding model */
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  /** Max tokens for LLM completion */
  LLM_MAX_TOKENS: z.coerce.number().default(2048),
  /** Number of chunks to retrieve per query */
  RETRIEVAL_TOP_K: z.coerce.number().default(8),
  /** Minimum similarity score [0–1] to include a chunk */
  RETRIEVAL_MIN_SCORE: z.coerce.number().default(0.25),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${missing}`);
  }
  return result.data;
}

// Lazy singleton – validated once on first access
let _env: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (!_env) _env = parseEnv();
  return _env;
}
