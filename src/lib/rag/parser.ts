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
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 15);

  if (lines.length === 0) return {};

  const firstLine = lines[0];

  // "Software Engineer at Acme" or "Software Engineer @ Acme".
  const atPattern = /^(.+?)\s+(?:at|@)\s+(.+)$/i;
  for (const line of lines) {
    const match = line.match(atPattern);
    if (match && wordCount(match[1]) <= 6) {
      return { title: match[1].trim(), company: match[2].trim() };
    }
  }

  // "Acme - Senior Backend Engineer" or "Senior Backend Engineer - Acme".
  const dashPattern = /^(.+?)\s*[-\u2013\u2014]\s*(.+)$/;
  for (const line of lines) {
    const match = line.match(dashPattern);
    if (!match) continue;

    const left = match[1].trim();
    const right = match[2].trim();
    if (wordCount(left) <= 5 && wordCount(right) <= 5) {
      return wordCount(left) <= wordCount(right)
        ? { company: left, title: right }
        : { title: left, company: right };
    }
  }

  // Short first line is usually a title; scan nearby lines for company hints.
  if (wordCount(firstLine) <= 6 && !/[.!?]$/.test(firstLine)) {
    const companyPatterns = [
      /^(?:at|@|company:|organization:|employer:)\s*(.+)/i,
      /^About\s+(.+)/i,
      /^Hiring\s+(?:company|organization):\s*(.+)/i,
    ];

    for (const line of lines.slice(1, 8)) {
      for (const pattern of companyPatterns) {
        const match = line.match(pattern);
        if (match) return { title: firstLine, company: match[1].trim() };
      }
    }

    return { title: firstLine };
  }

  return { title: firstLine };
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
