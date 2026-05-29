import { logger } from "@/lib/logger";

/**
 * Extract plain text from a file buffer.
 * Supports PDF and plain text. Falls back gracefully.
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  logger.info("parsing document", { filename, mimeType });

  if (mimeType === "application/pdf" || filename.endsWith(".pdf")) {
    return parsePdf(buffer, filename);
  }

  const text = buffer.toString("utf-8");
  logger.info("parsed as plain text", { filename, chars: text.length });
  return text;
}

async function parsePdf(buffer: Buffer, filename: string): Promise<string> {
  try {
    // Dynamic import avoids bundling pdf-parse into edge-style runtimes.
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    const text = result.text.trim();
    logger.info("pdf parsed", {
      filename,
      pages: result.numpages,
      chars: text.length,
    });
    return text;
  } catch (err) {
    logger.error("pdf parse failed", {
      filename,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error(`Failed to parse PDF "${filename}": ${String(err)}`);
  }
}

/**
 * Attempt to extract a job title and company from raw job-posting text.
 */
export function extractJobMeta(text: string): {
  title?: string;
  company?: string;
} {
  const lines = text
    .split("\n")
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .slice(0, 40);

  if (lines.length === 0) return {};

  const company = extractCompany(lines);

  // "Software Engineer at Acme" or "Software Engineer @ Acme".
  const atPattern = /^(.+?)\s+(?:at|@)\s+(.+)$/i;
  for (const line of lines) {
    const match = line.match(atPattern);
    const title = match?.[1]?.trim();
    const companyFromLine = match?.[2]?.trim();
    if (title && isLikelyJobTitle(title)) {
      return { title: titleCaseIfAllCaps(title), company: companyFromLine };
    }
  }

  // "Job Title: Forward Deployed Engineer", "Role: AI Engineer", etc.
  const labelledTitlePattern =
    /^(?:job\s*)?(?:title|role|position|opening|designation)\s*:\s*(.+)$/i;
  for (const line of lines) {
    const match = line.match(labelledTitlePattern);
    const title = match?.[1]?.trim();
    if (title && isLikelyJobTitle(title)) {
      return { title: titleCaseIfAllCaps(title), company };
    }
  }

  // "Acme - Senior Backend Engineer" or "Senior Backend Engineer - Acme".
  const dashPattern = /^(.+?)\s*[-\u2013\u2014]\s*(.+)$/;
  for (const line of lines) {
    const match = line.match(dashPattern);
    if (!match) continue;

    const left = match[1].trim();
    const right = match[2].trim();
    if (wordCount(left) <= 8 && wordCount(right) <= 8) {
      if (isLikelyJobTitle(left) && !isLikelyJobTitle(right)) {
        return { title: titleCaseIfAllCaps(left), company: right };
      }
      if (isLikelyJobTitle(right) && !isLikelyJobTitle(left)) {
        return { title: titleCaseIfAllCaps(right), company: left };
      }
    }
  }

  // The first strong title-looking line is usually the role.
  for (const line of lines.slice(0, 12)) {
    const candidate = stripHeaderSuffixes(line);
    if (isLikelyJobTitle(candidate)) {
      return { title: titleCaseIfAllCaps(candidate), company };
    }
  }

  const fallback = lines.find((line) => !isNoiseLine(line)) ?? lines[0];
  return { title: titleCaseIfAllCaps(stripHeaderSuffixes(fallback)), company };
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function cleanLine(line: string): string {
  return line
    .replace(/^[\s|•*§-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCompany(lines: string[]): string | undefined {
  const explicitPatterns = [
    /^(?:company|organization|employer)\s*:\s*(.+)$/i,
  ];
  const inferredPatterns = [
    /^about\s+(.+)$/i,
    /^(.+?)\s+is\s+(?:a|an)\s+/i,
  ];

  for (const line of lines.slice(0, 12)) {
    for (const pattern of explicitPatterns) {
      const match = line.match(pattern);
      const candidate = match?.[1]?.trim();
      if (candidate && wordCount(candidate) <= 6 && !isNoiseLine(candidate)) {
        return candidate;
      }
    }
  }

  for (const line of lines.slice(0, 12)) {
    for (const pattern of inferredPatterns) {
      const match = line.match(pattern);
      const candidate = match?.[1]?.trim();
      if (candidate && wordCount(candidate) <= 6 && !isNoiseLine(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function stripHeaderSuffixes(line: string): string {
  return line
    .replace(/\s*\|\s*(location|type|remote|contract|full[- ]?time).*$/i, "")
    .replace(/\s+(location|type)\s*:\s*.+$/i, "")
    .trim();
}

function isLikelyJobTitle(value: string): boolean {
  const title = stripHeaderSuffixes(value);
  const words = wordCount(title);
  if (words < 2 || words > 9) return false;
  if (/[.!?]$/.test(title)) return false;
  if (isNoiseLine(title)) return false;

  return /\b(engineer|developer|architect|scientist|analyst|manager|lead|consultant|specialist|designer|administrator|director|product|data|ai|ml|machine learning|forward deployed|fullstack|full-stack|backend|frontend|platform|cloud|devops|security)\b/i.test(
    title
  );
}

function isNoiseLine(value: string): boolean {
  return /^(about|your mission|what you'?ll do|what you bring|what we offer|ready to apply|location|type|remote|contract|responsibilities|requirements|qualifications|benefits|2025)$/i.test(
    value.trim()
  );
}

function titleCaseIfAllCaps(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bMl\b/g, "ML")
    .replace(/\bApi\b/g, "API");
}
