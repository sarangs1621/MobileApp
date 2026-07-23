"use client";

import {
  BookOpen,
  Check,
  Clock,
  DotsThreeCircle,
  DownloadSimple,
  Info,
  MegaphoneSimple,
  Plus,
  Prohibit,
  ShieldCheck,
  TShirt,
  WarningOctagon,
  type Icon,
} from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { BehaviourCategoryKey, BehaviourSeverityKey, BehaviourStatusKey } from "@repo/types";
import { cn } from "@repo/ui";
import { useMemo, useState } from "react";

import { downloadCsv } from "@/src/components/attendance/ui";
import {
  Avatar,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  StatusChip,
  type Tone,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const SEVERITIES: BehaviourSeverityKey[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES: BehaviourStatusKey[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const CATEGORIES: { key: BehaviourCategoryKey; label: string; icon: Icon }[] = [
  { key: "LATE", label: "Late", icon: Clock },
  { key: "DISCIPLINE", label: "Discipline", icon: MegaphoneSimple },
  { key: "MISCONDUCT", label: "Misconduct", icon: Prohibit },
  { key: "BULLYING", label: "Bullying", icon: WarningOctagon },
  { key: "UNIFORM", label: "Uniform", icon: TShirt },
  { key: "HOMEWORK", label: "Homework", icon: BookOpen },
  { key: "OTHER", label: "Other", icon: DotsThreeCircle },
];
const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.key, c.label]));

const SEVERITY_LABEL: Record<BehaviourSeverityKey, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};
const SEVERITY_TONE: Record<BehaviourSeverityKey, Tone> = {
  LOW: "neutral",
  MEDIUM: "gold",
  HIGH: "danger",
  CRITICAL: "danger",
};
const SEVERITY_HINT: Record<BehaviourSeverityKey, string> = {
  LOW: "Noted in the log only — parents are not notified.",
  MEDIUM: "Visible to parents in their portal.",
  HIGH: "Parents notified immediately; principal copied.",
  CRITICAL: "Immediate escalation — parents and the principal are notified at once.",
};
// Selected-tile colours per severity (unselected is a plain sand-outline tile).
const SEVERITY_TILE_ON: Record<BehaviourSeverityKey, string> = {
  LOW: "border-ink-500 bg-cream-100 text-ink-700",
  MEDIUM: "border-gold-600 bg-gold-100 text-gold-700",
  HIGH: "border-red-600 bg-red-100 text-red-600",
  CRITICAL: "border-red-600 bg-red-600 text-white",
};

