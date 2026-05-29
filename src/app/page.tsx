"use client";

import { useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Sidebar } from "@/components/Sidebar";
import { ChatPanel } from "@/components/ChatPanel";
import type {
  ChatMessage,
  ParsedDocument,
  DocumentKind,
  Citation,
} from "@/types";

type DocMeta = Omit<ParsedDocument, "rawText">;
type IngestionStatus = "ingesting" | "ready" | "error";

interface IngestionEntry {
  status: IngestionStatus;
  errorMessage?: string;
}

interface IngestionState {
  [filename: string]: IngestionEntry;
}

export default function Home() {
  const [documents, setDocuments] = useState<DocMeta[]>([]);
  const [ingestionStates, setIngestionStates] = useState<IngestionState>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to update a single file's ingestion entry
  const setFileState = useCallback(
    (filename: string, entry: IngestionEntry) =>
      setIngestionStates((prev) => ({ ...prev, [filename]: entry })),
    []
  );

  // Track pending partial streaming message
  const streamingTextRef = useRef<string>("");

  // ─── Document ingestion ─────────────────────────────────

  const handleFilesSelected = useCallback(
    async (files: File[], kind: DocumentKind) => {
      for (const file of files) {
        // Clear any previous error for this file
        setFileState(file.name, { status: "ingesting" });

        // If resume, replace existing one
        if (kind === "resume") {
          const existing = documents.find((d) => d.kind === "resume");
          if (existing) {
            await deleteDocument(existing.id);
          }
        }

        try {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const res = await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              kind,
              content: base64,
              mimeType: file.type || "text/plain",
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? "Ingestion failed");
          }

          const data = await res.json();
          setDocuments((prev) => [...prev, data.document]);
          setFileState(file.name, { status: "ready" });
        } catch (err) {
          console.error("Ingestion error:", err);
          const message =
            err instanceof Error ? err.message : "Failed to process file";
          setFileState(file.name, { status: "error", errorMessage: message });
        }
      }
    },
    [documents, setFileState]
  );

  const deleteDocument = useCallback(async (id: string) => {
    try {
      await fetch(`/api/ingest?id=${id}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  }, []);

  // ─── Chat ────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const userText = input.trim();
    if (!userText || isLoading) return;

    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Prepare conversation history (last 10 messages for context window management)
    const history = [...messages, userMsg].slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          documentIds: documents.map((doc) => doc.id),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "Chat request failed");
      }

      if (!res.body) throw new Error("No response body");

      const assistantMsgId = uuidv4();
      streamingTextRef.current = "";
      setStreamingMessageId(assistantMsgId);

      // Create placeholder message for streaming
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ]);

      let citations: Citation[] = [];
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          let event: any;
          try {
            event = JSON.parse(jsonStr);
          } catch (parseErr) {
            // Non-fatal: malformed SSE line
            console.warn("SSE parse error:", parseErr);
            continue;
          }

          if (event.type === "meta") {
            citations = event.citations ?? [];
          } else if (event.type === "delta") {
            streamingTextRef.current += event.text;
            const current = streamingTextRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: current } : m
              )
            );
          } else if (event.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: event.fullText,
                      citations,
                      createdAt: new Date().toISOString(),
                    }
                  : m
              )
            );
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
      streamingTextRef.current = "";
    }
  }, [documents, input, isLoading, messages]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar
        documents={documents}
        ingestionStates={ingestionStates}
        onFilesSelected={handleFilesSelected}
        onDeleteDocument={deleteDocument}
      />
      <ChatPanel
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        streamingMessageId={streamingMessageId}
        error={error}
        documents={documents}
      />
    </div>
  );
}
