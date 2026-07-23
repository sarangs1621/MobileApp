import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import { Link, type Href } from "expo-router";
import { CaretRight, SignOut } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "../lib/trpc";
import { useAuthStore } from "../stores/auth-store";
import { useOfflineQueueStore } from "../stores/offline-queue-store";

/** Serif screen header for the tab hubs (safe-area aware, no back button). */
export function HubHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: insets.top + 12 }}
      className="border-b border-subtle bg-white px-5 pb-3"
    >
      <Text className="font-display text-title text-neutral-900">{title}</Text>
      {subtitle ? (
        <Text className="font-sans text-caption text-neutral-500">{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** A titled card grouping related nav rows. */
export function NavCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2 rounded-card border border-subtle bg-card p-4 shadow-sm">
      <Text className="font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** A single navigation row → pushes a route onto the (app) stack, over the tabs. */
export function NavLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        className="min-h-12 flex-row items-center gap-3 rounded-xl border border-subtle bg-neutral-50 px-4 active:bg-primary-50"
      >
        <Text className="flex-1 font-sans font-semibold text-neutral-900">{label}</Text>
        <CaretRight size={16} color="#948676" weight="bold" />
      </Pressable>
    </Link>
  );
}

/** Sign-out row — guards against dropping unsynced offline attendance (OFFLINE_STRATEGY). */
export function LogoutRow() {
  const { dict } = useTranslation();
  const logout = useAuthStore((state) => state.logout);
  const me = trpc.auth.me.useQuery();

  const onPress = () => {
    const myId = me.data?.userId;
    const { queue, purgeUser } = useOfflineQueueStore.getState();
    const unsynced = queue.filter((e) => !myId || e.userId === myId);
    if (unsynced.length === 0) {
      void logout();
      return;
    }
    Alert.alert(dict.sync.logoutUnsyncedTitle, dict.sync.logoutUnsyncedBody(unsynced.length), [
      { text: dict.sync.cancel, style: "cancel" },
      {
        text: dict.sync.logoutDiscard,
        style: "destructive",
        onPress: () => {
          unsynced.forEach((e) => purgeUser(e.userId));
          void logout();
        },
      },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 flex-row items-center justify-center gap-2 rounded-pill border border-strong bg-white px-5 active:bg-primary-50"
    >
      <SignOut size={18} color="#642811" weight="bold" />
      <Text className="font-sans font-semibold text-primary-700">{dict.home.logOut}</Text>
    </Pressable>
  );
}

/**
 * The permission-gated navigation hub, shared by the "More" (parent/teacher) and
 * "Modules" (admin) tabs. The same sections are rendered for every role; the
 * `can(role, …)` checks (unchanged from the old home) naturally scope each role
 * to its own subset. Deep routes push onto the (app) stack, over the tab bar.
 */
export function NavHubScreen({ title }: { title: string }) {
  const { dict } = useTranslation();
  const t = dict.home;
  const insets = useSafeAreaInsets();
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;

  const has = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) =>
    role !== undefined && can(role, p);
  const isParent = role === "PARENT";

  const canReadMessages = has(PERMISSIONS.MESSAGE_READ);
  const unreadMessages =
    trpc.message.unreadCount.useQuery(undefined, {
      enabled: canReadMessages,
      refetchInterval: 30_000,
      retry: false,
    }).data?.count ?? 0;

  const canReadAcademic = has(PERMISSIONS.ACADEMIC_READ);
  const canReadStudents = has(PERMISSIONS.STUDENT_READ);
  const canReadParents = has(PERMISSIONS.PARENT_READ);
  const canReadStaff = has(PERMISSIONS.STAFF_READ);
  const canMarkAttendance = has(PERMISSIONS.ATTENDANCE_MARK);
  const canSubmitCorrection = has(PERMISSIONS.ATTENDANCE_CORRECT_SUBMIT);
  const canApplyLeave = has(PERMISSIONS.LEAVE_APPLY);
  const canReadAttendance = has(PERMISSIONS.ATTENDANCE_READ);
  const canEnterMarks = has(PERMISSIONS.MARK_ENTER);
  const canReadMarks = has(PERMISSIONS.MARK_READ);
  const canManageHomework = has(PERMISSIONS.HOMEWORK_MANAGE);
  const canReadHomework = has(PERMISSIONS.HOMEWORK_READ);
  const canReadReportCards = has(PERMISSIONS.REPORT_CARD_READ);
  const canReadTimetable = has(PERMISSIONS.TIMETABLE_READ);
  const showTimetable = canReadTimetable && (role === "TEACHER" || isParent);
  const canReadAnnouncements = has(PERMISSIONS.ANNOUNCEMENT_READ);
  const canReadCalendar = has(PERMISSIONS.CALENDAR_READ);
  const canReadBehaviour = has(PERMISSIONS.BEHAVIOUR_READ);
  const canRecordBehaviour = has(PERMISSIONS.BEHAVIOUR_RECORD) || has(PERMISSIONS.BEHAVIOUR_MANAGE);
  const canReadFees = has(PERMISSIONS.FEE_READ);
  const canManageFees = has(PERMISSIONS.FEE_MANAGE);
  const canReadDocuments = has(PERMISSIONS.DOCUMENT_READ);
  const canManageDocuments = has(PERMISSIONS.DOCUMENT_MANAGE);
  const canManageSettings = has(PERMISSIONS.SETTINGS_MANAGE);

  return (
    <View className="flex-1 bg-neutral-50">
      <HubHeader title={title} />
      <ScrollView
        contentContainerClassName="p-4 gap-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {canReadAcademic ? (
          <NavCard title={t.academicStructure}>
            <NavLink href="/academic/years" label={t.academicYears} />
            <NavLink href="/academic/classes" label={t.classes} />
            <NavLink href="/academic/subjects" label={t.subjects} />
            <NavLink href="/academic/assignments" label={t.teacherAssignments} />
            <NavLink href="/academic/class-teachers" label={t.classTeachers} />
          </NavCard>
        ) : null}

        {canReadStudents || canReadParents || canReadStaff ? (
          <NavCard title={t.people}>
            {canReadStudents ? <NavLink href="/people/students" label={t.students} /> : null}
            {canReadParents ? <NavLink href="/people/parents" label={t.parents} /> : null}
            {canReadStaff ? (
              <NavLink href="/people/teacher-profiles" label={t.teacherProfiles} />
            ) : null}
          </NavCard>
        ) : null}

        {canReadAttendance ? (
          <NavCard title={t.attendance}>
            {canMarkAttendance ? (
              <NavLink href="/attendance/sections" label={t.markAttendance} />
            ) : null}
            {canSubmitCorrection ? (
              <NavLink href="/attendance/my-corrections" label={t.myCorrections} />
            ) : null}
            {canApplyLeave ? <NavLink href="/attendance/leave" label={t.leaveRequests} /> : null}
            <Text className="px-1 text-xs text-muted-foreground">{t.attendanceHint}</Text>
          </NavCard>
        ) : null}

        {canEnterMarks || (canReadMarks && isParent) ? (
          <NavCard title={t.examinations}>
            {canEnterMarks ? <NavLink href="/exam/markable" label={t.enterMarks} /> : null}
            {canReadMarks && isParent ? (
              <NavLink href="/exam/children" label={t.marksAndGrades} />
            ) : null}
          </NavCard>
        ) : null}

        {canManageHomework || (canReadHomework && isParent) ? (
          <NavCard title={t.homework}>
            <NavLink
              href="/homework"
              label={canManageHomework ? t.homework : t.myChildrensHomework}
            />
          </NavCard>
        ) : null}

        {canReadReportCards && isParent ? (
          <NavCard title={t.reportCards}>
            <NavLink href="/report-cards/children" label={t.myChildrensReportCards} />
          </NavCard>
        ) : null}

        {showTimetable ? (
          <NavCard title={t.timetable}>
            <NavLink
              href="/timetable"
              label={isParent ? t.myChildrensTimetable : t.myWeeklyTimetable}
            />
          </NavCard>
        ) : null}

        {canReadBehaviour ? (
          <NavCard title={t.behaviourAndDiscipline}>
            {isParent ? (
              <NavLink href="/behaviour/children" label={t.myChildrensBehaviour} />
            ) : canRecordBehaviour ? (
              <NavLink href="/behaviour" label={t.myBehaviourReferrals} />
            ) : null}
            {!isParent ? (
              <Text className="px-1 text-xs text-muted-foreground">{t.behaviourHint}</Text>
            ) : null}
          </NavCard>
        ) : null}

        {canReadFees ? (
          <NavCard title={t.fees}>
            <NavLink
              href="/fees"
              label={
                canManageFees ? t.feesAndPayments : isParent ? t.myChildrensFees : t.studentFees
              }
            />
            {isParent ? (
              <Text className="px-1 text-xs text-muted-foreground">{t.feesHint}</Text>
            ) : null}
          </NavCard>
        ) : null}

        {canReadDocuments ? (
          <NavCard title={t.documents}>
            <NavLink
              href="/documents"
              label={
                canManageDocuments
                  ? t.documentsAndCertificates
                  : isParent
                    ? t.myChildrensDocuments
                    : t.studentDocuments
              }
            />
            {isParent ? (
              <Text className="px-1 text-xs text-muted-foreground">{t.documentsHint}</Text>
            ) : null}
          </NavCard>
        ) : null}

        {canReadAnnouncements || canReadCalendar || canReadMessages ? (
          <NavCard title={t.communication}>
            {canReadMessages ? (
              <NavLink
                href="/messages"
                label={unreadMessages > 0 ? `${t.messages} (${unreadMessages})` : t.messages}
              />
            ) : null}
            {canReadAnnouncements ? (
              <NavLink href="/announcements" label={t.announcements} />
            ) : null}
            {canReadCalendar ? <NavLink href="/calendar" label={t.schoolCalendar} /> : null}
          </NavCard>
        ) : null}

        <NavCard title={t.settings}>
          <NavLink
            href="/settings"
            label={canManageSettings ? t.schoolConfiguration : t.preferences}
          />
        </NavCard>

        <LogoutRow />
      </ScrollView>
    </View>
  );
}
