import type { ReportCardKindKey, ReportCardStatusKey } from "@repo/types";

/**
 * Report-card display helpers (M7). Presentation only — labels + a status badge.
 * All authority (permissions, lifecycle, scope) lives in the service; these are
 * pure view utilities shared by the list and detail pages.
 */

export const KIND_LABEL: Record<ReportCardKindKey, string> = {
  EXAM: "Exam",
  TERM: "Term",
  ANNUAL: "Annual",
};

export const STATUS_LABEL: Record<ReportCardStatusKey, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  SUPERSEDED: "Superseded",
  REVOKED: "Revoked",
};

const STATUS_TONE: Record<ReportCardStatusKey, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-accent text-foreground",
  APPROVED: "bg-accent text-foreground",
  PUBLISHED: "bg-primary/15 text-primary",
  SUPERSEDED: "bg-muted text-muted-foreground",
  REVOKED: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: ReportCardStatusKey }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Two cards share a scope iff same kind + same exam + same term (the version-chain key). */
export function sameScope(
  a: { kind: ReportCardKindKey; examId: string | null; termId: string | null },
  b: { kind: ReportCardKindKey; examId: string | null; termId: string | null },
): boolean {
  return a.kind === b.kind && a.examId === b.examId && a.termId === b.termId;
}
