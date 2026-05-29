import { describe, it, expect } from "vitest";
import {
  buildContextBlock,
  buildUserTurnWithContext,
  SYSTEM_PROMPT,
} from "@/lib/rag/prompts";
import type { RetrievedChunk } from "@/types";

function makeChunk(label: string, text: string): RetrievedChunk {
  return {
    id: "c1",
    documentId: "d1",
    documentKind: "resume",
    sourceLabel: label,
    text,
    chunkIndex: 0,
    score: 0.9,
  };
}

describe("buildContextBlock", () => {
  it("returns a fallback message when no chunks provided", () => {
    const block = buildContextBlock([]);
    expect(block).toContain("No relevant context found");
  });

  it("includes source labels from chunks", () => {
    const chunks = [
      makeChunk("Resume §1", "I worked at Acme for 5 years."),
      makeChunk("Job #1 §2", "Must have React experience."),
    ];
    const block = buildContextBlock(chunks);
    expect(block).toContain("Resume §1");
    expect(block).toContain("Job #1 §2");
    expect(block).toContain("I worked at Acme for 5 years.");
  });

  it("includes a Relevant Context header", () => {
    const chunks = [makeChunk("Resume §1", "Some text")];
    const block = buildContextBlock(chunks);
    expect(block).toContain("## Relevant Context");
  });

  it("separates chunks with a divider", () => {
    const chunks = [
      makeChunk("Resume §1", "Text one"),
      makeChunk("Resume §2", "Text two"),
    ];
    const block = buildContextBlock(chunks);
    expect(block).toContain("---");
  });
});

describe("buildUserTurnWithContext", () => {
  it("combines context and user question", () => {
    const context = "## Relevant Context\n\nSome context here.";
    const question = "What skills am I missing?";
    const result = buildUserTurnWithContext(question, context);
    expect(result).toContain(context);
    expect(result).toContain(question);
    expect(result).toContain("## User Question");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("contains guardrail instructions", () => {
    expect(SYSTEM_PROMPT).toContain("Ground your answers");
    expect(SYSTEM_PROMPT).toContain("Cite your sources");
    expect(SYSTEM_PROMPT).toContain("No guarantees");
    expect(SYSTEM_PROMPT).toContain("No discriminatory advice");
  });

  it("allows estimated ATS-style scoring requests", () => {
    expect(SYSTEM_PROMPT).toContain("estimated ATS-style fit score");
    expect(SYSTEM_PROMPT).toContain("Give a score from **0-100**");
    expect(SYSTEM_PROMPT).toContain("Do not refuse these requests");
  });
});
