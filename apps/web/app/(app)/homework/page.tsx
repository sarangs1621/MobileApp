"use client";

import {
  BookOpen,
  ChalkboardTeacher,
  Info,
  PencilSimple,
  Plus,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import type { HomeworkDto, HomeworkTargetDto } from "@repo/types";
import { cn } from "@repo/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { HW_STATUS_LABEL } from "@/src/components/homework/ui";
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

const TZ = "Asia/Kolkata";
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", opts);

/** Days between two YYYY-MM-DD dates (b − a). */
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000,
  );
}

/** Relative due label + tone for a homework row. */
function dueMeta(
  dueDate: string,
  status: string,
): { label: string; tone: "gold" | "red" | "muted" } {
  const diff = daysBetween(todayIso(), dueDate);
  if (status === "CLOSED") return { label: "Closed", tone: "muted" };
  if (diff < 0) {
    const n = -diff;
    return { label: `${n} day${n === 1 ? "" : "s"} overdue`, tone: "red" };
  }
  if (diff === 0) return { label: "Due today", tone: "red" };
  if (diff === 1) return { label: "Due tomorrow", tone: "gold" };
  if (diff <= 7) return { label: `Due in ${diff} days`, tone: "gold" };
  return { label: `Due in ${diff} days`, tone: "muted" };
}

/**
 * Homework dashboard (M6, ADR-013; design handoff §4), role-aware:
 * - admin → a year's homework (all states) + create;
 * - teacher → own (subject × section) homework + create;
 * - parent → PUBLISHED/CLOSED homework for their children (§10 or-clause).
 * The list is the handoff table card with icon rows, subject·section + due
 * timing, and section/status filters. Lifecycle, files, submissions + review
 * live on the detail page.
 */
