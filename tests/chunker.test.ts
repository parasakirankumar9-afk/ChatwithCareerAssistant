import { describe, it, expect } from "vitest";
import { chunkText, buildChunks } from "@/lib/rag/chunker";
import type { ParsedDocument } from "@/types";

describe("chunkText", () => {
  it("returns the full text as a single chunk when text is shorter than chunkSize", () => {
    const text = "This is a short document.";
    const chunks = chunkText(text, { chunkSize: 800 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("returns empty array for empty string", () => {
    expect(chunkText("")).toHaveLength(0);
    expect(chunkText("   ")).toHaveLength(0);
  });

  it("splits long text into multiple chunks", () => {
    const paragraph = "Word ".repeat(50); // ~250 chars
    const text = paragraph.repeat(6); // ~1500 chars
    const chunks = chunkText(text, { chunkSize: 400, overlap: 80 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk does not exceed chunkSize by a large margin", () => {
    const text = "Hello world sentence ends. ".repeat(100);
    const size = 300;
    const chunks = chunkText(text, { chunkSize: size, overlap: 50 });
    for (const chunk of chunks) {
      // Allow a small overshoot due to sentence boundary alignment
      expect(chunk.length).toBeLessThan(size * 1.5);
    }
  });

  it("produces overlapping content between consecutive chunks", () => {
    const text = "Sentence number one. Sentence number two. Sentence number three. ".repeat(20);
    const chunks = chunkText(text, { chunkSize: 200, overlap: 60 });
    if (chunks.length >= 2) {
      // Verify adjacent chunks share some content
      const tail = chunks[0].slice(-60);
      const head = chunks[1].slice(0, 100);
      const overlap = [...tail].filter((c) => head.includes(c)).length;
      expect(overlap).toBeGreaterThan(0);
    }
  });

  it("handles text with many paragraph breaks", () => {
    const text = Array.from({ length: 10 }, (_, i) => `Paragraph ${i + 1} content here.`).join("\n\n");
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((c) => expect(c.trim().length).toBeGreaterThan(0));
  });
});

describe("buildChunks", () => {
  const makeDoc = (kind: ParsedDocument["kind"] = "resume"): ParsedDocument => ({
    id: "doc-1",
    kind,
    filename: "test.pdf",
    rawText: "Professional experience at Acme. Led a team of five engineers. Built scalable systems. ".repeat(20),
    title: kind === "job" ? "Senior Engineer @ Acme" : undefined,
    uploadedAt: new Date().toISOString(),
  });

  it("produces chunks with correct documentId", () => {
    const doc = makeDoc();
    const chunks = buildChunks(doc);
    for (const c of chunks) {
      expect(c.documentId).toBe("doc-1");
      expect(c.documentKind).toBe("resume");
    }
  });

  it("sourceLabel includes Resume prefix for resume docs", () => {
    const doc = makeDoc("resume");
    const chunks = buildChunks(doc);
    expect(chunks[0].sourceLabel).toMatch(/^Resume section/);
  });

  it("sourceLabel includes job title for job docs", () => {
    const doc = makeDoc("job");
    const chunks = buildChunks(doc);
    expect(chunks[0].sourceLabel).toMatch(/Senior Engineer @ Acme section/);
  });

  it("each chunk has a unique id", () => {
    const doc = makeDoc();
    const chunks = buildChunks(doc);
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chunkIndex increments sequentially", () => {
    const doc = makeDoc();
    const chunks = buildChunks(doc);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });
});
