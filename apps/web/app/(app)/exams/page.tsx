"use client";

import { Exam, GraduationCap, Info, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { ExamDto, ExamTypeKey } from "@repo/types";
import { cn } from "@repo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EXAM_TYPE_LABEL, EXAM_TYPES } from "@/src/components/exam/ui";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Select,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

type ExamFormValues = {
  name: string;
  type: ExamTypeKey;
  startDate: string | null;
  endDate: string | null;
  gradeScaleId: string | null;
  publishNow: boolean;
};

/** Today as YYYY-MM-DD in school time. */
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", opts);

/** "2026-07-20".."2026-07-24" → "20 – 24 Jul 2026". */
function fmtRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) {
    if (start === end) return fmt(start, { day: "numeric", month: "short", year: "numeric" });
    return start.slice(0, 7) === end.slice(0, 7)
      ? `${Number(start.slice(8, 10))} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`
      : `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  const one = (start ?? end)!;
  return fmt(one, { day: "numeric", month: "short", year: "numeric" });
}

/** Timing subline: in progress / starts in N days / ended. */
function timing(exam: ExamDto): { label: string; live: boolean } | null {
  const today = todayIso();
  const { startDate, endDate } = exam;
  if (startDate && startDate <= today && (!endDate || today <= endDate)) {
    return {
      label: endDate
        ? today === endDate
          ? "In progress — ends today"
          : `In progress — ends ${fmt(endDate, { weekday: "short" })}`
        : "In progress",
      live: true,
    };
  }
  if (startDate && startDate > today) {
    const days = Math.round(
      (new Date(startDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
        86_400_000,
    );
    return { label: days === 1 ? "Starts tomorrow" : `Starts in ${days} days`, live: false };
  }
  if (endDate && endDate < today) {
    return { label: `Ended ${fmt(endDate, { day: "numeric", month: "short" })}`, live: false };
  }
  return null;
}

/**
 * Exam dashboard (M5, ADR-012; design handoff §3). Lists a year's exams with
 * contextual row actions — published exams lead with "Enter marks", drafts with
 * "Publish" (the R3 locked-vs-total confirm; parents never see partial) plus
 * edit/delete. The modal uses the handoff type chip grid, grade-scale picker and
 * a publish-immediately toggle (create only — it chains the publish mutation).
 */
export default function ExamsDashboardPage() {
  const { show } = useToast();
  const router = useRouter();
  // A teacher (marks:enter, no exam:manage) has no management console — send them
  // to their marks-entry surface so /exams isn't a dead end (BUG-4).
  const me = trpc.auth.me.useQuery();
  const meRole = me.data?.role;
  const redirectToMarks =
    meRole !== undefined &&
    !can(meRole, PERMISSIONS.EXAM_MANAGE) &&
    can(meRole, PERMISSIONS.MARK_ENTER);
  useEffect(() => {
    if (redirectToMarks) router.replace("/exams/marks");
  }, [redirectToMarks, router]);

  const years = trpc.academicYear.list.useQuery(undefined, { enabled: !redirectToMarks });
  const scales = trpc.gradeScale.list.useQuery(undefined, { enabled: !redirectToMarks });
  const [yearId, setYearId] = useState("");
  // Default to the active year once loaded.
  useEffect(() => {
    if (yearId === "" && years.data) {
      const active = years.data.find((y) => y.status === "ACTIVE") ?? years.data[0];
      if (active) setYearId(active.id);
    }
  }, [years.data, yearId]);

  const exams = trpc.exam.list.useQuery({ academicYearId: yearId }, { enabled: yearId !== "" });
  const utils = trpc.useUtils();
  const invalidate = () => utils.exam.list.invalidate();

  const publish = trpc.exam.publish.useMutation({
    onSuccess: () => {
      void invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const create = trpc.exam.create.useMutation({
    onError: (e) => show("error", e.message),
  });
  const update = trpc.exam.update.useMutation({
    onSuccess: () => {
      void invalidate();
      show("success", "Changes saved");
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.exam.delete.useMutation({
    onSuccess: () => {
      void invalidate();
      show("success", "Exam deleted");
    },
    onError: (e) => show("error", e.message),
  });

  const [editing, setEditing] = useState<ExamDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<ExamDto | null>(null);
  const [publishing, setPublishing] = useState<ExamDto | null>(null);

  const rows = [...(exams.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <section className="flex flex-col gap-3.5">
      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[170px]">
          <Select label="Academic year" value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {(years.data ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.status === "ACTIVE" ? " (active)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1" />
        <Button
          size="sm"
          icon={Plus}
          disabled={yearId === ""}
          onClick={() => {
            create.reset();
            update.reset();
            setEditing("new");
          }}
        >
          New exam
        </Button>
      </div>

      {/* Exam table card */}
      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1.5fr_0.9fr_1.4fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Exam</span>
          <span>Type</span>
          <span>Dates</span>
          <span>Status</span>
          <span className="w-[170px] text-right">Actions</span>
        </div>
        {exams.isLoading || yearId === "" ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : exams.isError ? (
          <ErrorState onRetry={() => void exams.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No exams for this year yet."
            message="Create the first exam — assessments and marks registers hang off it."
            action={
              <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                New exam
              </Button>
            }
          />
        ) : (
          rows.map((exam) => {
            const t = timing(exam);
            return (
              <div
                key={exam.id}
                className="grid grid-cols-[1.5fr_0.9fr_1.4fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-[15px] transition-colors duration-fast last:border-0 hover:bg-cream-50"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-[11px]",
                      t?.live ? "bg-gold-100 text-gold-700" : "bg-maroon-50 text-maroon-700",
                    )}
                  >
                    <Exam aria-hidden size={18} weight={t?.live ? "bold" : "regular"} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-px">
                    <Link
                      href={`/exams/${exam.id}`}
                      className="truncate text-[14.5px] font-semibold text-ink-900 hover:text-maroon-700"
                    >
                      {exam.name}
                    </Link>
                    {t ? (
                      <span
                        className={cn(
                          "text-caption",
                          t.live ? "font-semibold text-gold-700" : "text-ink-400",
                        )}
                      >
                        {t.label}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span>
                  <StatusChip tone="neutral" label={EXAM_TYPE_LABEL[exam.type]} />
                </span>
                <span className="text-[13.5px] text-ink-500">
                  {fmtRange(exam.startDate, exam.endDate)}
                </span>
                <span>
                  <StatusChip
                    status={exam.isPublished ? "PUBLISHED" : "DRAFT"}
                    dot={exam.isPublished}
                  />
                </span>
                <span className="flex w-[170px] items-center justify-end gap-1.5">
                  {exam.isPublished ? (
                    <Link
                      href={`/exams/${exam.id}`}
                      className="whitespace-nowrap rounded-full bg-maroon-700 px-3.5 py-[7px] text-[12.5px] font-semibold text-cream-50 transition-colors duration-fast hover:bg-maroon-800"
                    >
                      Enter marks
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setPublishing(exam)}
                        className="cursor-pointer whitespace-nowrap rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
                      >
                        Publish
                      </button>
                      <IconButton
                        label="Edit"
                        icon={PencilSimple}
                        onClick={() => {
                          create.reset();
                          update.reset();
                          setEditing(exam);
                        }}
                      />
                      <IconButton
                        label="Delete"
                        tone="danger"
                        icon={Trash}
                        onClick={() => {
                          remove.reset();
                          setDeleting(exam);
                        }}
                      />
                    </>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
        <Info aria-hidden size={15} />
        Published exams appear on the school calendar and in parent notifications automatically.
      </p>

      {editing !== null && yearId !== "" ? (
        <ExamFormModal
          exam={editing === "new" ? null : editing}
          scales={(scales.data ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            isDefault: s.isDefault,
          }))}
          busy={create.isPending || update.isPending || publish.isPending}
          error={create.error?.message ?? update.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            if (editing === "new") {
              create.mutate(
                {
                  academicYearId: yearId,
                  name: values.name,
                  type: values.type,
                  ...(values.startDate ? { startDate: values.startDate } : {}),
                  ...(values.endDate ? { endDate: values.endDate } : {}),
                  ...(values.gradeScaleId ? { gradeScaleId: values.gradeScaleId } : {}),
                },
                {
                  onSuccess: (created) => {
                    setEditing(null);
                    if (values.publishNow && created?.id) {
                      publish.mutate(
                        { examId: created.id },
                        { onSuccess: () => show("success", "Exam saved and published") },
                      );
                    } else {
                      void invalidate();
                      show("success", "Exam saved as draft");
                    }
                  },
                },
              );
            } else {
              update.mutate(
                {
                  examId: editing.id,
                  name: values.name,
                  type: values.type,
                  startDate: values.startDate,
                  endDate: values.endDate,
                  gradeScaleId: values.gradeScaleId,
                },
                { onSuccess: () => setEditing(null) },
              );
            }
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDeleteExam
          exam={deleting}
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate({ examId: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}

      {publishing !== null ? (
        <PublishModal
          exam={publishing}
          onClose={() => setPublishing(null)}
          onPublished={invalidate}
        />
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------------- Exam modal */

function ExamFormModal({
  exam,
  scales,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  exam: ExamDto | null;
  scales: readonly { id: string; name: string; isDefault: boolean }[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ExamFormValues) => void;
}) {
  const [name, setName] = useState(exam?.name ?? "");
  const [type, setType] = useState<ExamTypeKey>(exam?.type ?? "UNIT_TEST");
  const [startDate, setStartDate] = useState(exam?.startDate ?? "");
  const [endDate, setEndDate] = useState(exam?.endDate ?? "");
  const [gradeScaleId, setGradeScaleId] = useState(exam?.gradeScaleId ?? "");
  const [publishNow, setPublishNow] = useState(false);
  const defaultScale = scales.find((s) => s.isDefault);

  return (
    <Dialog title={exam ? "Edit exam" : "New exam"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: name.trim(),
            type,
            startDate: startDate || null,
            endDate: endDate || null,
            gradeScaleId: gradeScaleId || null,
            publishNow,
          });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Half Yearly Examination"
          required
        />

        {/* Type chip grid (design handoff §Choice pills) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXAM_TYPES.map((t) => {
              const selected = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(t)}
                  className={cn(
                    "cursor-pointer whitespace-nowrap rounded-[11px] border px-1.5 py-2.5 text-[12.5px] font-semibold transition-colors duration-fast",
                    selected
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  {EXAM_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <Select
          label="Grade scale"
          value={gradeScaleId}
          onChange={(e) => setGradeScaleId(e.target.value)}
          helper={defaultScale ? `${defaultScale.name} is the school default.` : undefined}
        >
          <option value="">
            {defaultScale ? `${defaultScale.name} (default)` : "School default"}
          </option>
          {scales
            .filter((s) => !s.isDefault)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>

        {/* Publish immediately — create only; chains the publish mutation. */}
        {exam === null ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-cream-50 px-3.5 py-3">
            <span className="flex flex-col gap-px">
              <span className="text-[13.5px] font-semibold text-ink-900">Publish immediately</span>
              <span className="text-caption text-ink-500">
                Parents and teachers see it on the calendar right away.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={publishNow}
              aria-label="Publish immediately"
              onClick={() => setPublishNow((v) => !v)}
              className={cn(
                "relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-[13px] transition-colors duration-base",
                publishNow ? "bg-green-600" : "bg-sand-400",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white shadow transition-[left] duration-base",
                  publishNow ? "left-[23px]" : "left-[3px]",
                )}
              />
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save exam
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------- Delete confirm */

function ConfirmDeleteExam({
  exam,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  exam: ExamDto;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog title="Delete exam?" onClose={onCancel} size="sm">
      <p className="text-sm text-ink-500">
        Permanently delete <span className="font-semibold text-ink-900">{exam.name}</span>? An exam
        with assessments or marks cannot be deleted.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2.5">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" loading={busy} onClick={onConfirm}>
          Delete exam
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * Publish confirm — surfaces the R3 locked-vs-total count so publishing an
 * incomplete exam is an explicit choice (only LOCKED registers become visible to
 * parents; the rest stay hidden).
 */
function PublishModal({
  exam,
  onClose,
  onPublished,
}: {
  exam: ExamDto;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { show } = useToast();
  const registers = trpc.exam.registers.useQuery({ examId: exam.id });
  const publish = trpc.exam.publish.useMutation({
    onSuccess: () => {
      show("success", "Exam published");
      onPublished();
      onClose();
    },
    onError: (e) => show("error", e.message),
  });

  const total = registers.data?.length ?? 0;
  const locked = (registers.data ?? []).filter((r) => r.status === "LOCKED").length;
  const unlocked = total - locked;

  return (
    <Dialog title={`Publish “${exam.name}”`} onClose={onClose}>
      {registers.isLoading ? (
        <p className="text-sm text-ink-500">Loading registers…</p>
      ) : total === 0 ? (
        <p className="mb-4 text-sm text-ink-500">
          No registers have been started — parents will see no marks for this exam. Publishing is
          permanent for this exam.
        </p>
      ) : (
        <p className="mb-4 text-sm text-ink-500">
          {locked} of {total} register{total === 1 ? "" : "s"} locked.{" "}
          {unlocked > 0
            ? `${unlocked} not yet locked won’t be visible to parents.`
            : "All locked registers become visible to parents."}{" "}
          Publishing is permanent for this exam.
        </p>
      )}
      {publish.error ? <p className="mb-3 text-sm text-red-600">{publish.error.message}</p> : null}
      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          loading={publish.isPending}
          disabled={registers.isLoading}
          onClick={() => publish.mutate({ examId: exam.id })}
        >
          Publish
        </Button>
      </div>
    </Dialog>
  );
}