export default function HomeworkDashboardPage() {
  const { show } = useToast();
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "OFFICE_ADMIN";
  const isParent = role === "PARENT";
  const canManage = role === "SUPER_ADMIN" || role === "OFFICE_ADMIN" || role === "TEACHER";

  const years = trpc.academicYear.list.useQuery(undefined, { enabled: isAdmin });
  const [yearId, setYearId] = useState("");
  useEffect(() => {
    if (isAdmin && yearId === "" && years.data) {
      const active = years.data.find((y) => y.status === "ACTIVE") ?? years.data[0];
      if (active) setYearId(active.id);
    }
  }, [isAdmin, years.data, yearId]);
  const activeYear = years.data?.find((y) => y.status === "ACTIVE");

  const homework = trpc.homework.list.useQuery(isAdmin ? { academicYearId: yearId } : {}, {
    enabled: !isAdmin || yearId !== "",
  });
  const targets = trpc.homework.targets.useQuery(undefined, { enabled: canManage });

  // Label resolution: admins resolve every row via the catalog; teachers reuse
  // their own targets (which cover all of their homework).
  const subjects = trpc.subject.list.useQuery(undefined, { enabled: isAdmin });
  const classes = trpc.class.list.useQuery(undefined, { enabled: isAdmin });
  const sectionLists = trpc.useQueries((t) =>
    isAdmin ? (classes.data ?? []).map((c) => t.section.list({ classId: c.id })) : [],
  );
  const staff = trpc.teacherProfile.list.useQuery(undefined, { enabled: isAdmin });

  const targetLabel = useMemo(
    () =>
      new Map(
        (targets.data ?? []).map((t) => [
          `${t.subjectId}:${t.sectionId}`,
          `${t.subjectName} · ${t.sectionName}`,
        ]),
      ),
    [targets.data],
  );
  const subjectName = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s.name])),
    [subjects.data],
  );
  const sectionName = useMemo(() => {
    const className = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
    const map = new Map<string, string>();
    sectionLists.forEach((q) =>
      (q.data ?? []).forEach((s) =>
        map.set(s.id, `${className.get(s.classId) ?? ""} ${s.name}`.trim()),
      ),
    );
    return map;
  }, [classes.data, sectionLists]);
  const staffName = useMemo(
    () => new Map((staff.data ?? []).map((s) => [s.id, s.name])),
    [staff.data],
  );

  const subjectFor = (h: HomeworkDto) =>
    subjectName.get(h.subjectId) ??
    targetLabel.get(`${h.subjectId}:${h.sectionId}`)?.split(" · ")[0] ??
    null;
  const sectionFor = (h: HomeworkDto) =>
    sectionName.get(h.sectionId) ??
    targetLabel.get(`${h.subjectId}:${h.sectionId}`)?.split(" · ")[1] ??
    null;

  const [creating, setCreating] = useState<"new" | null>(null);
  const [deleting, setDeleting] = useState<HomeworkDto | null>(null);
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT" | "PAST_DUE">(
    "ALL",
  );

  const utils = trpc.useUtils();
  const remove = trpc.homework.delete.useMutation({
    onSuccess: () => {
      void utils.homework.list.invalidate();
      show("success", "Homework deleted");
    },
    onError: (e) => show("error", e.message),
  });

  const allRows = homework.data ?? [];
  // Section filter options — the distinct sections present in the current list.
  const sectionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const h of allRows) {
      const label =
        sectionName.get(h.sectionId) ??
        targetLabel.get(`${h.subjectId}:${h.sectionId}`)?.split(" · ")[1] ??
        null;
      if (label && !seen.has(h.sectionId)) seen.set(h.sectionId, label);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allRows, sectionName, targetLabel]);

  const today = todayIso();
  const rows = allRows.filter((h) => {
    if (sectionFilter && h.sectionId !== sectionFilter) return false;
    if (statusFilter === "PUBLISHED" && h.status !== "PUBLISHED") return false;
    if (statusFilter === "DRAFT" && h.status !== "DRAFT") return false;
    if (statusFilter === "PAST_DUE" && !(h.status === "PUBLISHED" && h.dueDate < today))
      return false;
    return true;
  });

  return (
    <>
      {/* Header */}
      <section className="flex animate-fade-up flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
            <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
            Academics
          </div>
          <h1 className="font-display text-[34px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            Homework
          </h1>
          <p className="text-sm text-ink-500">
            {isParent
              ? "Assignments published for your children."
              : "Assignments across all classes"}
            {!isParent && activeYear ? (
              <>
                {" "}
                — <strong className="font-semibold text-ink-900">{activeYear.name}</strong> session.
              </>
            ) : isParent ? (
              ""
            ) : (
              "."
            )}
          </p>
        </div>
        {canManage ? (
          <Button icon={Plus} onClick={() => setCreating("new")}>
            New homework
          </Button>
        ) : null}
      </section>

      {/* Filters */}
      {!isParent ? (
        <section className="flex animate-fade-up flex-wrap items-end gap-3 [animation-delay:60ms]">
          {isAdmin ? (
            <div className="min-w-[170px]">
              <Select
                label="Academic year"
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
              >
                {(years.data ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.status === "ACTIVE" ? " (active)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="min-w-[140px]">
            <Select
              label="Section"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="">All sections</option>
              {sectionOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[130px]">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="ALL">All</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="PAST_DUE">Past due</option>
            </Select>
          </div>
        </section>
      ) : null}

      {/* Table card */}
      <section className="animate-fade-up overflow-hidden rounded-card border border-subtle bg-white shadow-sm [animation-delay:120ms]">
        <div
          className={cn(
            "grid items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400",
            isParent ? "grid-cols-[1.8fr_1fr_0.9fr]" : "grid-cols-[1.8fr_1.1fr_1fr_0.9fr_auto]",
          )}
        >
          <span>Title</span>
          {!isParent ? <span>Subject · Section</span> : null}
          <span>Due</span>
          <span>Status</span>
          {!isParent ? <span className="w-[76px] text-right">Actions</span> : null}
        </div>

        {homework.isLoading || (isAdmin && yearId === "") ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : homework.isError ? (
          <ErrorState onRetry={() => void homework.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={
              allRows.length === 0
                ? isParent
                  ? "No homework published for your children yet."
                  : "No homework yet."
                : "No homework matches these filters."
            }
            message={
              allRows.length === 0 && canManage
                ? "Set the first assignment — it appears for parents the moment you publish."
                : undefined
            }
            action={
              allRows.length === 0 && canManage ? (
                <Button size="sm" icon={Plus} onClick={() => setCreating("new")}>
                  New homework
                </Button>
              ) : undefined
            }
          />
        ) : (
          rows.map((h) => {
            const due = dueMeta(h.dueDate, h.status);
            const setBy = staffName.get(h.createdByStaffId);
            return (
              <div
                key={h.id}
                className={cn(
                  "grid items-center gap-3 border-b border-cream-100 px-5 py-[15px] transition-colors duration-fast last:border-0 hover:bg-cream-50",
                  isParent
                    ? "grid-cols-[1.8fr_1fr_0.9fr]"
                    : "grid-cols-[1.8fr_1.1fr_1fr_0.9fr_auto]",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-maroon-50 text-maroon-700">
                    <BookOpen aria-hidden size={18} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-px">
                    <Link
                      href={`/homework/${h.id}`}
                      className="truncate text-[14.5px] font-semibold text-ink-900 hover:text-maroon-700"
                    >
                      {h.title}
                    </Link>
                    {setBy ? (
                      <span className="truncate text-caption text-ink-400">Set by {setBy}</span>
                    ) : null}
                  </span>
                </span>

                {!isParent ? (
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="truncate text-[13.5px] font-semibold text-maroon-800">
                      {subjectFor(h) ?? "—"}
                    </span>
                    <span className="truncate text-caption text-ink-400">
                      {sectionFor(h) ?? ""}
                    </span>
                  </span>
                ) : null}

                <span className="flex flex-col gap-px">
                  <span className="text-[13.5px] font-semibold text-ink-900">
                    {fmtDate(h.dueDate, { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span
                    className={cn(
                      "text-caption font-semibold",
                      due.tone === "red"
                        ? "text-red-600"
                        : due.tone === "gold"
                          ? "text-gold-700"
                          : "text-ink-400",
                    )}
                  >
                    {due.label}
                  </span>
                </span>

                <span>
                  <StatusChip
                    status={h.status}
                    label={HW_STATUS_LABEL[h.status]}
                    dot={h.status === "PUBLISHED"}
                  />
                </span>

                {!isParent ? (
                  <span className="flex w-[76px] justify-end gap-1.5">
                    {canManage ? (
                      <>
                        <Link
                          href={`/homework/${h.id}`}
                          aria-label="Open homework"
                          title="Open"
                          className="flex size-8 items-center justify-center rounded-[9px] border border-subtle bg-white text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
                        >
                          <PencilSimple aria-hidden className="size-[15px]" />
                        </Link>
                        {h.status === "DRAFT" ? (
                          <IconButton
                            label="Delete"
                            tone="danger"
                            icon={Trash}
                            onClick={() => {
                              remove.reset();
                              setDeleting(h);
                            }}
                          />
                        ) : null}
                      </>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </span>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      {canManage ? (
        <p className="flex animate-fade-up items-center gap-1.5 text-[12.5px] text-ink-400 [animation-delay:160ms]">
          <Info aria-hidden size={15} />
          Published homework is visible to parents the moment it is saved.
        </p>
      ) : null}

      {creating ? (
        <CreateHomeworkModal
          targets={targets.data ?? []}
          loadingTargets={targets.isLoading}
          onClose={() => setCreating(null)}
          onDone={() => {
            void utils.homework.list.invalidate();
            setCreating(null);
          }}
        />
      ) : null}

      {deleting ? (
        <Dialog title="Delete homework?" onClose={() => setDeleting(null)} size="sm">
          <div className="flex flex-col gap-4">
            <span className="flex size-11 items-center justify-center rounded-[14px] bg-red-100 text-red-600">
              <Warning aria-hidden size={23} />
            </span>
            <p className="text-sm leading-relaxed text-ink-500">
              <span className="font-semibold text-ink-900">“{deleting.title}”</span> will be removed
              for all students in {sectionFor(deleting) ?? "this section"}. This cannot be undone.
            </p>
            {remove.error ? (
              <p className="text-sm text-red-600" role="alert">
                {remove.error.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate({ homeworkId: deleting.id }, { onSuccess: () => setDeleting(null) })
                }
              >
                Delete homework
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- create modal */

function CreateHomeworkModal({
  targets,
  loadingTargets,
  onClose,
  onDone,
}: {
  targets: HomeworkTargetDto[];
  loadingTargets: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { show } = useToast();
  const publish = trpc.homework.publish.useMutation({
    onError: (e) => show("error", e.message),
  });
  const create = trpc.homework.create.useMutation({
    onError: (e) => show("error", e.message),
  });

  const [pair, setPair] = useState(
    targets[0] ? `${targets[0].subjectId}:${targets[0].sectionId}` : "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const selected = targets.find((t) => `${t.subjectId}:${t.sectionId}` === pair);

  // Due-date shortcuts.
  const setTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setDueDate(d.toLocaleDateString("en-CA", { timeZone: TZ }));
    show("info", "Due date set to tomorrow");
  };
  const setNextMonday = () => {
    const d = new Date();
    const dow = d.getDay(); // 0 Sun … 6 Sat
    const add = (8 - dow) % 7 || 7; // days until next Monday
    d.setDate(d.getDate() + add);
    setDueDate(d.toLocaleDateString("en-CA", { timeZone: TZ }));
    show("info", "Due date set to next Monday");
  };

  const busy = create.isPending || publish.isPending;

  const submit = (publishNow: boolean) => {
    if (!selected || title.trim() === "" || dueDate === "") return;
    create.mutate(
      {
        subjectId: selected.subjectId,
        sectionId: selected.sectionId,
        title: title.trim(),
        description: description.trim() === "" ? null : description.trim(),
        dueDate,
      },
      {
        onSuccess: (created) => {
          if (publishNow && created?.id) {
            publish.mutate(
              { homeworkId: created.id },
              {
                onSuccess: () => {
                  show("success", `Homework published to ${selected.sectionName}`);
                  onDone();
                },
              },
            );
          } else {
            show("success", "Saved as draft — parents can’t see it yet");
            onDone();
          }
        },
      },
    );
  };

  const shortcutBtn =
    "flex-1 cursor-pointer whitespace-nowrap rounded-full border border-subtle bg-cream-50 px-2 py-[9px] text-xs font-semibold text-ink-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50";

  return (
    <Dialog title="New homework" onClose={onClose}>
      {loadingTargets ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : targets.length === 0 ? (
        /* Designed "no teaching assignments" state */
        <div className="flex flex-col items-center gap-3.5 px-1.5 pb-1 pt-2.5 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-gold-100 text-gold-700">
            <ChalkboardTeacher aria-hidden size={28} />
          </span>
          <span className="font-display text-[19px] font-semibold text-ink-900">
            No teaching assignments yet
          </span>
          <p className="max-w-[360px] text-[13.5px] leading-relaxed text-ink-500">
            Homework is set per subject and section. Your account isn’t assigned to any — assign
            yourself in Academic structure, or sign in with a teacher account.
          </p>
          <div className="flex gap-2.5 pt-1.5">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Link
              href="/academic/assignments"
              className="inline-flex h-11 items-center rounded-full border border-maroon-700 bg-maroon-700 px-5 text-[15px] font-semibold text-cream-50 shadow-sm transition-colors duration-fast hover:bg-maroon-800"
            >
              Go to Academic structure
            </Link>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(true);
          }}
          className="flex flex-col gap-[18px]"
        >
          <Select
            label="Subject · Section"
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            helper="You can only set homework for sections assigned to you."
            required
          >
            {targets.map((t) => (
              <option key={`${t.subjectId}:${t.sectionId}`} value={`${t.subjectId}:${t.sectionId}`}>
                {t.subjectName} — {t.sectionName}
              </option>
            ))}
          </Select>

          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Read Gujarati reader ch. 4"
            required
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-900">
              Instructions <span className="font-normal text-ink-400">(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What should students do at home?"
              className="resize-y rounded-xl border border-subtle bg-white px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100"
            />
          </div>

          <div className="grid grid-cols-2 items-end gap-3.5">
            <Input
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
            <div className="flex gap-1.5">
              <button type="button" onClick={setTomorrow} className={shortcutBtn}>
                Tomorrow
              </button>
              <button type="button" onClick={setNextMonday} className={shortcutBtn}>
                Next week
              </button>
            </div>
          </div>

          {create.error ? <p className="text-sm text-red-600">{create.error.message}</p> : null}

          <div className="mt-1 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              loading={busy && !publish.isPending}
              onClick={() => submit(false)}
            >
              Save draft
            </Button>
            <Button type="submit" loading={publish.isPending}>
              Publish homework
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
