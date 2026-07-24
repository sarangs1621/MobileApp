"use client";

import {
  CalendarCheck,
  CurrencyInr,
  DownloadSimple,
  Megaphone,
  Student,
  WarningCircle,
} from "@phosphor-icons/react";
import type { RoleKey } from "@repo/constants";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { downloadCsv } from "@/src/components/analytics/csv";
import { ParentDashboard, TeacherDashboard } from "@/src/components/analytics/dashboards";
import { formatPaise, INVOICE_STATUS_LABEL } from "@/src/components/fees/ui";
import { timeAgo } from "@/src/components/notification/ui";
import { visibleNavGroups } from "@/src/components/shell/nav-config";
import { EmptyState, Skeleton, StatusChip } from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Home dashboard (design handoff §1 — Dashboard.dc.html), role-aware. Admin/office
 * gets the full handoff layout: greeting + quick actions, 4 linked KPI cards, fee
 * collection bars + invoices-by-status donut, recent announcements, the dark
 * "Today at school" calendar promo, and the go-to-module chip grid. Teacher and
 * Parent keep their live dashboards restyled in the same language. Resolves the
 * DB profile (`auth.me`) and activates a first-time INVITED account, as before.
 * Presentation-only — nav gating reuses `visibleNavGroups`; no new API.
 */
const ROLE_LABEL: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  OFFICE_ADMIN: "Office Admin",
  TEACHER: "Teacher",
  PARENT: "Parent",
};

