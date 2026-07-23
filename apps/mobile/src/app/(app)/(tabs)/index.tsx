import { useTranslation } from "@repo/i18n";
import { Link } from "expo-router";
import {
  AirplaneTilt,
  BookOpen,
  CaretRight,
  CheckCircle,
  Exam,
  Megaphone,
  PencilLine,
  Wallet,
  Warning,
} from "phosphor-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatDate } from "../../../components/announcements-ui";
import { ChildSwitcher } from "../../../components/child-switcher";
import { formatPaise } from "../../../components/fees-ui";
import { NotificationBell } from "../../../components/notifications-ui";
import { OfflineBanner } from "../../../components/offline-banner";
import { SyncQueueIndicator } from "../../../components/sync-queue-indicator";
import { trpc } from "../../../lib/trpc";

/**
 * Home tab — the role's landing screen, on the mobile design handoff:
 *   Parent  → fees-due hero + Pay now + attendance/homework tiles + latest feed
 *   Teacher → greeting + mark-attendance prompt + today's schedule + quick actions
 *   Admin   → school overview stat cards + "needs attention" queue
 */
export default function HomeTab() {
  const insets = useSafeAreaInsets();
  const role = trpc.auth.me.useQuery().data?.role;
  const isParent = role === "PARENT";
  const isTeacher = role === "TEACHER";

  return (
    <View className="flex-1 bg-neutral-50" style={{ paddingTop: insets.top }}>
      {isParent ? <ParentHome /> : isTeacher ? <TeacherToday /> : <AdminOverview />}
    </View>
  );
}

const dateLine = (): string =>
  new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

/* ─────────────────────────────── Parent ─────────────────────────────── */

