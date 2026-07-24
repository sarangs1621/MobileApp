"use client";

import { CaretLeft, Exam, GraduationCap } from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { MarkableAssessmentDto } from "@repo/types";
import { cn } from "@repo/ui";
import { useState } from "react";

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/** Register status → human label (mobile parity: NONE reads "Not started"). */
const statusLabel = (s: MarkableAssessmentDto["registerStatus"]) =>
  s === "NONE" ? "Not started" : s;

/**
 * Teacher marks-entry surface (BUG-4, web parity with the mobile M5 flow). The
 * admin Examinations console (EXAM_MANAGE) lives at /exams; teachers hold
 * marks:enter scoped to their own subject×section and land here. Master/detail:
 * pick a markable (assessment × section) register, then enter theory/practical
 * per student, Save (draft) and Submit for admin review. Reuses the same tRPC
 * procedures as mobile (mark.markable / enrollment.sectionRoster /
 * mark.listByRegister / mark.save / mark.submit). Authorization + the
 * DRAFT→SUBMITTED lifecycle are enforced by the business layer — this is UX.
 */
export default function EnterMarksPage() {
  const me = trpc.auth.me.useQuery();
  const [selected, setSelected] = useState<{ assessmentId: string; sectionId: string } | null>(
    null,
  );

  const markable = trpc.mark.markable.useQuery(undefined, {
    enabled: me.data?.status === "ACTIVE",
  });
  const years = trpc.academicYear.list.useQuery(undefined, {
    enabled: me.data?.status === "ACTIVE",
  });
  const activeYearId = (years.data ?? []).find((y) => y.status === "ACTIVE")?.id;

  if (me.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-24 w-2/3" />
        <Skeleton className="h-96 rounded-card" />
      </Shell>
    );
  }

  const role = me.data?.role;
  if (
    me.isError ||
    me.data?.status !== "ACTIVE" ||
    role === undefined ||
    !can(role, PERMISSIONS.MARK_ENTER)
  ) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center p-6">
        <p className="text-center text-sm text-ink-500">
          You don’t have access to mark entry. Please contact the school office.
        </p>
      </main>
    );
  }

  // Derive the live target from the list so a save that creates the register
  // (NONE → DRAFT) immediately surfaces Submit (mobile parity).
  const target =
    selected === null
      ? undefined
      : (markable.data ?? []).find(
          (m) => m.assessmentId === selected.assessmentId && m.sectionId === selected.sectionId,
        );

  if (selected !== null && target !== undefined) {
    return (
      <Shell>
        <MarkEntry target={target} activeYearId={activeYearId} onBack={() => setSelected(null)} />
      </Shell>
    );
  }

  const rows = markable.data ?? [];
  return (
    <Shell>
      <PageHeader
        eyebrow="Examinations"
        title="Enter marks"
        subtitle="Your assigned assessments for the active year — select one to enter and submit marks."
      />
      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        {markable.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : markable.isError ? (
          <ErrorState onRetry={() => void markable.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No assessments yet"
            message="No assessments are assigned to you in the active year yet."
          />
        ) : (
          rows.map((a) => (
            <button
              key={`${a.assessmentId}:${a.sectionId}`}
              type="button"
              onClick={() => setSelected({ assessmentId: a.assessmentId, sectionId: a.sectionId })}
              className="flex w-full items-center gap-3.5 border-b border-cream-100 px-5 py-4 text-left transition-colors duration-fast last:border-0 hover:bg-cream-50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-maroon-50 text-maroon-700">
                <Exam aria-hidden size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-[14.5px] font-semibold text-ink-900">
                  {a.examName} · {a.subjectName}
                </span>
                <span className="text-[12.5px] text-ink-500">Section {a.sectionName}</span>
              </span>
              {a.registerStatus === "NONE" ? (
                <StatusChip tone="neutral" label="Not started" />
              ) : (
                <StatusChip status={a.registerStatus} />
              )}
            </button>
          ))
        )}
      </div>
    </Shell>
  );
}

/** Page chrome — /exams/marks renders outside the admin console layout. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[1180px] animate-fade-up flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
      {children}
    </main>
  );
}

type Entry = { theory: string; practical: string; isAbsent: boolean };
const blank: Entry = { theory: "", practical: "", isAbsent: false };
const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Mark-entry grid for one (assessment × section) register. Draft-only: per-student
 * theory/practical inputs + an Absent toggle; Save upserts (creating the register
 * on first save), Submit hands it to admin review. A SUBMITTED/LOCKED register is
 * read-only (corrections are an admin unlock).
 */
