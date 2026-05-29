import type { ParsedDocument } from "@/types";

export interface AtsKeyword {
  term: string;
  weight: number;
  matched: boolean;
}

export interface AtsScore {
  overall: number;
  keywordScore: number;
  experienceScore: number;
  presentationScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  weakKeywords: string[];
  resumeSignals: string[];
  jobSignals: string[];
}

const SCORE_QUERY_PATTERN =
  /\b(ats|score|match score|keyword match|keyword coverage|resume score|fit score|percentage|percent|rank|ranking)\b/i;

const STOP_WORDS = new Set([
  "about",
  "above",
  "across",
  "after",
  "again",
  "against",
  "also",
  "among",
  "and",
  "any",
  "are",
  "because",
  "been",
  "both",
  "but",
  "can",
  "did",
  "does",
  "each",
  "for",
  "from",
  "has",
  "have",
  "having",
  "her",
  "his",
  "how",
  "into",
  "its",
  "job",
  "may",
  "more",
  "must",
  "our",
  "per",
  "role",
  "should",
  "than",
  "that",
  "the",
  "their",
  "this",
  "through",
  "to",
  "use",
  "using",
  "was",
  "were",
  "will",
  "with",
  "work",
  "you",
  "your",
]);

const SKILL_TERMS = [
  "agentic ai",
  "ai agents",
  "aws",
  "azure",
  "ci/cd",
  "cloud",
  "docker",
  "embedding",
  "fastapi",
  "fine tuning",
  "gcp",
  "generative ai",
  "github actions",
  "graphql",
  "java",
  "javascript",
  "kubernetes",
  "langchain",
  "llamaindex",
  "machine learning",
  "microservices",
  "next.js",
  "node.js",
  "openai",
  "postgres",
  "python",
  "rag",
  "react",
  "rest api",
  "sql",
  "typescript",
  "vector database",
  "vertex ai",
];

export function isAtsScoreQuestion(question: string): boolean {
  return SCORE_QUERY_PATTERN.test(question);
}

export function buildAtsScoreContext(
  docs: ParsedDocument[],
  question: string
): string | null {
  if (!isAtsScoreQuestion(question)) return null;

  const resumes = docs.filter((doc) => doc.kind === "resume");
  const jobs = docs.filter((doc) => doc.kind === "job");
  if (resumes.length === 0 || jobs.length === 0) return null;

  const score = scoreResumeAgainstJobs(resumes, jobs);
  return formatAtsScore(score);
}

export function scoreResumeAgainstJobs(
  resumes: ParsedDocument[],
  jobs: ParsedDocument[]
): AtsScore {
  const resumeText = resumes.map((doc) => doc.rawText).join("\n\n");
  const jobText = jobs.map((doc) => doc.rawText).join("\n\n");
  const resumeNormalized = normalizeText(resumeText);

  const keywords = extractJobKeywords(jobText).map((keyword) => ({
    ...keyword,
    matched: isKeywordMatched(keyword.term, resumeNormalized),
  }));

  const totalWeight = keywords.reduce((sum, keyword) => sum + keyword.weight, 0);
  const matchedWeight = keywords
    .filter((keyword) => keyword.matched)
    .reduce((sum, keyword) => sum + keyword.weight, 0);

  const keywordScore =
    totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100);
  const experienceScore = scoreExperienceAlignment(resumeText, jobText);
  const presentationScore = scoreResumePresentation(resumeText, keywords);
  const overall = Math.round(
    keywordScore * 0.5 + experienceScore * 0.3 + presentationScore * 0.2
  );

  const matchedKeywords = keywords
    .filter((keyword) => keyword.matched)
    .slice(0, 18)
    .map((keyword) => keyword.term);
  const missingKeywords = keywords
    .filter((keyword) => !keyword.matched && keyword.weight >= 2)
    .slice(0, 12)
    .map((keyword) => keyword.term);
  const weakKeywords = keywords
    .filter(
      (keyword) =>
        !keyword.matched &&
        keyword.weight < 2 &&
        keyword.term.split(/\s+/).length > 1
    )
    .slice(0, 8)
    .map((keyword) => keyword.term);

  return {
    overall,
    keywordScore,
    experienceScore,
    presentationScore,
    matchedKeywords,
    missingKeywords,
    weakKeywords,
    resumeSignals: summarizeResumeSignals(resumeText),
    jobSignals: summarizeJobSignals(jobText),
  };
}

