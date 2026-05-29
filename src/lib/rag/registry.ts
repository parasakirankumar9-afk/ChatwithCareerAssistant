import type { ParsedDocument } from "@/types";
import { logger } from "@/lib/logger";

/**
 * In-memory registry of parsed documents.
 * Survives Next.js dev hot-reloads via global attachment.
 *
 * Production replacement: store in Postgres / DynamoDB.
 */
class DocumentRegistry {
  private docs: Map<string, ParsedDocument> = new Map();

  add(doc: ParsedDocument): void {
    this.docs.set(doc.id, doc);
    logger.info("document registered", {
      id: doc.id,
      kind: doc.kind,
      filename: doc.filename,
    });
  }

  get(id: string): ParsedDocument | undefined {
    return this.docs.get(id);
  }

  getAll(): ParsedDocument[] {
    const docs: ParsedDocument[] = [];
    this.docs.forEach((v) => docs.push(v));
    return docs.sort(
      (a, b) =>
        new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    );
  }

  delete(id: string): boolean {
    return this.docs.delete(id);
  }

  clear(): void {
    this.docs.clear();
  }

  /** Return all docs without rawText (for client-safe transfer) */
  getAllMeta(): Array<Omit<ParsedDocument, "rawText">> {
    return this.getAll().map(({ rawText: _rawText, ...rest }) => rest);
  }
}

const GLOBAL_KEY = "__careerIntelDocRegistry__";
declare global {
  // eslint-disable-next-line no-var
  var __careerIntelDocRegistry__: DocumentRegistry | undefined;
}

export function getDocumentRegistry(): DocumentRegistry {
  if (!global[GLOBAL_KEY]) {
    global[GLOBAL_KEY] = new DocumentRegistry();
  }
  return global[GLOBAL_KEY]!;
}
