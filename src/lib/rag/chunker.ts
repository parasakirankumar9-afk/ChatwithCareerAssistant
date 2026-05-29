import type { Chunk, DocumentKind, ParsedDocument } from "@/types";
import { v4 as uuidv4 } from "uuid";

export interface ChunkingOptions {
  /** Target characters per chunk */
  chunkSize?: number;
  /** Characters of overlap between consecutive chunks */
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;

/**
 * Split text into overlapping chunks of roughly `chunkSize` characters.
 * Prefers splitting on paragraph or sentence boundaries when possible.
 */
export function chunkText(
  text: string,
  opts: ChunkingOptions = {}
): string[] {
  const size = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(opts.overlap ?? DEFAULT_OVERLAP, Math.floor(size / 2));

  // Normalize whitespace but preserve paragraph breaks
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (normalized.length <= size) {
    return normalized.length > 0 ? [normalized] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = start + size;

    if (end >= normalized.length) {
      chunks.push(normalized.slice(start).trim());
      break;
    }

    // Try to find a good split point: paragraph > sentence > word > char
    let splitAt = end;

    const paraBreak = normalized.lastIndexOf("\n\n", end);
    if (paraBreak > start + overlap) {
      splitAt = paraBreak;
    } else {
      // Sentence boundary: ". ", "! ", "? "
      const sentEnd = Math.max(
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf("! ", end),
        normalized.lastIndexOf("? ", end)
      );
      if (sentEnd > start + overlap) {
        splitAt = sentEnd + 1; // include the period
      } else {
        // Word boundary
        const wordEnd = normalized.lastIndexOf(" ", end);
        if (wordEnd > start + overlap) {
          splitAt = wordEnd;
        }
      }
    }

    const chunk = normalized.slice(start, splitAt).trim();
    if (chunk.length > 0) chunks.push(chunk);

    // Move start back by overlap to maintain context continuity
    start = splitAt - overlap;
    if (start <= 0 && chunks.length > 0) break; // safety guard
  }

  return chunks;
}

/**
 * Build `Chunk` objects from a parsed document.
 */
export function buildChunks(
  doc: ParsedDocument,
  opts: ChunkingOptions = {}
): Chunk[] {
  const texts = chunkText(doc.rawText, opts);

  return texts.map((text, idx) => ({
    id: uuidv4(),
    documentId: doc.id,
    documentKind: doc.kind,
    sourceLabel: buildSourceLabel(doc, idx),
    text,
    chunkIndex: idx,
  }));
}

function buildSourceLabel(doc: ParsedDocument, chunkIndex: number): string {
  if (doc.kind === "resume") {
    return `Resume section ${chunkIndex + 1}`;
  }
  // Prefix with "JD:" so citations are clearly recognisable as job description content
  const name = doc.title ?? doc.filename;
  return `JD: ${name} section ${chunkIndex + 1}`;
}