const TZ = "Asia/Kolkata";

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Today's date parts in school time. */
function todayParts() {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-IN", { weekday: "long", timeZone: TZ });
  const dateLine = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
  // en-CA gives YYYY-MM-DD, matching the calendar API's date strings.
  const isoDate = now.toLocaleDateString("en-CA", { timeZone: TZ });
  return { weekday, dateLine, isoDate };
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2026-07" → "Jul". */
function monthLabel(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTH_SHORT[m - 1] ?? ym;
}

export default function DashboardPage() {
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const register = trpc.auth.registerProfile.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
    },
  });

  useEffect(() => {
    if (me.data?.status === "INVITED" && register.isIdle) {
      register.mutate();
    }
  }, [me.data?.status, register]);

  if (me.isError) {
    return (
      <main className="mx-auto max-w-[1280px] p-6">
        <EmptyState
          title="Your account isn’t set up yet"
          message="Please contact the school office to finish activating your account."
        />
      </main>
    );
  }

  if (me.isLoading || me.data?.status !== "ACTIVE" || register.isPending) {
    return (
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-9 py-8">
        <Skeleton className="h-24 w-2/3" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-card" />
      </main>
    );
  }

  const role = me.data.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "OFFICE_ADMIN";
  const modules = visibleNavGroups(role)
    .flatMap((g) => g.items)
    .filter((i) => i.href !== "/dashboard");
  const moduleHrefs = new Set(modules.map((m) => m.href));
  const { weekday } = todayParts();

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-7 px-6 pb-12 pt-8 lg:px-9">
      {/* Greeting + quick actions */}
      <section className="flex animate-fade-up flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
            <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
            {weekday} overview
          </div>
          <h1 className="font-display text-[40px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            {greeting()}, <em className="text-maroon-700">{ROLE_LABEL[role]}</em>
          </h1>
          <p className="text-[14.5px] text-ink-500">
            Here is what needs your attention at school today.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2.5">
            {moduleHrefs.has("/attendance/mark") && (
              <QuickAction href="/attendance/mark" primary>
                Take attendance
              </QuickAction>
            )}
            {moduleHrefs.has("/fees") && <QuickAction href="/fees">Record a payment</QuickAction>}
            {moduleHrefs.has("/announcements") && (
              <QuickAction href="/announcements">New announcement</QuickAction>
            )}
          </div>
        )}
      </section>

      {isAdmin ? (
        <AdminOverview />
      ) : role === "TEACHER" ? (
        <div className="animate-fade-up [animation-delay:80ms]">
          <TeacherDashboard />
        </div>
      ) : role === "PARENT" ? (
        <div className="animate-fade-up [animation-delay:80ms]">
          <ParentDashboard />
        </div>
      ) : null}

      {/* Go to module */}
      {modules.length > 0 && (
        <section className="flex animate-fade-up flex-col gap-3 [animation-delay:240ms]">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
            <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
            Go to module
          </div>
          <div className="flex flex-wrap gap-2.5">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className="flex items-center gap-2 rounded-full border border-subtle bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50 hover:text-maroon-800"
                >
                  <Icon aria-hidden size={17} className="text-maroon-700" />
                  {m.label}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function QuickAction({
  href,
  primary,
  children,
}: {
  href: string;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex h-11 items-center rounded-full border border-maroon-700 bg-maroon-700 px-5 text-[14px] font-semibold text-cream-50 shadow-sm transition-[background-color,transform] duration-fast hover:-translate-y-0.5 hover:bg-maroon-800"
          : "inline-flex h-11 items-center rounded-full border border-strong bg-transparent px-5 text-[14px] font-semibold text-maroon-700 transition-[background-color,border-color,transform] duration-fast hover:-translate-y-0.5 hover:border-maroon-300 hover:bg-maroon-50"
      }
    >
      {children}
    </Link>
  );
}

/* ─────────────────────────────── admin overview ────────────────────────────── */

function AdminOverview() {
  const school = trpc.analytics.schoolSummary.useQuery();
  const collection = trpc.analytics.feeCollection.useQuery({});
  const s = school.data;

  const dueCount = (s?.fees.byStatus["ISSUED"] ?? 0) + (s?.fees.byStatus["PARTIAL"] ?? 0);

  return (
    <>
      {/* KPI row */}
      <section className="grid animate-fade-up grid-cols-1 gap-4 [animation-delay:80ms] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Students"
          value={s ? String(s.headcount) : "—"}
          icon={<Student size={18} aria-hidden />}
          iconClass="bg-maroon-50 text-maroon-700"
          footer={
            <>
              <span className="text-ink-500">Enrolled this year</span>
              <KpiLink href="/people/students">View people →</KpiLink>
            </>
          }
        />
        <KpiCard
          label="Attendance today"
          value={
            s ? (
              s.attendancePercentage === null ? (
                <span className="text-ink-400">Not marked</span>
              ) : (
                `${s.attendancePercentage}%`
              )
            ) : (
              "—"
            )
          }
          icon={<CalendarCheck size={18} aria-hidden />}
          iconClass="bg-amber-100 text-amber-600"
          footer={
            s?.attendancePercentage === null ? (
              <>
                <StatusChip tone="gold" dot label="Action needed" />
                <KpiLink href="/attendance/mark">Mark now →</KpiLink>
              </>
            ) : (
              <>
                <span className="text-ink-500">Across all sections</span>
                <KpiLink href="/attendance/summary">Open summary →</KpiLink>
              </>
            )
          }
        />
        <KpiCard
          label="Collected today"
          value={s ? formatPaise(s.collectionToday) : "—"}
          icon={<CurrencyInr size={18} aria-hidden />}
          iconClass="bg-green-100 text-green-600"
          footer={
            <>
              <span className="text-ink-500">Payments received</span>
              <KpiLink href="/fees">Record payment →</KpiLink>
            </>
          }
        />
        <KpiCard
          label="Outstanding"
          value={s ? formatPaise(s.fees.totalOutstanding) : "—"}
          icon={<WarningCircle size={18} aria-hidden />}
          iconClass="bg-red-100 text-red-600"
          footer={
            <>
              <span className="text-ink-500">
                {dueCount > 0 ? `${dueCount} invoice${dueCount === 1 ? "" : "s"} due` : "No dues"}
              </span>
              <KpiLink href="/fees">Review invoices →</KpiLink>
            </>
          }
        />
      </section>

      {/* Charts row */}
      <section className="grid animate-fade-up grid-cols-1 gap-4 [animation-delay:160ms] lg:grid-cols-[1.6fr_1fr]">
        <FeeCollectionCard
          monthly={collection.data?.monthly ?? []}
          loading={collection.isLoading}
        />
        <InvoiceStatusCard byStatus={s?.fees.byStatus ?? {}} loading={school.isLoading} />
      </section>

      {/* Announcements + Today */}
      <section className="grid animate-fade-up grid-cols-1 gap-4 [animation-delay:200ms] lg:grid-cols-[1.6fr_1fr]">
        <AnnouncementsCard />
        <TodayCard />
      </section>
    </>
  );
}

function KpiCard({
  label,
  value,
  icon,
  iconClass,
  footer,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  iconClass: string;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-subtle bg-white p-5 shadow-sm transition-[transform,box-shadow] duration-base hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-500">
          {label}
        </span>
        <span
          className={`flex size-[34px] items-center justify-center rounded-[10px] ${iconClass}`}
        >
          {icon}
        </span>
      </div>
      <div className="font-display text-[34px] font-medium leading-none text-ink-900">{value}</div>
      <div className="flex items-center gap-2 text-[12.5px]">{footer}</div>
    </div>
  );
}

function KpiLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="ml-auto font-semibold text-maroon-700 hover:text-maroon-800">
      {children}
    </Link>
  );
}

