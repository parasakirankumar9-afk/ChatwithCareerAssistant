"use client";

import { useState } from "react";
import { FileText, Briefcase, Plus, AlertCircle, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { FileUploadZone } from "./FileUploadZone";
import { DocumentCard } from "./DocumentCard";
import type { ParsedDocument, DocumentKind } from "@/types";

type DocMeta = Omit<ParsedDocument, "rawText">;

interface IngestionEntry {
  status: "ingesting" | "ready" | "error";
  errorMessage?: string;
}

interface IngestionState {
  [filename: string]: IngestionEntry;
}

interface SidebarProps {
  documents: DocMeta[];
  ingestionStates: IngestionState;
  onFilesSelected: (files: File[], kind: DocumentKind) => void;
  onDeleteDocument: (id: string) => void;
}

export function Sidebar({
  documents,
  ingestionStates,
  onFilesSelected,
  onDeleteDocument,
}: SidebarProps) {
  const [showJobUpload, setShowJobUpload] = useState(false);

  const resume = documents.find((d) => d.kind === "resume");
  const jobs = documents.filter((d) => d.kind === "job");

  // Derive error entries from ingestionStates (files that failed and aren't in documents)
  const resumeErrors = Object.entries(ingestionStates).filter(
    ([fname, e]) =>
      e.status === "error" &&
      !documents.find((d) => d.filename === fname && d.kind === "resume")
  );
  const jobErrors = Object.entries(ingestionStates).filter(
    ([fname, e]) =>
      e.status === "error" &&
      !documents.find((d) => d.filename === fname && d.kind === "job") &&
      !documents.find((d) => d.filename === fname && d.kind === "resume")
  );
  const hasResumeError = resumeErrors.length > 0;

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col gap-0 h-full border-r border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--ink-900)] flex items-center justify-center">
            <span className="text-xs font-semibold text-[var(--gold-300)] font-display tracking-tight">
              CI
            </span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              Career Intel
            </h1>
            <p className="text-xs text-[var(--text-muted)]">AI Career Assistant</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Resume section */}
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-5 h-5 rounded bg-[var(--sage-100)] flex items-center justify-center">
              <FileText size={11} className="text-[var(--sage-500)]" />
            </div>
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Resume
            </h2>
          </div>

          {resume ? (
            <DocumentCard
              doc={resume}
              onDelete={onDeleteDocument}
              status={ingestionStates[resume.filename]?.status ?? "ready"}
            />
          ) : (
            <div className="space-y-2">
              <FileUploadZone
                kind="resume"
                onFilesSelected={(files) => onFilesSelected(files, "resume")}
                accept=".pdf,.txt,.md"
              />
              {/* Error cards for failed resume uploads */}
              {resumeErrors.map(([fname, entry]) => (
                <div
                  key={fname}
                  className="rounded-lg border border-red-200 bg-[var(--red-bg)] p-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle size={13} className="text-[var(--red-soft)] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--red-soft)] truncate">{fname}</p>
                      <p className="text-xs text-[var(--red-soft)] opacity-80 mt-0.5 leading-snug">
                        {entry.errorMessage ?? "Failed to process"}
                      </p>
                      <button
                        onClick={() => onFilesSelected([], "resume")}
                        className="mt-1.5 flex items-center gap-1 text-xs text-[var(--red-soft)] hover:opacity-70 transition-opacity"
                      >
                        <RefreshCw size={10} /> Try again
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {/* Ingesting indicator */}
              {Object.entries(ingestionStates)
                .filter(([, e]) => e.status === "ingesting")
                .map(([fname]) => (
                  <div key={fname} className="mt-2 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                    <span className="animate-pulse-subtle">Processing {fname}…</span>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Job Descriptions section */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-[var(--gold-100)] flex items-center justify-center">
                <Briefcase size={11} className="text-[var(--gold-400)]" />
              </div>
              <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Jobs
                {jobs.length > 0 && (
                  <span className="ml-1.5 text-[var(--text-muted)] normal-case font-normal">
                    ({jobs.length})
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={() => setShowJobUpload((v) => !v)}
              className={clsx(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
                "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--ink-100)]"
              )}
            >
              <Plus size={11} />
              Add
            </button>
          </div>

          {/* Job upload zone — show when no jobs yet, or Add clicked, or there are errors */}
          {(showJobUpload || jobs.length === 0 || jobErrors.length > 0) && (
            <div className="mb-3">
              <FileUploadZone
                kind="job"
                onFilesSelected={(files) => {
                  onFilesSelected(files, "job");
                  setShowJobUpload(false);
                }}
                accept=".pdf,.txt,.md"
                multiple
              />
            </div>
          )}

          {/* Error cards for failed job uploads */}
          {jobErrors.map(([fname, entry]) => (
            <div
              key={fname}
              className="mb-2 rounded-lg border border-red-200 bg-[var(--red-bg)] p-3"
            >
              <div className="flex items-start gap-2">
                <AlertCircle size={13} className="text-[var(--red-soft)] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--red-soft)] truncate">{fname}</p>
                  <p className="text-xs text-[var(--red-soft)] opacity-80 mt-0.5 leading-snug">
                    {entry.errorMessage ?? "Failed to process"}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Job cards */}
          {jobs.length > 0 && (
            <div className="space-y-2">
              {jobs.map((job) => (
                <DocumentCard
                  key={job.id}
                  doc={job}
                  onDelete={onDeleteDocument}
                  status={ingestionStates[job.filename]?.status ?? "ready"}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Documents are processed locally and never stored permanently.
        </p>
      </div>
    </aside>
  );
}
