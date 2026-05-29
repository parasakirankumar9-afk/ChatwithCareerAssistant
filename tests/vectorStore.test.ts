import { describe, it, expect, beforeEach } from "vitest";
import { getVectorStore } from "@/lib/rag/vectorStore";
import type { Chunk } from "@/types";

function makeChunk(
  id: string,
  documentId: string,
  embedding: number[]
): Chunk & { embedding: number[] } {
  return {
    id,
    documentId,
    documentKind: "resume",
    sourceLabel: `Resume §1`,
    text: "Sample chunk text",
    chunkIndex: 0,
    embedding,
  };
}

// Simple unit vector helpers
function unitVec(n: number, hotIndex: number): number[] {
  const v = new Array(n).fill(0);
  v[hotIndex] = 1;
  return v;
}

describe("InMemoryVectorStore", () => {
  let store: ReturnType<typeof getVectorStore>;

  beforeEach(() => {
    store = getVectorStore();
    store.clear();
  });

  it("starts empty", () => {
    expect(store.stats().totalChunks).toBe(0);
  });

  it("upserts chunks and updates stats", () => {
    store.upsert([makeChunk("c1", "d1", unitVec(4, 0))]);
    expect(store.stats().totalChunks).toBe(1);

    store.upsert([makeChunk("c2", "d1", unitVec(4, 1))]);
    expect(store.stats().totalChunks).toBe(2);
  });

  it("returns the most similar chunk for a query", () => {
    store.upsert([
      makeChunk("c1", "d1", unitVec(4, 0)), // matches [1,0,0,0]
      makeChunk("c2", "d1", unitVec(4, 1)), // matches [0,1,0,0]
      makeChunk("c3", "d1", unitVec(4, 2)), // matches [0,0,1,0]
    ]);

    const results = store.query(unitVec(4, 1), 1, 0);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("c2");
    expect(results[0].score).toBeCloseTo(1.0, 3);
  });

  it("filters by minScore", () => {
    store.upsert([
      makeChunk("c1", "d1", unitVec(4, 0)), // orthogonal to query
    ]);

    // Query along a different axis — cosine similarity = 0
    const results = store.query(unitVec(4, 1), 5, 0.5);
    expect(results).toHaveLength(0);
  });

  it("filters by documentId", () => {
    store.upsert([
      makeChunk("c1", "doc-a", unitVec(4, 0)),
      makeChunk("c2", "doc-b", unitVec(4, 0)),
    ]);

    const results = store.query(unitVec(4, 0), 10, 0, ["doc-a"]);
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe("doc-a");
  });

  it("deletes chunks by documentId", () => {
    store.upsert([
      makeChunk("c1", "doc-a", unitVec(4, 0)),
      makeChunk("c2", "doc-b", unitVec(4, 1)),
    ]);

    store.deleteByDocumentId("doc-a");
    expect(store.stats().totalChunks).toBe(1);

    const results = store.query(unitVec(4, 0), 5, 0);
    expect(results.every((r) => r.documentId !== "doc-a")).toBe(true);
  });

  it("returns results in descending score order", () => {
    const query = [0.9, 0.1, 0, 0];
    store.upsert([
      makeChunk("c1", "d1", [1, 0, 0, 0]),    // high similarity
      makeChunk("c2", "d1", [0, 1, 0, 0]),    // low similarity
      makeChunk("c3", "d1", [0.7, 0.7, 0, 0]), // medium
    ]);

    const results = store.query(query, 3, 0);
    expect(results.length).toBe(3);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
  });
});