const STATUS_LABEL: Record<BehaviourStatusKey, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
const STATUS_TONE: Record<BehaviourStatusKey, Tone> = {
  OPEN: "gold",
  IN_PROGRESS: "gold",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Behaviour console (M12, ADR-020; design handoff §8) — admin (behaviour:manage).
 * School-wide incident log filtered by student / teacher / severity / status, the
 * Open → Resolve → Close workflow, a record-incident modal (category + severity
 * pills with parent-notification hints), and CSV export of the current view. Thin
 * client over the tRPC surface; the service gates + derives the enrollment.
 */
export default function BehaviourConsolePage() {
  const { show } = useToast();
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.BEHAVIOUR_MANAGE);

  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [severity, setSeverity] = useState<BehaviourSeverityKey | "">("");
  const [status, setStatus] = useState<BehaviourStatusKey | "">("");
  const [recording, setRecording] = useState(false);

  const students = trpc.student.list.useQuery(undefined, { enabled: canManage });
  const teachers = trpc.teacherProfile.list.useQuery(undefined, { enabled: canManage });

  const studentName = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [students.data],
  );
  // teacherId on an incident is a User id; StaffDto.userId maps it to a display name.
  const teacherName = useMemo(
    () => new Map((teachers.data ?? []).map((t) => [t.userId, t.name])),
    [teachers.data],
  );

  const utils = trpc.useUtils();
  const list = trpc.behaviour.list.useQuery(
    {
      ...(studentId ? { studentId } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    },
    { enabled: canManage },
  );
  const rows = list.data ?? [];

  const refresh = () => void utils.behaviour.list.invalidate();
  const resolve = trpc.behaviour.resolve.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Incident resolved — parent notified");
    },
    onError: (e) => show("error", e.message),
  });
  const close = trpc.behaviour.close.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Incident closed");
    },
    onError: (e) => show("error", e.message),
  });
  const busy = resolve.isPending || close.isPending;

  const exportCsv = () => {
    const header = ["Date", "Student", "Teacher", "Category", "Severity", "Status", "Title"];
    const body = rows.map((b) => [
      fmtDate(b.createdAt),
      studentName.get(b.studentId) ?? b.studentId,
      teacherName.get(b.teacherId) ?? b.teacherId,
      CATEGORY_LABEL.get(b.category) ?? b.category,
      SEVERITY_LABEL[b.severity],
      STATUS_LABEL[b.status],
      b.title,
    ]);
    downloadCsv("behaviour-incidents.csv", [header, ...body]);
  };

  if (!me.isLoading && !canManage) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center p-6">
        <p className="text-center text-sm text-ink-500">
          You don’t have access to the behaviour console. Please contact the school office.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
      {/* Header */}
      <section className="flex animate-fade-up flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
            <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
            Operations
          </div>
          <h1 className="font-display text-[34px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            Behaviour &amp; discipline
          </h1>
          <p className="text-sm text-ink-500">Incident log across all classes.</p>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-[18px] py-2.5 text-[13px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50 disabled:opacity-50"
          >
            <DownloadSimple aria-hidden size={15} />
            Export CSV
          </button>
          <Button icon={Plus} onClick={() => setRecording(true)}>
            Record incident
          </Button>
        </div>
      </section>

      {/* Filters */}
      <section className="flex animate-fade-up flex-wrap items-end gap-3 [animation-delay:60ms]">
        <div className="min-w-[150px]">
          <Select label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">All students</option>
            {(students.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[140px]">
          <Select label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">All teachers</option>
            {(teachers.data ?? []).map((t) => (
              <option key={t.id} value={t.userId}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[120px]">
          <Select
            label="Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as BehaviourSeverityKey | "")}
          >
            <option value="">Any severity</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[120px]">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as BehaviourStatusKey | "")}
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {/* Incident table */}
      <section className="animate-fade-up overflow-hidden rounded-card border border-subtle bg-white shadow-sm [animation-delay:120ms]">
        <div className="grid grid-cols-[1.6fr_1.1fr_1fr_0.9fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Student &amp; incident</span>
          <span>Reported by</span>
          <span>Date</span>
          <span>Severity</span>
          <span>Status</span>
          <span className="w-24 text-right">Actions</span>
        </div>

        {list.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No incidents"
            message={
              studentId || teacherId || severity || status
                ? "No incidents match these filters."
                : "A calm log is a good sign — recorded incidents will appear here."
            }
            action={
              <Button size="sm" icon={Plus} onClick={() => setRecording(true)}>
                Record incident
              </Button>
            }
          />
        ) : (
          rows.map((b) => (
            <div
              key={b.id}
              className="grid grid-cols-[1.6fr_1.1fr_1fr_0.9fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
            >
              <span className="flex items-center gap-3">
                <Avatar name={studentName.get(b.studentId) ?? "?"} size="sm" />
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="truncate text-sm font-semibold text-ink-900">
                    {studentName.get(b.studentId) ?? "—"}
                  </span>
                  <span className="truncate text-[12px] text-ink-500">{b.title}</span>
                </span>
              </span>
              <span className="truncate text-[13.5px] text-ink-700">
                {teacherName.get(b.teacherId) ?? "—"}
              </span>
              <span className="text-[13.5px] text-ink-500">{fmtDate(b.createdAt)}</span>
              <span>
                <StatusChip tone={SEVERITY_TONE[b.severity]} label={SEVERITY_LABEL[b.severity]} />
              </span>
              <span>
                <StatusChip tone={STATUS_TONE[b.status]} label={STATUS_LABEL[b.status]} dot />
              </span>
              <span className="flex w-24 justify-end">
                {b.status === "CLOSED" ? (
                  <span className="text-[12.5px] text-ink-400">Closed</span>
                ) : b.status === "RESOLVED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => close.mutate({ id: b.id })}
                    className="cursor-pointer rounded-full border border-subtle bg-white px-4 py-[7px] text-[12.5px] font-semibold text-ink-700 transition-colors duration-fast hover:border-strong hover:bg-cream-100 disabled:opacity-50"
                  >
                    Close
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resolve.mutate({ id: b.id })}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-green-600 px-3.5 py-[7px] text-[12.5px] font-semibold text-white transition-[filter] duration-fast hover:brightness-95 disabled:opacity-50"
                  >
                    <Check aria-hidden size={13} weight="bold" />
                    Resolve
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </section>

      <p className="flex animate-fade-up items-center gap-1.5 text-[12.5px] text-ink-400 [animation-delay:160ms]">
        <Info aria-hidden size={15} />
        Open → Resolved (talked to student/parent) → Closed (no further action). Parents see medium
        and high incidents in their portal.
      </p>

      {recording ? (
        <RecordIncidentModal
          students={(students.data ?? []).map((s) => ({
            id: s.id,
            label: `${s.firstName} ${s.lastName}`,
          }))}
          onClose={() => setRecording(false)}
          onDone={() => {
            refresh();
            setRecording(false);
          }}
        />
      ) : null}
    </main>
  );
}

/* --------------------------------------------------------------- record modal */

function RecordIncidentModal({
  students,
  onClose,
  onDone,
}: {
  students: readonly { id: string; label: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { show } = useToast();
  const create = trpc.behaviour.create.useMutation({
    onSuccess: () => {
      show("success", "Incident recorded");
      onDone();
    },
    onError: (e) => show("error", e.message),
  });

  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState<BehaviourCategoryKey>("LATE");
  const [severity, setSeverity] = useState<BehaviourSeverityKey>("LOW");
  const [description, setDescription] = useState("");

  const submit = () => {
    const text = description.trim();
    if (studentId === "" || text === "") return;
    // The API needs both a short title + a full description; the design captures
    // one "what happened" field, so the title is its trimmed lead.
    const title = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    create.mutate({
      studentId,
      category,
      severity,
      title,
      description: text,
      // LOW is log-only (design); MEDIUM+ notify parents (service default).
      notify: severity !== "LOW",
    });
  };

  return (
    <Dialog title="Record incident" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-[18px]"
      >
        <Select
          label="Student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        >
          <option value="">Select a student…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>

        {/* Category tiles */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Category</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => {
              const selected = category === c.key;
              const TileIcon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(c.key)}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[11px] border px-1.5 py-2.5 text-[12.5px] font-semibold transition-colors duration-fast",
                    selected
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  <TileIcon aria-hidden size={15} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Severity tiles + hint */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Severity</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEVERITIES.map((s) => {
              const selected = severity === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSeverity(s)}
                  className={cn(
                    "cursor-pointer rounded-[11px] border px-2 py-[11px] text-[13px] font-bold transition-colors duration-fast",
                    selected
                      ? SEVERITY_TILE_ON[s]
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  {SEVERITY_LABEL[s]}
                </button>
              );
            })}
          </div>
          <span className="text-caption text-ink-400">{SEVERITY_HINT[severity]}</span>
        </div>

        {/* What happened */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">
            What happened? <span className="text-red-600">*</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            placeholder="Brief, factual description — parents may see this."
            className="resize-y rounded-xl border border-subtle bg-white px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100"
          />
        </div>

        {create.error ? <p className="text-sm text-red-600">{create.error.message}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Save incident
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