function ParentHome() {
  const { dict } = useTranslation();
  const t = dict.home;
  const insets = useSafeAreaInsets();
  const students = trpc.student.list.useQuery();
  const overview = trpc.analytics.dashboard.useQuery(undefined);
  const announcements = trpc.announcement.list.useQuery({ limit: 5 });

  const analytics = overview.data?.role === "PARENT" ? overview.data.children : [];
  // Child roster (name-resolved) drives a switcher; the selected child fills the
  // hero/tiles. Defaults to the first child; parents with one child see no switcher.
  const kids = (students.data ?? []).map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? kids[0]?.id ?? null;
  const selected = analytics.find((c) => c.studentId === activeId) ?? analytics[0];
  const childName = kids.find((k) => k.id === activeId)?.name ?? t.yourChild;
  const dues = selected?.dues ?? 0;

  return (
    <>
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-1.5">
        <View className="size-11 items-center justify-center rounded-full bg-primary-700">
          <Text className="font-display text-body font-semibold text-neutral-50">
            {childName.charAt(0)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-sans text-caption text-neutral-500">{dict.auth.parent}</Text>
          <Text className="font-display text-title text-neutral-900" numberOfLines={1}>
            {childName}
          </Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pt-0.5 gap-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <OfflineBanner />
        <SyncQueueIndicator />

        {activeId ? (
          <ChildSwitcher students={kids} selected={activeId} onSelect={setSelectedId} />
        ) : null}

        <View className="gap-3 rounded-card bg-primary-900 p-5">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-eyebrow font-semibold uppercase tracking-eyebrow text-gold-400">
              {t.dues}
            </Text>
            <Wallet size={18} color="#D6B36A" />
          </View>
          <Text className="font-display text-display text-neutral-50">{formatPaise(dues)}</Text>
          {dues > 0 ? (
            <Link href="/fees" asChild>
              <Pressable className="mt-1 min-h-11 items-center justify-center rounded-xl bg-gold-500 active:opacity-90">
                <Text className="font-sans font-bold text-primary-950">{t.feesAndPayments}</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>

        {selected ? (
          <View className="flex-row gap-3">
            <StatTile
              Icon={CheckCircle}
              tint="green"
              value={
                selected.attendancePercentage === null ? "—" : `${selected.attendancePercentage}%`
              }
              label={t.attendance}
            />
            <StatTile
              Icon={BookOpen}
              tint="maroon"
              value={
                selected.homeworkCompletionRate === null
                  ? "—"
                  : `${Math.round(selected.homeworkCompletionRate * 100)}%`
              }
              label={t.homework}
            />
          </View>
        ) : null}

        <SectionRow title={t.recentAnnouncements} />
        <View className="gap-2.5">
          {(announcements.data ?? []).slice(0, 3).map((a) => (
            <Link key={a.id} href={`/announcements/${a.id}`} asChild>
              <Pressable className="flex-row items-start gap-3 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50">
                <View className="size-9 items-center justify-center rounded-[10px] bg-primary-50">
                  <Megaphone size={18} color="#7A3414" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="font-sans font-semibold text-neutral-900" numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text className="font-sans text-caption text-neutral-400">
                    {formatDate(a.publishedAt ?? a.createdAt)}
                  </Text>
                </View>
              </Pressable>
            </Link>
          ))}
          {!announcements.isLoading && (announcements.data ?? []).length === 0 ? (
            <Muted>{t.nothingNew}</Muted>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

/* ─────────────────────────────── Teacher ─────────────────────────────── */

function TeacherToday() {
  const { dict } = useTranslation();
  const t = dict.home;
  const insets = useSafeAreaInsets();
  const today = trpc.timetable.today.useQuery({});
  const rows = today.data ?? [];

  return (
    <>
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-1.5">
        <View className="flex-1">
          <Text className="font-sans text-caption text-neutral-500">{dateLine()}</Text>
          <Text className="font-display text-title text-neutral-900">{dict.tabs.today}</Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pt-0.5 gap-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <OfflineBanner />
        <SyncQueueIndicator />

        <Link href="/attendance/sections" asChild>
          <Pressable className="flex-row items-center gap-3 rounded-card border border-gold-300 bg-gold-100 p-4 active:opacity-90">
            <View className="size-10 items-center justify-center rounded-xl bg-gold-500">
              <Warning size={19} color="#2E1207" weight="bold" />
            </View>
            <View className="flex-1">
              <Text className="font-sans font-semibold text-neutral-900">{t.markAttendance}</Text>
              <Text className="font-sans text-caption text-neutral-600">{t.attendanceHint}</Text>
            </View>
            <CaretRight size={18} color="#8A661F" weight="bold" />
          </Pressable>
        </Link>

        <SectionRow title={t.todaysSchedule} />
        <View className="gap-2.5">
          {today.isLoading ? (
            <Muted>{dict.common.loading}</Muted>
          ) : rows.length === 0 ? (
            <Muted>{t.noClassesToday}</Muted>
          ) : (
            rows.map((e) => (
              <View
                key={e.id}
                className="flex-row items-center gap-3 rounded-card border border-subtle bg-card p-4 shadow-sm"
              >
                <View className="min-w-[46px] items-center">
                  <Text className="font-sans text-sm font-bold text-primary-800">
                    {e.startTime}
                  </Text>
                </View>
                <View className="h-8 w-px bg-neutral-200" />
                <View className="flex-1">
                  <Text className="font-sans font-semibold text-neutral-900">{e.subjectName}</Text>
                  <Text className="font-sans text-caption text-neutral-500">
                    {e.sectionName}
                    {e.room ? ` · ${e.room}` : ""}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <SectionRow title={t.quickActions} />
        <View className="flex-row gap-3">
          <QuickAction Icon={BookOpen} tint="maroon" label={t.homework} href="/homework/new" />
          <QuickAction Icon={Exam} tint="gold" label={t.enterMarks} href="/exam/markable" />
        </View>
      </ScrollView>
    </>
  );
}

/* ─────────────────────────────── Admin ─────────────────────────────── */

function AdminOverview() {
  const { dict } = useTranslation();
  const t = dict.home;
  const insets = useSafeAreaInsets();
  const overview = trpc.analytics.dashboard.useQuery(undefined);
  const school = overview.data?.role === "ADMIN" ? overview.data.school : null;

  return (
    <>
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-1.5">
        <View className="flex-1">
          <Text className="font-sans text-caption text-neutral-500">{dateLine()}</Text>
          <Text className="font-display text-title text-neutral-900">{t.schoolAtAGlance}</Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pt-0.5 gap-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <OfflineBanner />
        <SyncQueueIndicator />

        {school ? (
          <>
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1.5 rounded-card bg-primary-900 p-4">
                <Text className="font-sans text-eyebrow font-semibold uppercase tracking-eyebrow text-gold-400">
                  {t.attendance}
                </Text>
                <Text className="font-display text-2xl text-neutral-50">
                  {school.attendancePercentage === null ? "—" : `${school.attendancePercentage}%`}
                </Text>
                <Text className="font-sans text-caption text-neutral-50/60">
                  {school.headcount} {t.students}
                </Text>
              </View>
              <View className="flex-1 gap-1.5 rounded-card border border-subtle bg-card p-4 shadow-sm">
                <Text className="font-sans text-eyebrow font-semibold uppercase tracking-eyebrow text-neutral-500">
                  {t.outstanding}
                </Text>
                <Text className="font-display text-2xl text-primary-800">
                  {formatPaise(school.fees.totalOutstanding)}
                </Text>
                <Text className="font-sans text-caption text-neutral-400">
                  {formatPaise(school.collectionToday)} · {t.collectedToday}
                </Text>
              </View>
            </View>

            <SectionRow title={t.needsAttention} />
            <View className="gap-2.5">
              <AttentionRow
                Icon={AirplaneTilt}
                tint="gold"
                label={t.leaveRequests}
                href="/attendance/leave"
              />
              <AttentionRow
                Icon={PencilLine}
                tint="maroon"
                label={t.myCorrections}
                href="/attendance/my-corrections"
              />
            </View>
          </>
        ) : overview.isLoading ? (
          <Muted>{dict.common.loading}</Muted>
        ) : null}
      </ScrollView>
    </>
  );
}

/* ─────────────────────────────── shared bits ─────────────────────────────── */

type Tint = "maroon" | "green" | "gold";
const TINT: Record<Tint, { bg: string; fg: string }> = {
  maroon: { bg: "bg-primary-50", fg: "#7A3414" },
  green: { bg: "bg-success-100", fg: "#2F7A46" },
  gold: { bg: "bg-gold-100", fg: "#8A661F" },
};

function StatTile({
  Icon,
  tint,
  value,
  label,
}: {
  Icon: typeof BookOpen;
  tint: Tint;
  value: string;
  label: string;
}) {
  return (
    <View className="flex-1 gap-2 rounded-card border border-subtle bg-card p-4 shadow-sm">
      <View className={`size-9 items-center justify-center rounded-[10px] ${TINT[tint].bg}`}>
        <Icon size={17} color={TINT[tint].fg} weight="bold" />
      </View>
      <Text className="font-display text-2xl text-neutral-900">{value}</Text>
      <Text className="font-sans text-caption text-neutral-500">{label}</Text>
    </View>
  );
}

function QuickAction({
  Icon,
  tint,
  label,
  href,
}: {
  Icon: typeof BookOpen;
  tint: Tint;
  label: string;
  href: string;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable className="flex-1 gap-2.5 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50">
        <View className={`size-9 items-center justify-center rounded-[11px] ${TINT[tint].bg}`}>
          <Icon size={18} color={TINT[tint].fg} weight="bold" />
        </View>
        <Text className="font-sans font-semibold text-neutral-900">{label}</Text>
      </Pressable>
    </Link>
  );
}

function AttentionRow({
  Icon,
  tint,
  label,
  href,
}: {
  Icon: typeof BookOpen;
  tint: Tint;
  label: string;
  href: string;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable className="flex-row items-center gap-3 rounded-card border border-subtle bg-card p-3.5 shadow-sm active:bg-neutral-50">
        <View className={`size-9 items-center justify-center rounded-[10px] ${TINT[tint].bg}`}>
          <Icon size={17} color={TINT[tint].fg} />
        </View>
        <Text className="flex-1 font-sans font-semibold text-neutral-900">{label}</Text>
        <CaretRight size={16} color="#948676" weight="bold" />
      </Pressable>
    </Link>
  );
}

function SectionRow({ title }: { title: string }) {
  return <Text className="font-display text-title text-neutral-900">{title}</Text>;
}

function Muted({ children }: { children: ReactNode }) {
  return <Text className="font-sans text-sm text-neutral-500">{children}</Text>;
}
