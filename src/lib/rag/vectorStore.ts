import type { Chunk, RetrievedChunk } from "@/types";
import { logger } from "@/lib/logger";

/**
 * Cosine similarity between two vectors.
 * Works with the raw embedding vectors returned by the provider.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

interface StoredChunk extends Chunk {
  embedding: number[];
}

/**
 * Simple in-memory vector store.
 *
 * Trade-offs vs. a production vector DB:
 * - No persistence across server restarts (by design for this assignment)
 * - O(n) brute-force search, fine for hundreds or low thousands of chunks
 * - No HNSW / approximate search, not needed at this scale
 *
 * For production: swap this for Pinecone, Weaviate, pgvector, or LanceDB.
 */
class InMemoryVectorStore {
  private store: Map<string, StoredChunk> = new Map();

  upsert(chunks: (Chunk & { embedding: number[] })[]): void {
    chunks.forEach((chunk) => {
      this.store.set(chunk.id, chunk);
    });
    logger.info("vector store upserted", {
      count: chunks.length,
      total: this.store.size,
    });
  }

  /**
   * Remove all chunks belonging to a document.
   */
  deleteByDocumentId(documentId: string): void {
    let deleted = 0;
    const keysToDelete: string[] = [];
    this.store.forEach((chunk, id) => {
      if (chunk.documentId === documentId) keysToDelete.push(id);
    });
    keysToDelete.forEach((id) => { this.store.delete(id); deleted++; });
    logger.info("vector store deleted chunks", { documentId, deleted });
  }

  /**
   * Retrieve the top-k most similar chunks to a query embedding.
   */
  query(
    queryEmbedding: number[],
    topK: number,
    minScore: number,
    filterDocumentIds?: string[]
  ): RetrievedChunk[] {
    const allValues: StoredChunk[] = [];
    this.store.forEach((v) => allValues.push(v));
    const candidates = filterDocumentIds?.length
      ? allValues.filter((c) =>
          filterDocumentIds.includes(c.documentId)
        )
      : allValues;

    const scored = candidates
      .map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter((c) => c.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    logger.debug("vector store query", {
      candidates: candidates.length,
      returned: scored.length,
      topScore: scored[0]?.score,
    });

    return scored;
  }

  stats() {
    return { totalChunks: this.store.size };
  }

  /**
   * Return the first chunk (chunkIndex === 0) of each specified document.
   * Used as anchor chunks. They are always injected into retrieval results to ensure
   * the resume summary and JD overview are always in the LLM context.
   */
  getFirstChunks(documentIds: string[]): RetrievedChunk[] {
    const result: RetrievedChunk[] = [];
    const seen = new Set<string>();
    this.store.forEach((chunk) => {
      if (
        documentIds.includes(chunk.documentId) &&
        chunk.chunkIndex === 0 &&
        !seen.has(chunk.documentId)
      ) {
        seen.add(chunk.documentId);
        result.push({ ...chunk, score: 1.0 });
      }
    });
    return result;
  }

  clear() {
    this.store.clear();
  }
}

// Singleton: Next.js dev mode hot-reloads can re-instantiate modules,
// so we attach to global to survive reloads.
const GLOBAL_KEY = "__careerIntelVectorStore__";
declare global {
  // eslint-disable-next-line no-var
  var __careerIntelVectorStore__: InMemoryVectorStore | undefined;
}

export function getVectorStore(): InMemoryVectorStore {
  if (!global[GLOBAL_KEY]) {
    global[GLOBAL_KEY] = new InMemoryVectorStore();
  }
  return global[GLOBAL_KEY]!;
}
