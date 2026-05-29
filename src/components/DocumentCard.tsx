"use client";

import { FileText, Briefcase, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { ParsedDocument } from "@/types";

type DocMeta = Omit<ParsedDocument, "rawText">;

interface DocumentCardProps {
  doc: DocMeta;
  onDelete: (id: string) => void;
  status?: "ingesting" | "ready" | "error";
  errorMessage?: string;
}

export function DocumentCard({
  doc,
  onDelete,
  status = "ready",
  errorMessage,
}: DocumentCardProps) {
  const isResume = doc.kind === "resume";

  return (
    <div
      className={clsx(
        "group relative rounded-lg border p-3 transition-all duration-200",
        status === "error"
          ? "border-red-200 bg-[var(--red-bg)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold-300)]"
      )}
    >
      {/* Delete button */}
      {status === "ready" && (
        <button
          onClick={() => onDelete(doc.id)}
          className={clsx(
            "absolute top-2 right-2 p-1 rounded",
            "text-[var(--text-muted)] hover:text-[var(--red-soft)]",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )}
          title="Remove document"
          aria-label={`Remove ${doc.title ?? doc.filename}`}
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div
          className={clsx(
            "mt-0.5 flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
            isResume
              ? "bg-[var(--sage-100)] text-[var(--sage-500)]"
              : "bg-[var(--gold-100)] text-[var(--gold-400)]"
          )}
        >
          {isResume ? <FileText size={13} /> : <Briefcase size={13} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate leading-tight">
            {doc.title ?? doc.filename}
          </p>
          {doc.company && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
              {doc.company}
            </p>
          )}
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
            {doc.filename}
          </p>
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-2 flex items-center gap-1.5">
        {status === "ingesting" && (
          <>
            <Loader2 size={11} className="animate-spin text-[var(--gold-400)]" />
            <span className="text-xs text-[var(--text-muted)]">
              Processing…
            </span>
          </>
        )}
        {status === "ready" && (
          <>
            <CheckCircle2 size={11} className="text-[var(--sage-500)]" />
            <span className="text-xs text-[var(--sage-500)]">Ready</span>
          </>
        )}
        {status === "error" && (
          <span className="text-xs text-[var(--red-soft)]">
            {errorMessage ?? "Failed to process"}
          </span>
        )}
      </div>
    </div>
  );
}
