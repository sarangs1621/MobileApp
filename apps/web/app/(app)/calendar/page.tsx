"use client";

import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Confetti,
  DownloadSimple,
  Exam,
  LinkSimple,
  PencilSimple,
  Plus,
  Sun,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { CalendarEventDto, CalendarEventTypeKey } from "@repo/types";
import { cn } from "@repo/ui";
import { useId, useState, type ComponentType } from "react";

import {
  CALENDAR_EVENT_TYPES,
  EVENT_TYPE_LABEL,
  formatDate,
} from "@/src/components/announcement/ui";
import { downloadCsv } from "@/src/components/attendance/ui";
import {
  Button,
  DateField,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  SkeletonText,
  StatusChip,
  type Tone,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Per-type colour system — pills, cell chips, list badges, modal tiles. */
const TYPE_META: Record<
  CalendarEventTypeKey,
  {
    tone: Tone;
    dot: string;
    chip: string;
    icon: ComponentType<{ className?: string; size?: number }>;
  }
> = {
  HOLIDAY: { tone: "success", dot: "bg-green-600", chip: "bg-green-100 text-green-600", icon: Sun },
  EVENT: {
    tone: "neutral",
    dot: "bg-ink-500",
    chip: "bg-cream-100 text-ink-700",
    icon: Confetti,
  },
  EXAM: {
    tone: "brand",
    dot: "bg-maroon-700",
    chip: "bg-maroon-50 text-maroon-800",
    icon: Exam,
  },
  MEETING: {
    tone: "gold",
    dot: "bg-gold-600",
    chip: "bg-gold-100 text-gold-700",
    icon: UsersThree,
  },
  OTHER: {
    tone: "neutral",
    dot: "bg-ink-400",
    chip: "bg-cream-100 text-ink-700",
    icon: CalendarBlank,
  },
};

const textareaClass =
  "w-full rounded-xl border border-subtle bg-white px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100 resize-y";

/**
 * Calendar management (M11, ADR-019 Step 7; design handoff §School Calendar). A
 * month grid + list of events with a type filter; admins (academic:manage)
 * create/edit/delete events; anyone with calendar:read views + exports CSV. Thin
 * client — the service gates writes and validates ranges.
 */
export default function CalendarPage() {
  const now = new Date();
  const me = trpc.auth.me.useQuery();
  const canManage = me.data?.role !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [type, setType] = useState<CalendarEventTypeKey | "ALL">("ALL");
  const [editing, setEditing] = useState<CalendarEventDto | "new" | null>(null);

  const typeArg = type === "ALL" ? {} : { eventType: type };
  const query = trpc.calendar.month.useQuery({ year, month, ...typeArg });
  const events = query.data ?? [];

  const step = (delta: number) => {
    const m0 = month - 1 + delta;
    setYear((y) => y + Math.floor(m0 / 12));
    setMonth((((m0 % 12) + 12) % 12) + 1);
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  const exportCsv = () => {
    const rows: string[][] = [
      ["Title", "Type", "Start", "End", "All day", "Description"],
      ...events.map((e) => [
        e.title,
        EVENT_TYPE_LABEL[e.eventType],
        e.startDate,
        e.endDate,
        e.isAllDay ? "yes" : "no",
        e.description ?? "",
      ]),
    ];
    downloadCsv(`calendar-${year}-${pad(month)}.csv`, rows);
  };

  // Month grid cells (Sunday-start).
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading: (string | null)[] = Array<null>(firstDow).fill(null);
  const cells: (string | null)[] = [
    ...leading,
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const eventsOn = (day: string) => events.filter((e) => e.startDate <= day && day <= e.endDate);
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-5 px-9 py-7">
      <PageHeader
        eyebrow="Communication"
        title="School calendar"
        subtitle="Exams, holidays, meetings and activities — visible to parents and teachers."
        action={
          <div className="flex gap-2.5">
            <Button variant="secondary" icon={DownloadSimple} onClick={exportCsv}>
              Export CSV
            </Button>
            {canManage ? (
              <Button icon={Plus} onClick={() => setEditing("new")}>
                New event
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Month nav + type filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <IconButton label="Previous month" icon={CaretLeft} onClick={() => step(-1)} />
          <span className="min-w-[130px] text-center font-display text-xl font-semibold text-ink-900">
            {MONTHS[month - 1]} {year}
          </span>
          <IconButton label="Next month" icon={CaretRight} onClick={() => step(1)} />
          <Button variant="secondary" size="sm" onClick={goToday} className="ml-1">
            Today
          </Button>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", ...CALENDAR_EVENT_TYPES] as const).map((t) => {
            const active = type === t;
            const dot = t === "ALL" ? "bg-ink-400" : TYPE_META[t].dot;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setType(t)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors duration-fast",
                  active
                    ? "border-ink-900 bg-ink-900 text-cream-50"
                    : "border-subtle bg-white text-ink-500 hover:border-strong",
                )}
              >
                <span className={cn("size-2 rounded-full", active ? "bg-cream-50" : dot)} />
                {t === "ALL" ? "All" : EVENT_TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Month grid */}
      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-cream-100">
          {DOW.map((d, i) => (
            <span
              key={d}
              className={cn(
                "px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.1em]",
                i === 0 ? "text-ink-300" : "text-ink-400",
              )}
            >
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isSunday = i % 7 === 0;
            const isToday = day === todayStr;
            return (
              <div
                key={day ?? `blank-${i}`}
                className={cn(
                  "flex min-h-[86px] flex-col gap-1.5 border-b border-r border-cream-100 p-2",
                  isSunday ? "bg-cream-50" : "bg-white",
                )}
              >
                {day ? (
                  <>
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs",
                        isToday
                          ? "bg-maroon-700 font-bold text-cream-50"
                          : isSunday
                            ? "text-ink-300"
                            : "text-ink-500",
                      )}
                    >
                      {Number(day.slice(-2))}
                    </span>
                    {eventsOn(day).map((e) => {
                      const meta = TYPE_META[e.eventType];
                      const pill = <span className="block truncate">{e.title}</span>;
                      return canManage ? (
                        <button
                          key={e.id}
                          type="button"
                          title={e.title}
                          onClick={() => setEditing(e)}
                          className={cn(
                            "cursor-pointer rounded-[7px] px-2 py-1 text-left text-[11.5px] font-semibold transition-[filter] duration-fast hover:brightness-95",
                            meta.chip,
                          )}
                        >
                          {pill}
                        </button>
                      ) : (
                        <span
                          key={e.id}
                          title={e.title}
                          className={cn(
                            "rounded-[7px] px-2 py-1 text-[11.5px] font-semibold",
                            meta.chip,
                          )}
                        >
                          {pill}
                        </span>
                      );
                    })}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Events list */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-900">Events this month</h2>
        {query.isLoading ? (
          <div className="rounded-card border border-subtle bg-white p-5 shadow-sm">
            <SkeletonText lines={3} />
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-card border border-subtle bg-white shadow-sm">
            <EmptyState
              icon={CalendarBlank}
              title="Nothing this month"
              message="Published exams and holidays appear here automatically; add meetings and activities with New event."
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
            {events.map((e) => {
              const meta = TYPE_META[e.eventType];
              const dayNum = Number(e.startDate.slice(8, 10));
              const monIdx = Number(e.startDate.slice(5, 7)) - 1;
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3.5 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
                >
                  <span className="flex size-[42px] shrink-0 flex-col items-center justify-center rounded-xl bg-cream-100 leading-none">
                    <span className="text-[15px] font-bold text-maroon-800">{dayNum}</span>
                    <span className="text-[9px] uppercase tracking-[0.08em] text-ink-400">
                      {MONTHS[monIdx]?.slice(0, 3)}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14.5px] font-semibold text-ink-900">
                      {e.title}
                    </span>
                    <span className="truncate text-[12.5px] text-ink-500">
                      {e.startDate === e.endDate
                        ? formatDate(e.startDate)
                        : `${formatDate(e.startDate)} – ${formatDate(e.endDate)}`}
                      {e.description ? ` · ${e.description}` : ""}
                    </span>
                  </span>
                  <StatusChip tone={meta.tone} label={EVENT_TYPE_LABEL[e.eventType]} dot />
                  {canManage ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <IconButton label="Edit" icon={PencilSimple} onClick={() => setEditing(e)} />
                      <DeleteEventButton id={e.id} onDeleted={() => void query.refetch()} />
                    </span>
                  ) : (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[11.5px] text-ink-400"
                      title="Managed by admins"
                    >
                      <LinkSimple aria-hidden size={13} />
                      School event
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing ? (
        <EventForm
          event={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => void query.refetch()}
        />
      ) : null}
    </main>
  );
}

/** Delete an event with a red-tinted icon button. */
function DeleteEventButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const { show } = useToast();
  const remove = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      onDeleted();
      show("success", "Event deleted.");
    },
    onError: (e) => show("error", e.message),
  });
  return (
    <IconButton
      label="Delete"
      tone="danger"
      icon={Trash}
      disabled={remove.isPending}
      onClick={() => remove.mutate({ id })}
    />
  );
}

/** Create / edit / delete a calendar event (admin). */
function EventForm({
  event,
  onClose,
  onSaved,
}: {
  event: CalendarEventDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventType, setEventType] = useState<CalendarEventTypeKey>(event?.eventType ?? "EVENT");
  const [startDate, setStartDate] = useState(event?.startDate ?? "");
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const descId = useId();

  const done = (message: string) => () => {
    onSaved();
    show("success", message);
    onClose();
  };
  const create = trpc.calendar.create.useMutation({
    onSuccess: done("Event created."),
    onError: (e) => setError(e.message),
  });
  const update = trpc.calendar.update.useMutation({
    onSuccess: done("Event saved."),
    onError: (e) => setError(e.message),
  });
  const remove = trpc.calendar.delete.useMutation({ onSuccess: done("Event deleted.") });

  // End date is optional in the UI — a blank end means a single-day event.
  const resolvedEnd = endDate || startDate;
  const valid = !!title.trim() && !!startDate && resolvedEnd >= startDate;

  const save = () => {
    setError(null);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      eventType,
      startDate,
      endDate: resolvedEnd,
    };
    if (event) update.mutate({ id: event.id, ...payload });
    else create.mutate(payload);
  };

  return (
    <Dialog title={event ? "Edit event" : "New event"} onClose={onClose} size="lg">
      <div className="flex flex-col gap-[18px]">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Input
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Annual sports day"
        />
        <Field label="Description" helper="Details parents should know." htmlFor={descId}>
          <textarea
            id={descId}
            rows={3}
            className={cn(textareaClass, "min-h-20")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink-900">Type</span>
          <div className="grid grid-cols-5 gap-2">
            {CALENDAR_EVENT_TYPES.map((t) => {
              const active = eventType === t;
              const meta = TYPE_META[t];
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setEventType(t)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-[11px] border px-1 py-2.5 text-[12px] font-semibold transition-colors duration-fast",
                    active
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  <meta.icon aria-hidden size={16} />
                  {EVENT_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <DateField
            label="Start date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <DateField
            label="End date"
            helper="Leave empty for a single-day event."
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-2.5 pt-1">
          <div>
            {event ? (
              <Button
                variant="ghost"
                icon={Trash}
                loading={remove.isPending}
                onClick={() => remove.mutate({ id: event.id })}
              >
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!valid} loading={create.isPending || update.isPending} onClick={save}>
              {event ? "Save changes" : "Create event"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