function MarkEntry({
  target,
  activeYearId,
  onBack,
}: {
  target: MarkableAssessmentDto;
  activeYearId: string | undefined;
  onBack: () => void;
}) {
  const { show } = useToast();
  const utils = trpc.useUtils();
  const [edits, setEdits] = useState<Record<string, Entry>>({});

  const roster = trpc.enrollment.sectionRoster.useQuery(
    { academicYearId: activeYearId ?? "", sectionId: target.sectionId },
    { enabled: activeYearId !== undefined && target.sectionId !== "" },
  );
  const existing = trpc.mark.listByRegister.useQuery(
    { examSectionId: target.examSectionId ?? "" },
    { enabled: target.examSectionId != null },
  );
  const existingByEnrollment = new Map((existing.data ?? []).map((m) => [m.enrollmentId, m]));

  const save = trpc.mark.save.useMutation({
    onSuccess: () => {
      setEdits({});
      show("success", "Marks saved");
      void utils.mark.markable.invalidate();
      void utils.mark.listByRegister.invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const submit = trpc.mark.submit.useMutation({
    onSuccess: () => {
      show("success", "Register submitted for review");
      void utils.mark.markable.invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const status = target.registerStatus;
  const editable = status === "NONE" || status === "DRAFT";
  const hasPractical = target.maxPractical != null;
  // Only active enrollments can take marks (the service rejects the rest).
  const rows = (roster.data ?? []).filter((e) => e.status === "ACTIVE");

  const current = (enrollmentId: string): Entry => {
    if (edits[enrollmentId]) return edits[enrollmentId];
    const m = existingByEnrollment.get(enrollmentId);
    if (!m) return blank;
    return {
      theory: m.theoryObtained != null ? String(m.theoryObtained) : "",
      practical: m.practicalObtained != null ? String(m.practicalObtained) : "",
      isAbsent: m.isAbsent,
    };
  };
  const setEntry = (enrollmentId: string, patch: Partial<Entry>) => {
    setEdits((prev) => ({ ...prev, [enrollmentId]: { ...current(enrollmentId), ...patch } }));
  };

  return (
    <section className="flex flex-col gap-3.5">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-[13px] font-semibold text-maroon-700 transition-colors duration-fast hover:text-maroon-800"
      >
        <CaretLeft aria-hidden size={15} weight="bold" />
        All assessments
      </button>

      <PageHeader
        eyebrow="Enter marks"
        title={`${target.examName} · ${target.subjectName}`}
        subtitle={`Section ${target.sectionName} · Max theory ${target.maxTheory}${
          hasPractical ? ` · practical ${target.maxPractical}` : " · theory only"
        }`}
        action={
          status === "NONE" ? (
            <StatusChip tone="neutral" label="Not started" />
          ) : (
            <StatusChip status={status} />
          )
        }
      />

      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5">
          <span className="font-display text-[17px] font-semibold text-ink-900">
            {target.sectionName} — marks register
          </span>
          {editable ? (
            <span className="text-[12.5px] text-ink-500">
              Enter marks per student; Save draft, then Submit for review
            </span>
          ) : (
            <span className="text-[12.5px] text-ink-500">
              This register is {statusLabel(status).toLowerCase()} — read-only
            </span>
          )}
        </div>

        {roster.isLoading || (target.examSectionId != null && existing.isLoading) ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : roster.isError ? (
          <ErrorState onRetry={() => void roster.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No active students in this section." />
        ) : (
          rows.map((e) => {
            const v = current(e.id);
            return (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-3.5 border-b border-cream-100 px-5 py-[11px] transition-colors duration-fast last:border-0 hover:bg-cream-50"
              >
                <span className="w-6 text-xs font-semibold text-ink-400">{e.rollNo ?? "—"}</span>
                <Avatar name={e.studentName} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
                  {e.studentName}
                </span>
                {editable ? (
                  <div className="flex items-center gap-2">
                    <MarkInput
                      label="Theory"
                      value={v.theory}
                      disabled={v.isAbsent}
                      onChange={(t) => setEntry(e.id, { theory: t })}
                    />
                    {hasPractical ? (
                      <MarkInput
                        label="Practical"
                        value={v.practical}
                        disabled={v.isAbsent}
                        onChange={(t) => setEntry(e.id, { practical: t })}
                      />
                    ) : null}
                    <button
                      type="button"
                      aria-pressed={v.isAbsent}
                      onClick={() => setEntry(e.id, { isAbsent: !v.isAbsent })}
                      className={cn(
                        "h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors duration-fast",
                        v.isAbsent
                          ? "border-red-600 bg-red-100 text-red-600"
                          : "border-subtle bg-white text-ink-400 hover:border-strong",
                      )}
                    >
                      Absent
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-ink-500">
                    {v.isAbsent
                      ? "Absent"
                      : `Theory ${v.theory || "—"}${hasPractical ? ` · Practical ${v.practical || "—"}` : ""}`}
                  </span>
                )}
              </div>
            );
          })
        )}

        {editable && rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2.5 bg-cream-50 px-5 py-3.5">
            {target.examSectionId != null && status === "DRAFT" ? (
              <Button
                variant="secondary"
                loading={submit.isPending}
                disabled={save.isPending}
                onClick={() => {
                  if (target.examSectionId != null) {
                    submit.mutate({ examSectionId: target.examSectionId });
                  }
                }}
              >
                Submit for review
              </Button>
            ) : null}
            <Button
              loading={save.isPending}
              onClick={() => {
                save.mutate({
                  assessmentId: target.assessmentId,
                  sectionId: target.sectionId,
                  marks: rows.map((e) => {
                    const v = current(e.id);
                    return {
                      enrollmentId: e.id,
                      isAbsent: v.isAbsent,
                      theoryObtained: v.isAbsent ? null : parseNum(v.theory),
                      practicalObtained: v.isAbsent || !hasPractical ? null : parseNum(v.practical),
                    };
                  }),
                });
              }}
            >
              Save draft
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** A single numeric mark cell (theory/practical). */
function MarkInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      placeholder={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-24 rounded-[10px] border border-subtle bg-white px-3 text-sm text-ink-900 outline-none focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100 disabled:cursor-not-allowed disabled:bg-cream-100 disabled:text-ink-400"
    />
  );
}
