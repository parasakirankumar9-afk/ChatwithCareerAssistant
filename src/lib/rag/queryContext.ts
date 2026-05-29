import type { ParsedDocument } from "@/types";
import { buildAtsScoreContext } from "@/lib/rag/atsScorer";

type QueryIntent =
  | "ats_score"
  | "skill_gap"
  | "experience_alignment"
  | "interview_prep"
  | "resume_rewrite"
  | "job_comparison"
  | "general";

const INTENT_RULES: Array<{ intent: QueryIntent; pattern: RegExp }> = [
  {
    intent: "ats_score",
    pattern:
      /\b(ats|score|match score|keyword match|keyword coverage|resume score|fit score|percentage|percent|rank|ranking)\b/i,
  },
  {
    intent: "skill_gap",
    pattern: /\b(missing|gap|gaps|lack|weak|skills?|requirements?)\b/i,
  },
  {
    intent: "experience_alignment",
    pattern: /\b(align|alignment|fit|match|experience|qualified|suitable)\b/i,
  },
  {
    intent: "interview_prep",
    pattern: /\b(interview|questions|prepare|prep|talking points|stories)\b/i,
  },
  {
    intent: "resume_rewrite",
    pattern: /\b(rewrite|revise|improve|tailor|summary|bullet|resume)\b/i,
  },
  {
    intent: "job_comparison",
    pattern: /\b(best job|which job|compare|comparison|job #|role #)\b/i,
  },
];

export function detectQueryIntent(question: string): QueryIntent {
  return INTENT_RULES.find((rule) => rule.pattern.test(question))?.intent ?? "general";
}

export function buildDynamicQueryContext(
  docs: ParsedDocument[],
  question: string
): string {
  const intent = detectQueryIntent(question);
  const resumeCount = docs.filter((doc) => doc.kind === "resume").length;
  const jobs = docs.filter((doc) => doc.kind === "job");
  const atsContext = buildAtsScoreContext(docs, question);

  const lines = [
    "## Dynamic Query Guidance",
    "",
    `Detected user intent: ${intent}`,
    `Available documents: ${resumeCount} resume(s), ${jobs.length} job description(s)`,
  ];

  if (jobs.length > 0) {
    lines.push(
      `Active job descriptions: ${jobs
        .map((job, index) => `Job #${index + 1}: ${job.title ?? job.filename}`)
        .join("; ")}`
    );
  }

  lines.push("", ...instructionsForIntent(intent));

  if (atsContext) {
    lines.push("", "---", "", atsContext);
  }

  return lines.join("\n");
}

function instructionsForIntent(intent: QueryIntent): string[] {
  switch (intent) {
    case "ats_score":
      return [
        "Answer as an estimated, evidence-based resume-to-JD match analysis.",
        "Use the computed ATS-style analysis if present, then explain the score in practical terms.",
      ];
    case "skill_gap":
      return [
        "Identify missing or weak skills by comparing JD requirements against resume evidence.",
        "Separate confirmed gaps from areas that may simply be unstated in the resume.",
        "End with concrete resume or learning recommendations.",
      ];
    case "experience_alignment":
      return [
        "Compare resume experience against the role's responsibilities, seniority, tools, and domain.",
        "Call out strong matches, partial matches, and mismatches.",
        "Use evidence from both resume and JD context.",
      ];
    case "interview_prep":
      return [
        "Generate interview preparation guidance grounded in the JD and resume.",
        "Prioritize likely technical, behavioral, and project-deep-dive questions.",
        "Suggest evidence-backed stories the candidate can prepare.",
      ];
    case "resume_rewrite":
      return [
        "Suggest resume wording that targets the JD without inventing experience.",
        "Preserve truthfulness: only rewrite or emphasize evidence present in the resume context.",
        "Prefer concrete bullets, keywords, and quantified impact where supported.",
      ];
    case "job_comparison":
      return [
        "Compare active job descriptions against the resume and each other.",
        "Rank fit only when enough evidence is available, and explain the basis for the ranking.",
        "Mention what additional context would improve confidence.",
      ];
    default:
      return [
        "Answer the user's career-intelligence question using the retrieved resume and job context.",
        "If the request is ambiguous, give the most useful grounded answer and state assumptions briefly.",
        "Do not refuse career-fit, resume, job, interview, keyword, or preparation questions when the uploaded context supports a useful answer.",
      ];
  }
}
