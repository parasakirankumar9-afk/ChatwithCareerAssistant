"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, User, Sparkles, AlertCircle } from "lucide-react";
import clsx from "clsx";
import type { ChatMessage, Citation } from "@/types";

interface ChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessageBubble({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [showCitations, setShowCitations] = useState(false);

  return (
    <div
      className={clsx(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5",
          isUser
            ? "bg-[var(--ink-800)] text-[var(--ink-50)]"
            : "bg-[var(--gold-100)] text-[var(--gold-400)] border border-[var(--gold-300)]"
        )}
      >
        {isUser ? <User size={14} /> : <Sparkles size={14} />}
      </div>

      <div
        className={clsx(
          "flex flex-col max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Bubble */}
        <div
          className={clsx(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-[var(--ink-900)] text-[var(--ink-50)] rounded-tr-sm"
              : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm shadow-sm"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-response">
              <MarkdownContent content={message.content} />
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-[var(--gold-400)] ml-0.5 animate-pulse-subtle rounded-sm" />
              )}
            </div>
          )}
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-2 w-full max-w-full">
            <button
              onClick={() => setShowCitations((v) => !v)}
              className={clsx(
                "flex items-center gap-1.5 text-xs text-[var(--text-muted)]",
                "hover:text-[var(--text-secondary)] transition-colors"
              )}
            >
              {showCitations ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
              {message.citations.length} source
              {message.citations.length !== 1 ? "s" : ""} referenced
            </button>

            {showCitations && (
              <div className="mt-2 flex flex-col gap-1.5">
                {message.citations.map((c, i) => (
                  <CitationTag key={i} citation={c} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <time className="text-xs text-[var(--text-muted)] mt-1.5 px-1">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}

function CitationTag({ citation }: { citation: Citation }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--ink-50)] p-2.5">
      <p className="text-xs font-medium text-[var(--gold-500,#c98a0c)] mb-1">
        {citation.sourceLabel}
      </p>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
        {citation.snippet}
      </p>
    </div>
  );
}

/**
 * Minimal markdown renderer — no heavy library dependency.
 * Handles: bold, italic, bullet lists, numbered lists, code, headers.
 */
function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-[var(--ink-900)]">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-semibold mt-3 mb-1 font-display">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Bullet list
    if (line.match(/^[-*•]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s/)) {
        items.push(lines[i].replace(/^[-*•]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc pl-4 my-2 space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="text-sm">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal pl-4 my-2 space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="text-sm">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm mb-2 last:mb-0">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  // Handle bold **text** and *italic* and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="text-xs bg-[var(--ink-100)] px-1 py-0.5 rounded font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// Loading skeleton for streaming state
export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

// Error message
export function ChatErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-red-100 text-[var(--red-soft)] flex items-center justify-center flex-shrink-0">
        <AlertCircle size={14} />
      </div>
      <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <p className="text-sm text-[var(--red-soft)]">{message}</p>
      </div>
    </div>
  );
}
