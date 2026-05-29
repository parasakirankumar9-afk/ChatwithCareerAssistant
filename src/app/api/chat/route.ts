import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { embedText } from "@/lib/rag/embedder";
import { getVectorStore } from "@/lib/rag/vectorStore";
import { getDocumentRegistry } from "@/lib/rag/registry";
import {
  SYSTEM_PROMPT,
  buildContextBlock,
  buildUserTurnWithContext,
} from "@/lib/rag/prompts";
import { streamComplete } from "@/lib/rag/llm";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildDynamicQueryContext } from "@/lib/rag/queryContext";
import { v4 as uuidv4 } from "uuid";
import type { Citation, RetrievedChunk } from "@/types";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const ChatBodySchema = z.object({
  messages: z.array(MessageSchema).min(1),
  documentIds: z.array(z.string()).optional(),
});

/**
 * Balanced retrieval: always fetch chunks from BOTH resume and job docs.
 *
 * A naive single-query approach fails for alignment questions like
 * "how do I align?" because the query embedding matches resume text better,
 * starving the response of job description context.
 *
 * Strategy:
 *  1. Split registered docs into resume IDs and job IDs.
 *  2. Query each group separately with up to topK chunks each.
 *  3. Always anchor the first chunk (§1) of every document — this guarantees
 *     the resume professional summary and JD overview are always in context.
 *  4. Merge, de-duplicate, re-sort by score, cap at topK * 2.
 *  5. Fall back to a global query if only one doc type exists.
 */
function retrieveBalanced(
  queryEmbedding: number[],
  topK: number,
  minScore: number,
  scopeIds?: string[]
): RetrievedChunk[] {
  const registry = getDocumentRegistry();
  const allDocs = registry.getAllMeta();

  // If scoped to specific docs, use those; otherwise use all
  const activeDocs = scopeIds?.length
    ? allDocs.filter((d) => scopeIds.includes(d.id))
    : allDocs;

  const resumeIds = activeDocs.filter((d) => d.kind === "resume").map((d) => d.id);
  const jobIds = activeDocs.filter((d) => d.kind === "job").map((d) => d.id);
  const store = getVectorStore();

  // If we have both types, retrieve from each separately
  if (resumeIds.length > 0 && jobIds.length > 0) {
    const perTypeMinScore = Math.min(minScore, 0.1);

    // Semantic search: topK chunks from each doc type
    const resumeChunks = store.query(queryEmbedding, topK, perTypeMinScore, resumeIds);
    const jobChunks = store.query(queryEmbedding, topK, perTypeMinScore, jobIds);

    logger.info("balanced retrieval", {
      resumeChunks: resumeChunks.length,
      jobChunks: jobChunks.length,
    });

    const anchors = store.getFirstChunks([...resumeIds, ...jobIds]);

    // Merge, de-duplicate by id, re-sort by score, cap at topK * 2
    const seen = new Set<string>();
    const merged: RetrievedChunk[] = [];
    for (const chunk of [...anchors, ...resumeChunks, ...jobChunks]) {
      if (!seen.has(chunk.id)) {
        seen.add(chunk.id);
        merged.push(chunk);
      }
    }
    return merged.sort((a, b) => b.score - a.score).slice(0, topK * 2);
  }

  // Only one doc type — fall back to global query
  const activeIds = activeDocs.map((d) => d.id);
  const anchors = store.getFirstChunks(activeIds);
  const retrieved = store.query(queryEmbedding, topK, minScore, activeIds);
  const seen = new Set<string>();
  return [...anchors, ...retrieved].filter((chunk) => {
    if (seen.has(chunk.id)) return false;
    seen.add(chunk.id);
    return true;
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ChatBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { messages, documentIds } = parsed.data;
    const env = getEnv();

    // Check at least one document has been ingested
    const allDocs = getDocumentRegistry().getAllMeta();
    if (allDocs.length === 0) {
      return NextResponse.json(
        {
          error:
            "No documents have been uploaded yet. Please upload a resume and at least one job description.",
        },
        { status: 422 }
      );
    }

    // Retrieve the last user message for semantic search
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "No user message found" },
        { status: 400 }
      );
    }

    // Embed the query
    const queryEmbedding = await embedText(lastUserMessage.content);

    // Balanced retrieval — guarantees both resume & JD context when both exist
    const chunks: RetrievedChunk[] = retrieveBalanced(
      queryEmbedding,
      env.RETRIEVAL_TOP_K,
      env.RETRIEVAL_MIN_SCORE,
      documentIds?.length ? documentIds : undefined
    );

    logger.info("retrieved chunks for chat", {
      query: lastUserMessage.content.slice(0, 80),
      totalChunks: chunks.length,
      resumeChunks: chunks.filter((c) => c.documentKind === "resume").length,
      jobChunks: chunks.filter((c) => c.documentKind === "job").length,
    });

    // Build citations from retrieved chunks
    const citations: Citation[] = chunks.slice(0, 5).map((c) => ({
      sourceLabel: c.sourceLabel,
      snippet: c.text.slice(0, 200).replace(/\n/g, " ") + (c.text.length > 200 ? "..." : ""),
    }));

    const scopedDocs = getDocumentRegistry()
      .getAll()
      .filter((doc) =>
        documentIds?.length ? documentIds.includes(doc.id) : true
      );
    const dynamicQueryContext = buildDynamicQueryContext(
      scopedDocs,
      lastUserMessage.content
    );

    // Build context block and inject into last user turn
    const retrievalContextBlock = buildContextBlock(chunks);
    const contextBlock = `${dynamicQueryContext}\n\n---\n\n${retrievalContextBlock}`;
    const enrichedMessages = messages.map((m, idx) => {
      if (idx === messages.length - 1 && m.role === "user") {
        return {
          ...m,
          content: buildUserTurnWithContext(m.content, contextBlock),
        };
      }
      return m;
    });

    // Stream the response using Server-Sent Events
    const encoder = new TextEncoder();
    const messageId = uuidv4();
    const createdAt = new Date().toISOString();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First, send metadata (citations, chunks) as a special SSE event
          const meta = JSON.stringify({
            type: "meta",
            messageId,
            createdAt,
            citations,
            retrievedChunkCount: chunks.length,
          });
          controller.enqueue(encoder.encode(`data: ${meta}\n\n`));

          // Stream the LLM response
          let fullText = "";
          for await (const delta of streamComplete({
            system: SYSTEM_PROMPT,
            messages: enrichedMessages,
          })) {
            fullText += delta;
            const chunk = JSON.stringify({ type: "delta", text: delta });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }

          // Send done event
          const done = JSON.stringify({
            type: "done",
            messageId,
            fullText,
          });
          controller.enqueue(encoder.encode(`data: ${done}\n\n`));
          controller.close();
        } catch (err) {
          logger.error("stream error", {
            error: err instanceof Error ? err.message : String(err),
          });
          const message = err instanceof Error ? err.message : String(err);
          const isRateLimit =
            message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
          const errEvent = JSON.stringify({
            type: "error",
            error: isRateLimit
              ? "The model provider is rate-limiting requests right now. Please wait a minute and try again."
              : "An error occurred generating the response.",
          });
          controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    logger.error("chat error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Chat failed", details: String(err) },
      { status: 500 }
    );
  }
}
