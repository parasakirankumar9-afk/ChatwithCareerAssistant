import { describe, it, expect } from "vitest";
import {
  buildContextBlock,
  buildFullDocumentContextBlock,
  buildUserTurnWithContext,
  SYSTEM_PROMPT,
} from "@/lib/rag/prompts";
import type { RetrievedChunk } from "@/types";

function makeChunk(
  label: string,
  text: string,
  documentKind: "resume" | "job" = "resume"
): RetrievedChunk {
  return {
    id: `${documentKind}-${label}`,
    documentId: `${documentKind}-doc`,
    documentKind,
    sourceLabel: label,
    text,
    chunkIndex: 0,
    score: 0.9,
  };
}

describe("buildContextBlock", () => {
  it("returns a strict fallback message when no chunks are provided", () => {
    const block = buildContextBlock([]);
    expect(block).toContain("Retrieved resume chunks: 0");
    expect(block).toContain("Retrieved job description chunks: 0");
    expect(block).toContain("Grounding confidence: Low");
    expect(block).toContain("Do not invent resume or job facts");
  });

  it("includes source labels from chunks", () => {
    const chunks = [
      makeChunk("Resume section 1", "I worked at Acme for 5 years."),
      makeChunk("JD: Job 1 section 2", "Must have React experience.", "job"),
    ];
    const block = buildContextBlock(chunks);
    expect(block).toContain("Resume section 1");
    expect(block).toContain("JD: Job 1 section 2");
    expect(block).toContain("I worked at Acme for 5 years.");
  });

  it("separates resume and job evidence", () => {
    const chunks = [
      makeChunk("Resume section 1", "Some resume text"),
      makeChunk("JD: Job 1 section 1", "Some JD text.", "job"),
    ];
    const block = buildContextBlock(chunks);
    expect(block).toContain("## Retrieval Summary");
    expect(block).toContain("## Resume Evidence");
    expect(block).toContain("## Job Description Evidence");
    expect(block).toContain("Retrieved resume chunks: 1");
    expect(block).toContain("Retrieved job description chunks: 1");
    expect(block).toContain("Grounding confidence: High");
  });

  it("marks confidence as medium when only one document type is retrieved", () => {
    const block = buildContextBlock([
      makeChunk("Resume section 1", "Some resume text"),
    ]);
    expect(block).toContain("Grounding confidence: Medium");
    expect(block).toContain("Not found in retrieved context.");
  });

  it("separates chunks with a divider", () => {
    const chunks = [
      makeChunk("Resume section 1", "Text one"),
      makeChunk("Resume section 2", "Text two"),
    ];
    const block = buildContextBlock(chunks);
    expect(block).toContain("---");
  });
});

describe("buildUserTurnWithContext", () => {
  it("combines context and user question", () => {
    const context = "## Resume Evidence\n\nSome context here.";
    const question = "What skills am I missing?";
    const result = buildUserTurnWithContext(question, context);
    expect(result).toContain(context);
    expect(result).toContain(question);
    expect(result).toContain("## User Question");
  });
});

describe("buildFullDocumentContextBlock", () => {
  it("includes full resume and JD text for broad drafting requests", () => {
    const block = buildFullDocumentContextBlock([
      {
        id: "resume-1",
        kind: "resume",
        filename: "resume.txt",
        rawText: "Bank of America\nGenerative AI Engineer\nHomesite Insurance\nAI/ML Engineer",
      },
      {
        id: "job-1",
        kind: "job",
        filename: "jd.txt",
        title: "Forward Deployed Engineer",
        rawText: "Build prototypes and MVPs with AI-enabled solutions.",
      },
    ]);

    expect(block).toContain("Context mode: full-document drafting");
    expect(block).toContain("## Full Resume Text");
    expect(block).toContain("## Full Job Description Text");
    expect(block).toContain("Bank of America");
    expect(block).toContain("Homesite Insurance");
    expect(block).toContain("Forward Deployed Engineer");
    expect(block).toContain("do not invent missing experience");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("contains guardrail instructions", () => {
    expect(SYSTEM_PROMPT).toContain("Ground your answers");
    expect(SYSTEM_PROMPT).toContain("Evidence before claims");
    expect(SYSTEM_PROMPT).toContain("Response Selection");
    expect(SYSTEM_PROMPT).toContain("Cite your sources");
    expect(SYSTEM_PROMPT).toContain("No guarantees");
    expect(SYSTEM_PROMPT).toContain("No discriminatory advice");
  });

  it("keeps rewrite requests user-ready instead of evidence-report shaped", () => {
    expect(SYSTEM_PROMPT).toContain(
      "Start with the finished rewritten content"
    );
    expect(SYSTEM_PROMPT).toContain(
      "Do not append source labels like"
    );
    expect(SYSTEM_PROMPT).toContain(
      "Do not include separate \"Resume evidence\" or \"JD evidence\" sections"
    );
    expect(SYSTEM_PROMPT).toContain("Why this works");
    expect(SYSTEM_PROMPT).toContain("Never use placeholders");
  });

  it("allows estimated ATS-style scoring requests", () => {
    expect(SYSTEM_PROMPT).toContain("estimated ATS-style fit score");
    expect(SYSTEM_PROMPT).toContain("Give a score from **0-100**");
    expect(SYSTEM_PROMPT).toContain("Do not refuse these requests");
  });
});
