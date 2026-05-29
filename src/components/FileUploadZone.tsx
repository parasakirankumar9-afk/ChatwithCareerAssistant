"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { UploadCloud, ClipboardType, ArrowRight, X } from "lucide-react";
import clsx from "clsx";
import type { DocumentKind } from "@/types";

interface FileUploadZoneProps {
  kind: DocumentKind;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
}

type Mode = "file" | "paste";

const PLACEHOLDER: Record<DocumentKind, string> = {
  resume:
    "Paste your resume text here…\n\nTip: Copy everything from your PDF/Word doc and paste it directly.",
  job: "Paste the job description here…\n\nTip: Copy the full job posting from LinkedIn, company website, etc.",
};

const FILENAME: Record<DocumentKind, string> = {
  resume: "pasted-resume.txt",
  job: "pasted-job-description.txt",
};

export function FileUploadZone({
  kind,
  onFilesSelected,
  disabled = false,
  accept = ".pdf,.txt,.md",
  multiple = false,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<Mode>("file");
  const [pastedText, setPastedText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── File mode handlers ─────────────────────────────────── */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || mode !== "file") return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && mode === "file") setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFilesSelected(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  /* ── Paste mode handler ─────────────────────────────────── */
  const handleSubmitText = () => {
    const trimmed = pastedText.trim();
    if (!trimmed) return;
    // Convert the pasted text into a plain-text File object
    const file = new File([trimmed], FILENAME[kind], { type: "text/plain" });
    onFilesSelected([file]);
    setPastedText("");
    setMode("file");
  };

  const label =
    kind === "resume"
      ? { title: "Upload Resume", hint: "PDF, TXT, or paste text" }
      : { title: "Add Job Description", hint: "PDF, TXT, or paste text" };

  /* ── Mode toggle tab bar ────────────────────────────────── */
  const TabBar = (
    <div className="flex rounded-lg overflow-hidden border border-[var(--border)] mb-3">
      {(["file", "paste"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          disabled={disabled}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors",
            mode === m
              ? "bg-[var(--gold-400)] text-white"
              : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
        >
          {m === "file" ? <UploadCloud size={13} /> : <ClipboardType size={13} />}
          {m === "file" ? "Upload file" : "Paste text"}
        </button>
      ))}
    </div>
  );

  /* ── Paste mode UI ──────────────────────────────────────── */
  if (mode === "paste") {
    return (
      <div className="flex flex-col gap-2">
        {TabBar}
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          disabled={disabled}
          placeholder={PLACEHOLDER[kind]}
          rows={7}
          className={clsx(
            "w-full resize-none rounded-xl border border-[var(--border)]",
            "bg-[var(--surface)] text-[var(--text-primary)] text-xs leading-relaxed",
            "p-3 placeholder:text-[var(--text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--gold-400)] focus:border-transparent",
            "transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setPastedText(""); setMode("file"); }}
            disabled={disabled}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X size={12} /> Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitText}
            disabled={disabled || !pastedText.trim()}
            className={clsx(
              "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
              "bg-[var(--gold-400)] text-white transition-all",
              "hover:bg-[var(--gold-500)] active:scale-95",
              (disabled || !pastedText.trim()) && "opacity-40 cursor-not-allowed"
            )}
          >
            Ingest text <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  /* ── File mode UI (original drop zone) ─────────────────── */
  return (
    <div className="flex flex-col gap-2">
      {TabBar}
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          "relative flex flex-col items-center justify-center gap-2",
          "border-2 border-dashed rounded-xl p-5 cursor-pointer",
          "transition-all duration-200 select-none",
          isDragging
            ? "border-[var(--gold-400)] bg-[var(--gold-50)] scale-[1.01]"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold-300)] hover:bg-[var(--gold-50)]",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label.title} drop zone`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <UploadCloud
          size={22}
          className={clsx(
            "transition-colors",
            isDragging ? "text-[var(--gold-400)]" : "text-[var(--text-muted)]"
          )}
        />
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {isDragging ? "Drop to upload" : label.title}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{label.hint}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