function extractJobKeywords(jobText: string): Array<Omit<AtsKeyword, "matched">> {
  const normalized = normalizeText(jobText);
  const weighted = new Map<string, number>();

  for (const term of SKILL_TERMS) {
    if (normalized.includes(term)) {
      weighted.set(term, Math.max(weighted.get(term) ?? 0, 3));
    }
  }

  const requirementLines = jobText
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) =>
      /\b(required|requirements|preferred|must|need|responsibilities|qualifications|skills|experience|proficient|familiar)\b/i.test(
        line
      )
    );

  for (const line of requirementLines) {
    for (const phrase of extractPhrases(line)) {
      weighted.set(phrase, Math.max(weighted.get(phrase) ?? 0, phrase.includes(" ") ? 2 : 1));
    }
  }

  const frequencies = new Map<string, number>();
  for (const token of tokenize(normalized)) {
    if (!STOP_WORDS.has(token) && token.length >= 3) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
  }

  [...frequencies.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .forEach(([term, count]) => {
      weighted.set(term, Math.max(weighted.get(term) ?? 0, Math.min(count, 3)));
    });

  return [...weighted.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
    .slice(0, 35);
}

function extractPhrases(text: string): string[] {
  const tokens = tokenize(normalizeText(text)).filter(
    (token) => !STOP_WORDS.has(token) && token.length >= 3
  );
  const phrases = new Set<string>();

  for (const token of tokens) {
    phrases.add(token);
  }

  for (let size = 2; size <= 3; size++) {
    for (let i = 0; i <= tokens.length - size; i++) {
      const phrase = tokens.slice(i, i + size).join(" ");
      if (!/[0-9]/.test(phrase)) phrases.add(phrase);
    }
  }

  return [...phrases].filter((phrase) => phrase.length <= 50);
}

function isKeywordMatched(term: string, resumeNormalized: string): boolean {
  if (resumeNormalized.includes(term)) return true;
  const words = term.split(/\s+/).filter((word) => word.length > 2);
  if (words.length <= 1) return false;
  return words.filter((word) => resumeNormalized.includes(word)).length / words.length >= 0.8;
}

function scoreExperienceAlignment(resumeText: string, jobText: string): number {
  const resumeNormalized = normalizeText(resumeText);
  const jobNormalized = normalizeText(jobText);
  let score = 45;

  const resumeYears = maxYearsMentioned(resumeNormalized);
  const jobYears = maxYearsMentioned(jobNormalized);
  if (resumeYears > 0 && jobYears > 0) {
    score += resumeYears >= jobYears ? 20 : Math.max(0, Math.round((resumeYears / jobYears) * 20));
  } else if (resumeYears > 0) {
    score += 12;
  }

  const roleTerms = ["engineer", "developer", "architect", "lead", "manager", "analyst", "consultant"];
  score += overlapScore(resumeNormalized, jobNormalized, roleTerms, 12);

  const domainTerms = [
    "ai",
    "data",
    "cloud",
    "product",
    "platform",
    "security",
    "customer",
    "enterprise",
    "automation",
    "analytics",
  ];
  score += overlapScore(resumeNormalized, jobNormalized, domainTerms, 18);

  return clamp(score, 0, 100);
}

function scoreResumePresentation(
  resumeText: string,
  keywords: Array<AtsKeyword | Omit<AtsKeyword, "matched">>
): number {
  let score = 45;
  const normalized = normalizeText(resumeText);

  if (/\b(experience|work experience|professional experience)\b/i.test(resumeText)) score += 12;
  if (/\b(skills|technical skills|tools|technologies)\b/i.test(resumeText)) score += 12;
  if (/\b(projects|selected projects)\b/i.test(resumeText)) score += 8;
  if (/\d+%|\$\d+|\b\d+\s*(x|users|customers|projects|models|pipelines)\b/i.test(resumeText)) score += 10;

  const topTerms = keywords.slice(0, 12).filter((keyword) => normalized.includes(keyword.term));
  score += Math.min(13, topTerms.length);

  return clamp(score, 0, 100);
}

function summarizeResumeSignals(resumeText: string): string[] {
  const signals: string[] = [];
  if (/\b\d+\+?\s+years?\b/i.test(resumeText)) signals.push("Resume includes explicit years of experience");
  if (/\b(skills|technical skills)\b/i.test(resumeText)) signals.push("Resume has a skills section");
  if (/\d+%|\$\d+|\b\d+\s*(x|users|customers|projects|models|pipelines)\b/i.test(resumeText)) {
    signals.push("Resume includes quantified impact");
  }
  return signals.length ? signals : ["Resume evidence is available but key signals are not strongly structured"];
}

function summarizeJobSignals(jobText: string): string[] {
  return jobText
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => /\b(required|preferred|must|experience|skills|responsibilities)\b/i.test(line))
    .slice(0, 4);
}

function formatAtsScore(score: AtsScore): string {
  return `## Dynamic ATS-Style Analysis

Use this computed analysis when answering the user's score or keyword-match question. It was calculated from the uploaded resume and job description text before the LLM response.

- Estimated ATS-style fit score: ${score.overall}/100
- Keyword match score: ${score.keywordScore}/100
- Experience alignment score: ${score.experienceScore}/100
- Resume presentation score: ${score.presentationScore}/100
- Matched keywords: ${formatList(score.matchedKeywords)}
- Missing or weak high-priority keywords: ${formatList(score.missingKeywords)}
- Partial/weak phrase coverage: ${formatList(score.weakKeywords)}
- Resume signals: ${formatList(score.resumeSignals)}
- Job requirement signals: ${formatList(score.jobSignals)}

Answer with the score first, then the breakdown, then specific resume edits. Say this is a heuristic estimate, not an actual proprietary ATS result.`;
}

function formatList(items: string[]): string {
  return items.length ? items.join(", ") : "None found in the available context";
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/node\.js/g, "node.js")
    .replace(/next\.js/g, "next.js")
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return text.match(/[a-z0-9+#./-]+/g) ?? [];
}

function maxYearsMentioned(text: string): number {
  const matches = [...text.matchAll(/\b(\d{1,2})\+?\s+years?\b/g)];
  return matches.reduce((max, match) => Math.max(max, Number(match[1])), 0);
}

function overlapScore(
  resumeText: string,
  jobText: string,
  terms: string[],
  maxScore: number
): number {
  const relevant = terms.filter((term) => jobText.includes(term));
  if (relevant.length === 0) return 0;
  const matched = relevant.filter((term) => resumeText.includes(term)).length;
  return Math.round((matched / relevant.length) * maxScore);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
