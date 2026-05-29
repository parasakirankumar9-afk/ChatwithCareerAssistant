import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { parseDocument, extractJobMeta } from "@/lib/rag/parser";
import { buildChunks } from "@/lib/rag/chunker";
import { embedTexts } from "@/lib/rag/embedder";
import { getVectorStore } from "@/lib/rag/vectorStore";
import { getDocumentRegistry } from "@/lib/rag/registry";
import { logger } from "@/lib/logger";
import type { IngestResponse, ParsedDocument } from "@/types";

const IngestBodySchema = z.object({
  filename: z.string().min(1),
  kind: z.enum(["resume", "job"]),
  content: z.string().min(1), // base64
  mimeType: z.string().min(1),
  customTitle: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = IngestBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { filename, kind, content, mimeType, customTitle } = parsed.data;

    // Decode base64
    const buffer = Buffer.from(content, "base64");

    // Parse text content from the file
    const rawText = await parseDocument(buffer, mimeType, filename);

    if (rawText.trim().length < 50) {
      return NextResponse.json(
        { error: "Document appears to be empty or unreadable" },
        { status: 422 }
      );
    }

    // Extract metadata
    const jobMeta = kind === "job" ? extractJobMeta(rawText) : {};
    const title = customTitle ?? jobMeta.title ?? filename;

    const doc: ParsedDocument = {
      id: uuidv4(),
      kind,
      filename,
      rawText,
      title,
      company: jobMeta.company,
      uploadedAt: new Date().toISOString(),
    };

    // Chunk the document
    const chunks = buildChunks(doc);
    logger.info("document chunked", {
      documentId: doc.id,
      chunkCount: chunks.length,
    });

    // Embed all chunks
    const texts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(texts);

    const chunksWithEmbeddings = chunks.map((c, i) => ({
      ...c,
      embedding: embeddings[i],
    }));

    // Store in vector DB
    getVectorStore().upsert(chunksWithEmbeddings);

    // Register document metadata
    getDocumentRegistry().add(doc);

    const response: IngestResponse = {
      document: {
        id: doc.id,
        kind: doc.kind,
        filename: doc.filename,
        title: doc.title,
        company: doc.company,
        uploadedAt: doc.uploadedAt,
      },
      chunksCreated: chunks.length,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    logger.error("ingest error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Ingestion failed", details: String(err) },
      { status: 500 }
    );
  }
}

// GET /api/ingest — return all registered documents (metadata only)
export async function GET() {
  const docs = getDocumentRegistry().getAllMeta();
  return NextResponse.json({ documents: docs });
}

// DELETE /api/ingest?id=xxx — remove a document and its chunks
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  getVectorStore().deleteByDocumentId(id);
  getDocumentRegistry().delete(id);

  logger.info("document deleted", { id });
  return NextResponse.json({ deleted: id });
}
