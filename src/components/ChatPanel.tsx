"use client";

import {
  useRef,
  useEffect,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import { Send, Sparkles } from "lucide-react";
import clsx from "clsx";
import {
  ChatMessageBubble,
  ChatMessageSkeleton,
  ChatErrorMessage,
} from "./ChatMessage";
import type { ChatMessage, ParsedDocument } from "@/types";
import { SUGGESTED_QUESTIONS } from "@/lib/rag/prompts";

type DocMeta = Omit<ParsedDocument, "rawText">;

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  streamingMessageId: string | null;
  error: string | null;
  documents: DocMeta[];
}

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  streamingMessageId,
  error,
  documents,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasDocuments = documents.length > 0;
  const isEmpty = messages.length === 0;

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) onSubmit();
    }
  };

  const canSubmit = !isLoading && input.trim().length > 0 && hasDocuments;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {isEmpty ? (
          <EmptyState
            hasDocuments={hasDocuments}
            onSuggestedQuestion={(q) => {
              onInputChange(q);
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
          />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                isStreaming={msg.id === streamingMessageId}
              />
            ))}
            {isLoading && !streamingMessageId && <ChatMessageSkeleton />}
            {error && <ChatErrorMessage message={error} />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        {!hasDocuments && (
          <p className="text-xs text-[var(--text-muted)] mb-2 text-center">
            Upload a resume and at least one job description to start chatting
          </p>
        )}
        <div
          className={clsx(
            "flex gap-3 items-end rounded-xl border px-4 py-2.5 transition-colors",
            "bg-[var(--surface-2)]",
            hasDocuments
              ? "border-[var(--border)] focus-within:border-[var(--gold-400)]"
              : "border-[var(--border)] opacity-60"
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasDocuments
                ? "Ask anything about your career fit…"
                : "Upload documents to begin"
            }
            disabled={!hasDocuments || isLoading}
            rows={1}
            className={clsx(
              "flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)]",
              "placeholder:text-[var(--text-muted)] focus:outline-none",
              "min-h-[1.5rem] max-h-[10rem] leading-relaxed"
            )}
          />
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={clsx(
              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              canSubmit
                ? "bg-[var(--ink-900)] text-[var(--ink-50)] hover:bg-[var(--ink-800)] shadow-sm"
                : "bg-[var(--ink-100)] text-[var(--text-muted)] cursor-not-allowed"
            )}
            aria-label="Send message"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2 text-right">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  hasDocuments,
  onSuggestedQuestion,
}: {
  hasDocuments: boolean;
  onSuggestedQuestion: (q: string) => void;
}) {
  const questions = SUGGESTED_QUESTIONS.slice(0, 6);

  return (
    <div className="h-full flex flex-col items-center justify-center py-12 px-4">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-[var(--gold-100)] border border-[var(--gold-300)] flex items-center justify-center mb-5 shadow-sm">
        <Sparkles size={22} className="text-[var(--gold-400)]" />
      </div>

      <h2 className="font-display text-xl font-medium text-[var(--text-primary)] mb-2 text-center">
        Career Intelligence Assistant
      </h2>
      <p className="text-sm text-[var(--text-muted)] text-center max-w-sm leading-relaxed mb-8">
        {hasDocuments
          ? "Your documents are ready. Ask me anything about your career fit, skill gaps, or interview preparation."
          : "Upload your resume and job descriptions on the left, then start asking questions."}
      </p>

      {hasDocuments && (
        <div className="w-full max-w-lg">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-center mb-3">
            Suggested questions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {questions.map((q) => (
              <button
                key={q}
                onClick={() => onSuggestedQuestion(q)}
                className={clsx(
                  "text-left text-xs px-3.5 py-2.5 rounded-lg border",
                  "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
                  "hover:border-[var(--gold-300)] hover:bg-[var(--gold-50)] hover:text-[var(--text-primary)]",
                  "transition-all duration-150"
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
