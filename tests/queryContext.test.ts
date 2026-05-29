import { describe, expect, it } from "vitest";
import {
  buildDynamicQueryContext,
  detectQueryIntent,
  shouldUseFullDocumentContext,
} from "@/lib/rag/queryContext";
import type { ParsedDocument } from "@/types";

function makeDoc(kind: ParsedDocument["kind"], rawText: string): ParsedDocument {
  return {
    id: `${kind}-1`,
    kind,
    filename: `${kind}.txt`,
    rawText,
    uploadedAt: new Date().toISOString(),
  };
}

describe("queryContext", () => {
  it("detects common career-intelligence question intents", () => {
    expect(detectQueryIntent("ATS score for this JD")).toBe("ats_score");
    expect(detectQueryIntent("What skills am I missing?")).toBe("skill_gap");
    expect(detectQueryIntent("How does my experience align?")).toBe(
      "experience_alignment"
    );
    expect(detectQueryIntent("What interview questions should I prepare?")).toBe(
      "interview_prep"
    );
    expect(detectQueryIntent("Rewrite my summary")).toBe("resume_rewrite");
    expect(detectQueryIntent("Which job is best?")).toBe("job_comparison");
    expect(detectQueryIntent("Tell me something useful")).toBe("general");
  });

  it("builds dynamic guidance for non-ATS questions", () => {
    const context = buildDynamicQueryContext(
      [
        makeDoc("resume", "Python and React experience."),
        makeDoc("job", "Required skills: Python, React, AWS."),
      ],
      "What skills am I missing?"
    );

    expect(context).toContain("Dynamic Query Guidance");
    expect(context).toContain("Detected user intent: skill_gap");
    expect(context).toContain("Identify missing or weak skills");
    expect(context).not.toContain("Dynamic ATS-Style Analysis");
  });

  it("includes computed ATS analysis only for score-style questions", () => {
    const context = buildDynamicQueryContext(
      [
        makeDoc("resume", "Python, React, AWS, RAG, OpenAI."),
        makeDoc("job", "Required skills: Python, React, AWS, RAG, Docker."),
      ],
      "Give me an ATS score"
    );

    expect(context).toContain("Detected user intent: ats_score");
    expect(context).toContain("Dynamic ATS-Style Analysis");
  });

  it("uses full document context for broad resume rewrite requests", () => {
    expect(
      shouldUseFullDocumentContext("rewrite my whole full resume according to the JD")
    ).toBe(true);
    expect(shouldUseFullDocumentContext("tailor my resume for this role")).toBe(
      true
    );
    expect(shouldUseFullDocumentContext("what skills am I missing?")).toBe(
      false
    );
    expect(shouldUseFullDocumentContext("rewrite my summary")).toBe(false);
  });
});