/** Handoff fee-collection bar chart — pure divs, hover reveals the value chip. */
function FeeCollectionCard({
  monthly,
  loading,
}: {
  monthly: { month: string; collected: number }[];
  loading: boolean;
}) {
  const [tip, setTip] = useState(-1);
  const bars = monthly.slice(-6);
  const max = Math.max(1, ...bars.map((b) => b.collected));
  const total = bars.reduce((a, b) => a + b.collected, 0);

  return (
    <div className="flex flex-col gap-[18px] rounded-card border border-subtle bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-lg font-semibold text-ink-900">Fee collection</span>
          <span className="text-[12.5px] text-ink-500">
            Last {bars.length || 6} months · hover a bar for details
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "fee-collection.csv",
              ["Month", "Collected (INR)"],
              bars.map((b) => [b.month, b.collected / 100]),
            )
          }
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
        >
          <DownloadSimple aria-hidden size={15} />
          Export CSV
        </button>
      </div>

      {loading ? (
        <Skeleton className="h-[220px]" />
      ) : bars.length === 0 ? (
        <p className="flex h-[220px] items-center justify-center text-sm text-ink-500">
          No payments recorded yet.
        </p>
      ) : (
        <div className="flex h-[220px] items-end gap-4 pt-7">
          {bars.map((bar, i) => {
            const last = i === bars.length - 1;
            const active = tip === i;
            return (
              <div
                key={bar.month}
                onMouseEnter={() => setTip(i)}
                onMouseLeave={() => setTip(-1)}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span
                  className={`whitespace-nowrap rounded-lg border border-maroon-200 bg-maroon-50 px-2 py-[3px] text-caption font-bold text-maroon-800 transition-opacity duration-fast ${active ? "opacity-100" : "opacity-0"}`}
                >
                  ₹{(bar.collected / 100).toLocaleString("en-IN")}
                </span>
                <div
                  style={{ height: `${Math.max(4, Math.round((bar.collected / max) * 170))}px` }}
                  className={`w-full max-w-14 cursor-pointer rounded-t-lg rounded-b-[3px] transition-colors duration-fast ${
                    last ? "bg-gold-500" : active ? "bg-maroon-500" : "bg-maroon-700"
                  }`}
                />
                <span className="text-caption font-semibold text-ink-500">
                  {monthLabel(bar.month)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-cream-100 pt-3 text-caption text-ink-500">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-maroon-700" />
          Collected
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-gold-500" />
          Current month
        </span>
        <span className="ml-auto">
          Total shown:{" "}
          <strong className="font-semibold text-ink-900">
            ₹{(total / 100).toLocaleString("en-IN")}
          </strong>
        </span>
      </div>
    </div>
  );
}

/** Donut segment colours per invoice status (handoff palette). */
const STATUS_COLOR: Record<string, string> = {
  PAID: "#3E7A4F", // green-600
  ISSUED: "#B07A1E", // amber-600
  PARTIAL: "#C29A45", // gold-500
  DRAFT: "#C9B89E", // sand-400
  CANCELLED: "#B6A998", // ink-300
  OVERDUE: "#B23A28", // red-600
};

function InvoiceStatusCard({
  byStatus,
  loading,
}: {
  byStatus: Record<string, number>;
  loading: boolean;
}) {
  const [seg, setSeg] = useState(-1);
  const entries = Object.entries(byStatus).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);

  // conic-gradient stops.
  let acc = 0;
  const stops = entries.map(([status, n]) => {
    const from = (acc / Math.max(1, total)) * 360;
    acc += n;
    const to = (acc / Math.max(1, total)) * 360;
    return `${STATUS_COLOR[status] ?? "#C9B89E"} ${from}deg ${to}deg`;
  });

  const monthName = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });

  return (
    <div className="flex flex-col gap-[18px] rounded-card border border-subtle bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-lg font-semibold text-ink-900">Invoices by status</span>
        <span className="text-[12.5px] text-ink-500">{monthName} billing cycle</span>
      </div>

      {loading ? (
        <Skeleton className="h-[132px]" />
      ) : total === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-sm text-ink-500">
          No invoices in this cycle yet.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative size-[132px] shrink-0">
            <div
              aria-hidden
              className="size-[132px] rounded-full"
              style={{ background: `conic-gradient(${stops.join(", ")})` }}
            />
            <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white">
              <span className="font-display text-[26px] font-semibold leading-none text-ink-900">
                {seg >= 0 && entries[seg] ? entries[seg][1] : total}
              </span>
              <span className="text-[11px] uppercase tracking-[0.08em] text-ink-500">
                {seg >= 0 && entries[seg]
                  ? (
                      INVOICE_STATUS_LABEL[entries[seg][0] as keyof typeof INVOICE_STATUS_LABEL] ??
                      entries[seg][0]
                    ).toLowerCase()
                  : "invoices"}
              </span>
            </div>
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            {entries.map(([status, n], i) => (
              <div
                key={status}
                onMouseEnter={() => setSeg(i)}
                onMouseLeave={() => setSeg(-1)}
                className={`flex cursor-default items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors duration-fast ${seg === i ? "bg-cream-100" : ""}`}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: STATUS_COLOR[status] ?? "#C9B89E" }}
                />
                <span className="flex-1 text-[13px] font-semibold text-ink-900">
                  {INVOICE_STATUS_LABEL[status as keyof typeof INVOICE_STATUS_LABEL] ?? status}
                </span>
                <span className="text-[13px] text-ink-500">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/fees"
        className="border-t border-cream-100 pt-3 text-[13px] font-semibold text-maroon-700 hover:text-maroon-800"
      >
        Review pending invoices →
      </Link>
    </div>
  );
}

const SCOPE_BADGE: Record<string, { label: string; tone: "brand" | "info" | "neutral" }> = {
  SCHOOL: { label: "Whole school", tone: "brand" },
  CLASS: { label: "Class", tone: "info" },
  SECTION: { label: "Section", tone: "info" },
};

function AnnouncementsCard() {
  const rows = trpc.announcement.list.useQuery({ limit: 5 });
  const items = (rows.data ?? []).slice(0, 3);

  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-subtle bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-semibold text-ink-900">
          Recent announcements
        </span>
        <Link
          href="/announcements"
          className="rounded-full border border-strong px-3.5 py-2 text-[13px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-300 hover:bg-maroon-50"
        >
          New announcement
        </Link>
      </div>

      <div className="flex flex-1 flex-col">
        {rows.isLoading ? (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-sm text-ink-500">Nothing announced yet.</p>
        ) : (
          items.map((a) => {
            const badge = SCOPE_BADGE[a.scope] ?? SCOPE_BADGE["SCHOOL"]!;
            return (
              <Link
                key={a.id}
                href="/announcements"
                className="flex items-center gap-3.5 rounded-xl px-2.5 py-3 transition-colors duration-fast hover:bg-cream-50"
              >
                <span className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-maroon-700">
                  <Megaphone aria-hidden size={19} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-ink-900">{a.title}</span>
                  <span className="truncate text-[12.5px] text-ink-500">
                    {badge.label}
                    {a.status === "DRAFT" ? " · draft" : ""}
                  </span>
                </span>
                <StatusChip
                  tone={badge.tone}
                  label={badge.label}
                  className="hidden sm:inline-flex"
                />
                <span className="w-14 shrink-0 text-right text-caption text-ink-400">
                  {timeAgo(a.publishedAt ?? a.createdAt)}
                </span>
              </Link>
            );
          })
        )}
      </div>

      <Link
        href="/announcements"
        className="border-t border-cream-100 pt-3 text-[13px] font-semibold text-maroon-700 hover:text-maroon-800"
      >
        All announcements →
      </Link>
    </div>
  );
}

function TodayCard() {
  const { dateLine, isoDate } = todayParts();
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const events = trpc.calendar.month.useQuery({ year, month }, { retry: false });

  const todays = (events.data ?? [])
    .filter((e) => e.startDate <= isoDate && isoDate <= e.endDate)
    .slice(0, 4);

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-card bg-maroon-900 p-6 text-cream-50">
      <img
        src="/assets/crest-cream.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-8 w-[170px] opacity-[0.06]"
      />
      <div className="relative flex flex-col gap-0.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-eyebrow text-gold-400">
          Today at school
        </span>
        <span className="font-display text-lg font-semibold">{dateLine}</span>
      </div>

      <div className="relative flex flex-1 flex-col gap-2.5">
        {events.isLoading ? (
          <>
            <Skeleton className="h-11 bg-cream-50/10" />
            <Skeleton className="h-11 bg-cream-50/10" />
          </>
        ) : todays.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-on-dark px-3.5 py-3">
            <span className="text-[13.5px] text-cream-50/85">
              Nothing scheduled today — enjoy the quiet.
            </span>
          </div>
        ) : (
          todays.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-on-dark bg-cream-50/[0.07] px-3.5 py-[11px]"
            >
              <span className="w-14 shrink-0 text-caption font-bold uppercase tracking-[0.04em] text-gold-400">
                {e.isAllDay ? "All day" : e.eventType.slice(0, 6)}
              </span>
              <span className="truncate text-[13.5px]">{e.title}</span>
            </div>
          ))
        )}
      </div>

      <Link
        href="/calendar"
        className="relative text-[13px] font-semibold text-gold-300 hover:text-gold-200"
      >
        Open school calendar →
      </Link>
    </div>
  );
}
