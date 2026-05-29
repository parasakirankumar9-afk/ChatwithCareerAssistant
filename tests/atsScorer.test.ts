import { describe, expect, it } from "vitest";
import {
  buildAtsScoreContext,
  isAtsScoreQuestion,
  scoreResumeAgainstJobs,
} from "@/lib/rag/atsScorer";
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

describe("atsScorer", () => {
  it("detects score and keyword-match questions", () => {
    expect(isAtsScoreQuestion("ATS score for my resume")).toBe(true);
    expect(isAtsScoreQuestion("What is my keyword match?")).toBe(true);
    expect(isAtsScoreQuestion("What skills am I missing?")).toBe(false);
  });

  it("scores resume against job text dynamically", () => {
    const resume = makeDoc(
      "resume",
      "GenAI Engineer with 5 years of experience. Skills: Python, React, AWS, RAG, OpenAI, vector database, Docker. Built AI agents and production APIs with quantified 30% latency improvement."
    );
    const job = makeDoc(
      "job",
      "Required skills: Python, React, AWS, RAG, OpenAI, vector database, Docker, Kubernetes. Need 4 years experience building generative AI applications and APIs."
    );

    const score = scoreResumeAgainstJobs([resume], [job]);

    expect(score.overall).toBeGreaterThan(70);
    expect(score.matchedKeywords).toContain("python");
    expect(score.missingKeywords).toContain("kubernetes");
  });

  it("returns prompt context only for score-style questions with resume and job docs", () => {
    const resume = makeDoc("resume", "Python and React experience.");
    const job = makeDoc("job", "Required skills: Python, React, AWS.");

    const context = buildAtsScoreContext(
      [resume, job],
      "Give me an ATS score"
    );

    expect(context).toContain("Dynamic ATS-Style Analysis");
    expect(context).toContain("Estimated ATS-style fit score");
    expect(buildAtsScoreContext([resume, job], "What should I improve?")).toBeNull();
  });
});
