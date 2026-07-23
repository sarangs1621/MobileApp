"use client";

import {
  ArrowLeft,
  Flask,
  GlobeHemisphereEast,
  ListNumbers,
  PencilLine,
  Plus,
  PlusMinus,
  TextAa,
  Translate,
  Trash,
  BookOpen,
  type Icon,
} from "@phosphor-icons/react";
import type { AssessmentDto, ExamRegisterDto } from "@repo/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ConfirmDelete,
  inputClass,
  labelClass,
  Modal,
  TableShell,
} from "@/src/components/academic/ui";
import { downloadCsv, SectionPicker } from "@/src/components/attendance/ui";
import { EXAM_TYPE_LABEL, REGISTER_STATUS_LABEL } from "@/src/components/exam/ui";
import { Button, IconButton, StatusChip, useToast } from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/** A picked (assessment × section) target for the marks grid. */
type Target = { assessmentId: string; sectionId: string };

/** Best-effort subject icon by name (design handoff §Subjects). */
function subjectIcon(name: string): Icon {
  const n = name.toLowerCase();
  if (/english/.test(n)) return TextAa;
  if (/gujarati|hindi|malayalam|sanskrit|language/.test(n)) return Translate;
  if (/math/.test(n)) return PlusMinus;
  if (/science|physics|chemistry|biology/.test(n)) return Flask;
  if (/social|history|geography|civics/.test(n)) return GlobeHemisphereEast;
  return BookOpen;
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", opts);

/** "2026-07-20".."2026-07-24" → "20 – 24 Jul 2026". */
function fmtRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) {
    if (start === end) return fmt(start, { day: "numeric", month: "short", year: "numeric" });
    return start.slice(0, 7) === end.slice(0, 7)
      ? `${Number(start.slice(8, 10))} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`
      : `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return fmt((start ?? end)!, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Exam detail (M5, ADR-012). Assessment CRUD, the register oversight list, and
 * the marks grid — admins can enter/save marks, then walk the register lifecycle
 * (submit → lock, or unlock a locked register with an audited reason). Teachers do
 * the day-to-day entry on mobile; this is the management + oversight side.
 */
export default function ExamDetailPage() {
  const examId = String(useParams().examId ?? "");
  const exam = trpc.exam.get.useQuery({ examId }, { enabled: examId !== "" });
  const assessments = trpc.assessment.list.useQuery({ examId }, { enabled: examId !== "" });
  const registers = trpc.exam.registers.useQuery({ examId }, { enabled: examId !== "" });
  const subjects = trpc.subject.list.useQuery();
  const scales = trpc.gradeScale.list.useQuery();

  const subjectName = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s.name])),
    [subjects.data],
  );

  const [target, setTarget] = useState<Target | null>(null);

  const published = exam.data?.isPublished ?? false;
  const assessmentRows = [...(assessments.data ?? [])].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const registerRows = registers.data ?? [];

  // Meta line: "Unit test · 20 – 24 Jul 2026 · SCERT Standard grade scale"
  const scaleName = exam.data
    ? ((exam.data.gradeScaleId
        ? scales.data?.find((s) => s.id === exam.data!.gradeScaleId)?.name
        : scales.data?.find((s) => s.isDefault)?.name) ?? null)
    : null;
  const meta = exam.data
    ? [
        EXAM_TYPE_LABEL[exam.data.type],
        fmtRange(exam.data.startDate, exam.data.endDate),
        scaleName ? `${scaleName} grade scale` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Link
          href="/exams"
          className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-maroon-700 hover:text-maroon-800"
        >
          <ArrowLeft aria-hidden size={15} />
          All exams
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[28px] font-medium leading-tight text-ink-900">
            {exam.data?.name ?? "Exam"}
          </h2>
          {exam.data ? (
            <>
              <StatusChip status={published ? "PUBLISHED" : "DRAFT"} dot={published} />
              {published ? <StatusChip tone="neutral" label="Read only" /> : null}
            </>
          ) : null}
        </div>
        {meta ? <span className="text-[13px] text-ink-500">{meta}</span> : null}
      </div>

      <Assessments
        examId={examId}
        rows={assessmentRows}
        subjectName={subjectName}
        subjects={subjects.data ?? []}
        published={published}
        isLoading={assessments.isLoading}
        isError={assessments.isError}
      />

      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="flex flex-col gap-px border-b border-cream-100 px-5 py-4">
          <span className="font-display text-[17px] font-semibold text-ink-900">
            Marks registers
          </span>
          <span className="text-[12.5px] text-ink-500">
            One register per assessment, class and section
          </span>
        </div>

        {registers.isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading…</p>
        ) : registers.isError ? (
          <p className="px-5 py-8 text-center text-sm text-red-600">Couldn’t load the registers.</p>
        ) : registerRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-b border-cream-100 px-5 py-9">
            <span className="flex size-[52px] items-center justify-center rounded-card bg-cream-100 text-ink-400">
              <ListNumbers aria-hidden size={26} />
            </span>
            <span className="text-sm font-semibold text-ink-900">No registers yet</span>
            <span className="max-w-[380px] text-center text-[13px] text-ink-500">
              Pick the assessment, class and section below — the register opens ready for mark
              entry.
            </span>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
              <span>Subject</span>
              <span>Section</span>
              <span>Status</span>
              <span className="w-16 text-right">Open</span>
            </div>
            {registerRows.map((r) => (
              <div
                key={r.examSectionId}
                className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3 transition-colors duration-fast hover:bg-cream-50"
              >
                <span className="text-sm font-semibold text-ink-900">{r.subjectName}</span>
                <span className="text-[13.5px] text-ink-500">{r.sectionName}</span>
                <span>
                  <StatusChip status={r.status} label={REGISTER_STATUS_LABEL[r.status]} />
                </span>
                <span className="flex w-16 justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setTarget({ assessmentId: r.assessmentId, sectionId: r.sectionId })
                    }
                    className="cursor-pointer rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
                  >
                    Open
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <StartRegister
          assessments={assessmentRows}
          subjectName={subjectName}
          disabled={assessmentRows.length === 0}
          onOpen={setTarget}
        />
      </div>

      {target !== null && exam.data ? (
        <MarksGrid
          key={`${target.assessmentId}:${target.sectionId}`}
          academicYearId={exam.data.academicYearId}
          assessment={assessmentRows.find((a) => a.id === target.assessmentId) ?? null}
          register={
            registerRows.find(
              (r) => r.assessmentId === target.assessmentId && r.sectionId === target.sectionId,
            ) ?? null
          }
          subjectLabel={subjectName.get(
            assessmentRows.find((a) => a.id === target.assessmentId)?.subjectId ?? "",
          )}
          target={target}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------------- Assessments */

function Assessments({
  examId,
  rows,
  subjects,
  subjectName,
  published,
  isLoading,
  isError,
}: {
  examId: string;
  rows: AssessmentDto[];
  subjects: { id: string; name: string }[];
  subjectName: Map<string, string>;
  published: boolean;
  isLoading: boolean;
  isError: boolean;
}) {
  const { show } = useToast();
  const utils = trpc.useUtils();
  const invalidate = () => utils.assessment.list.invalidate();
  const create = trpc.assessment.create.useMutation({
    onSuccess: () => {
      void invalidate();
      show("success", "Assessment added");
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.assessment.delete.useMutation({
    onSuccess: () => {
      void invalidate();
      show("success", "Assessment deleted");
    },
    onError: (e) => show("error", e.message),
  });

  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AssessmentDto | null>(null);

  return (
    <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 px-5 py-4">
        <span className="flex flex-col gap-px">
          <span className="font-display text-[17px] font-semibold text-ink-900">Assessments</span>
          <span className="text-[12.5px] text-ink-500">
            What is being tested and how it is scored
          </span>
        </span>
        {published ? null : (
          <button
            type="button"
            onClick={() => {
              create.reset();
              setAdding(true);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
          >
            <Plus aria-hidden size={14} />
            Add assessment
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
        <span>Subject</span>
        <span>Max theory</span>
        <span>Max practical</span>
        <span>Pass mark</span>
        <span className="w-11 text-right">{published ? "" : "Del"}</span>
      </div>
      {isLoading ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">Loading…</p>
      ) : isError ? (
        <p className="px-5 py-8 text-center text-sm text-red-600">Couldn’t load the assessments.</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">
          No assessments yet — add the subjects being tested.
        </p>
      ) : (
        rows.map((a) => {
          const name = subjectName.get(a.subjectId) ?? "—";
          const SubjectIcon = subjectIcon(name);
          const totalMax = a.maxTheory + (a.maxPractical ?? 0);
          const passPct = totalMax > 0 ? Math.round((a.passMark / totalMax) * 100) : null;
          return (
            <div
              key={a.id}
              className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
            >
              <span className="flex items-center gap-2.5 text-[14.5px] font-semibold text-ink-900">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-700">
                  <SubjectIcon aria-hidden size={16} />
                </span>
                {name}
              </span>
              <span className="text-[13.5px] text-ink-500">{a.maxTheory}</span>
              <span
                className={
                  a.maxPractical == null
                    ? "text-[13.5px] text-ink-300"
                    : "text-[13.5px] text-ink-500"
                }
              >
                {a.maxPractical ?? "—"}
              </span>
              <span className="text-[13.5px] text-ink-500">
                {a.passMark}
                {passPct !== null ? <span className="text-ink-400"> ({passPct}%)</span> : null}
              </span>
              <span className="flex w-11 justify-end">
                {published ? (
                  <span className="text-ink-400">—</span>
                ) : (
                  <IconButton
                    label="Delete"
                    tone="danger"
                    icon={Trash}
                    onClick={() => {
                      remove.reset();
                      setDeleting(a);
                    }}
                  />
                )}
              </span>
            </div>
          );
        })
      )}

      {adding ? (
        <AssessmentFormModal
          subjects={subjects.filter((s) => !rows.some((a) => a.subjectId === s.id))}
          busy={create.isPending}
          error={create.error?.message ?? null}
          onClose={() => setAdding(false)}
          onSubmit={(values) =>
            create.mutate({ examId, ...values }, { onSuccess: () => setAdding(false) })
          }
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDelete
          title="Delete assessment"
          message={`Delete the ${subjectName.get(deleting.subjectId) ?? "subject"} assessment? An assessment with marks cannot be deleted.`}
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate({ assessmentId: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </div>
  );
}

function AssessmentFormModal({
  subjects,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  subjects: { id: string; name: string }[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: {
    subjectId: string;
    maxTheory: number;
    maxPractical: number | null;
    passMark: number;
  }) => void;
}) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [maxTheory, setMaxTheory] = useState("100");
  const [maxPractical, setMaxPractical] = useState("");
  const [passMark, setPassMark] = useState("35");

  return (
    <Modal title="Add assessment" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            subjectId,
            maxTheory: Number(maxTheory),
            maxPractical: maxPractical.trim() === "" ? null : Number(maxPractical),
            passMark: Number(passMark),
          });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Subject
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={inputClass}
            required
          >
            {subjects.length === 0 ? <option value="">No subjects left</option> : null}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <label className={labelClass}>
            Max theory
            <input
              type="number"
              min={0}
              value={maxTheory}
              onChange={(e) => setMaxTheory(e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className={labelClass}>
            Max practical
            <input
              type="number"
              min={0}
              value={maxPractical}
              onChange={(e) => setMaxPractical(e.target.value)}
              className={inputClass}
              placeholder="none"
            />
          </label>
          <label className={labelClass}>
            Pass mark
            <input
              type="number"
              min={0}
              value={passMark}
              onChange={(e) => setPassMark(e.target.value)}
              className={inputClass}
              required
            />
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={subjectId === ""}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- StartRegister */

function StartRegister({
  assessments,
  subjectName,
  disabled,
  onOpen,
}: {
  assessments: AssessmentDto[];
  subjectName: Map<string, string>;
  disabled: boolean;
  onOpen: (target: Target) => void;
}) {
  const [assessmentId, setAssessmentId] = useState("");
  const [sectionId, setSectionId] = useState("");

  return (
    <div className="flex flex-wrap items-end gap-3 bg-cream-50 px-5 py-4">
      <label className={labelClass}>
        Assessment
        <select
          value={assessmentId}
          onChange={(e) => setAssessmentId(e.target.value)}
          className={`${inputClass} min-w-[170px]`}
          disabled={disabled}
        >
          <option value="">Select…</option>
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>
              {subjectName.get(a.subjectId) ?? a.subjectId} — theory {a.maxTheory}
            </option>
          ))}
        </select>
      </label>
      <SectionPicker onSection={setSectionId} />
      <button
        type="button"
        disabled={assessmentId === "" || sectionId === ""}
        onClick={() => onOpen({ assessmentId, sectionId })}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-maroon-700 px-5 py-2.5 text-[13px] font-semibold text-cream-50 transition-colors duration-fast hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PencilLine aria-hidden size={15} weight="bold" />
        Open marks register
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- MarksGrid */

type Entry = { theory: string; practical: string; isAbsent: boolean };
const blank: Entry = { theory: "", practical: "", isAbsent: false };
const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function MarksGrid({
  academicYearId,
  assessment,
  register,
  subjectLabel,
  target,
  onClose,
}: {
  academicYearId: string;
  assessment: AssessmentDto | null;
  register: ExamRegisterDto | null;
  subjectLabel: string | undefined;
  target: Target;
  onClose: () => void;
}) {
  const { show } = useToast();
  const utils = trpc.useUtils();
  const roster = trpc.enrollment.sectionRoster.useQuery({
    academicYearId,
    sectionId: target.sectionId,
  });
  const students = trpc.student.list.useQuery();
  const studentName = new Map(
    (students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
  );
  const existing = trpc.mark.listByRegister.useQuery(
    { examSectionId: register?.examSectionId ?? "" },
    { enabled: register?.examSectionId != null },
  );
  const existingByEnrollment = new Map((existing.data ?? []).map((m) => [m.enrollmentId, m]));

  const [edits, setEdits] = useState<Record<string, Entry>>({});

  const refresh = () => {
    void utils.exam.registers.invalidate();
    void utils.mark.listByRegister.invalidate();
  };
  const save = trpc.mark.save.useMutation({
    onSuccess: () => {
      setEdits({});
      refresh();
      show("success", "Marks saved");
    },
    onError: (e) => show("error", e.message),
  });
  const submit = trpc.mark.submit.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Register submitted");
    },
    onError: (e) => show("error", e.message),
  });
  const lock = trpc.mark.lock.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Register locked");
    },
    onError: (e) => show("error", e.message),
  });
  const unlock = trpc.mark.unlock.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Register unlocked");
    },
    onError: (e) => show("error", e.message),
  });

  const [unlocking, setUnlocking] = useState(false);

  const status = register?.status ?? "NONE";
  const editable = status === "NONE" || status === "DRAFT";
  const hasPractical = assessment?.maxPractical != null;
  const rows = roster.data ?? [];

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
  const setEntry = (enrollmentId: string, patch: Partial<Entry>) =>
    setEdits((prev) => ({ ...prev, [enrollmentId]: { ...current(enrollmentId), ...patch } }));

  if (assessment === null) return null;

  const exportCsv = () =>
    downloadCsv(
      `marks-${subjectLabel ?? "assessment"}-${register?.sectionName ?? target.sectionId}.csv`,
      [
        ["Student", "Roll no", "Theory", "Practical", "Total", "%", "Grade"],
        ...rows.map((e) => {
          const m = existingByEnrollment.get(e.id);
          const v = current(e.id);
          return [
            studentName.get(e.studentId) ?? e.studentId,
            e.rollNo == null ? "" : String(e.rollNo),
            v.isAbsent ? "AB" : v.theory,
            hasPractical ? (v.isAbsent ? "AB" : v.practical) : "",
            m?.totalObtained == null ? "" : String(m.totalObtained),
            m?.percentage == null ? "" : String(m.percentage),
            m?.gradeLetter ?? "",
          ];
        }),
      ],
    );

  return (
    <div className="flex flex-col gap-4 rounded-card border border-subtle bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2.5 font-display text-[17px] font-semibold text-ink-900">
            {subjectLabel ?? "Assessment"} · Section {register?.sectionName ?? "—"}
            <StatusChip
              status={status === "NONE" ? undefined : status}
              label={REGISTER_STATUS_LABEL[status]}
            />
          </p>
          <p className="text-[12.5px] text-ink-500">
            Max theory {assessment.maxTheory}
            {hasPractical ? ` · practical ${assessment.maxPractical}` : " · theory only"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <TableShell
        head={
          hasPractical
            ? ["Student", "Roll", "Theory", "Practical", "Total", "%", "Grade"]
            : ["Student", "Roll", "Theory", "Total", "%", "Grade"]
        }
        isLoading={roster.isLoading}
        isError={roster.isError}
        isEmpty={rows.length === 0}
        emptyText="No active students in this section."
      >
        {rows.map((e) => {
          const v = current(e.id);
          const m = existingByEnrollment.get(e.id);
          return (
            <tr key={e.id} className="transition-colors duration-fast hover:bg-cream-50">
              <td className="px-4 py-2 text-sm font-semibold text-ink-900">
                {studentName.get(e.studentId) ?? e.studentId}
              </td>
              <td className="px-4 py-2 text-ink-500">{e.rollNo ?? "—"}</td>
              <td className="px-4 py-2">
                {editable ? (
                  <input
                    type="number"
                    min={0}
                    disabled={v.isAbsent}
                    value={v.theory}
                    onChange={(ev) => setEntry(e.id, { theory: ev.target.value })}
                    className={`${inputClass} w-20 tabular-nums`}
                  />
                ) : (
                  <span className="text-ink-500">{v.isAbsent ? "AB" : v.theory || "—"}</span>
                )}
              </td>
              {hasPractical ? (
                <td className="px-4 py-2">
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      disabled={v.isAbsent}
                      value={v.practical}
                      onChange={(ev) => setEntry(e.id, { practical: ev.target.value })}
                      className={`${inputClass} w-20 tabular-nums`}
                    />
                  ) : (
                    <span className="text-ink-500">{v.isAbsent ? "AB" : v.practical || "—"}</span>
                  )}
                </td>
              ) : null}
              <td className="px-4 py-2 tabular-nums text-ink-500">{m?.totalObtained ?? "—"}</td>
              <td className="px-4 py-2 tabular-nums text-ink-500">{m?.percentage ?? "—"}</td>
              <td className="px-4 py-2 font-semibold text-ink-800">{m?.gradeLetter ?? "—"}</td>
            </tr>
          );
        })}
      </TableShell>

      {editable && rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            loading={save.isPending}
            onClick={() =>
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
              })
            }
          >
            Save marks
          </Button>
          {register?.examSectionId != null && status === "DRAFT" ? (
            <Button
              variant="secondary"
              loading={submit.isPending}
              onClick={() => submit.mutate({ examSectionId: register.examSectionId })}
            >
              Submit
            </Button>
          ) : null}
        </div>
      ) : status === "SUBMITTED" && register ? (
        <div>
          <Button
            loading={lock.isPending}
            onClick={() => lock.mutate({ examSectionId: register.examSectionId })}
          >
            Lock register
          </Button>
        </div>
      ) : status === "LOCKED" && register ? (
        <div>
          <Button variant="secondary" onClick={() => setUnlocking(true)}>
            Unlock to edit
          </Button>
        </div>
      ) : null}

      {save.error ? <p className="text-sm text-red-600">{save.error.message}</p> : null}
      {submit.error ? <p className="text-sm text-red-600">{submit.error.message}</p> : null}
      {lock.error ? <p className="text-sm text-red-600">{lock.error.message}</p> : null}

      {unlocking && register ? (
        <UnlockModal
          busy={unlock.isPending}
          error={unlock.error?.message ?? null}
          onClose={() => setUnlocking(false)}
          onConfirm={(reason) =>
            unlock.mutate(
              { examSectionId: register.examSectionId, reason },
              { onSuccess: () => setUnlocking(false) },
            )
          }
        />
      ) : null}
    </div>
  );
}

function UnlockModal({
  busy,
  error,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title="Unlock register" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason.trim());
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-ink-500">
          Unlocking reopens the register for edits and clears its result snapshot. The reason is
          audited.
        </p>
        <label className={labelClass}>
          Reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClass}
            rows={3}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={reason.trim() === ""}>
            Unlock
          </Button>
        </div>
      </form>
    </Modal>
  );
}
