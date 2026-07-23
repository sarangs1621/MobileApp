import { useTranslation } from "@repo/i18n";
import { Tabs } from "expo-router";
import {
  Bell,
  CalendarCheck,
  Chalkboard,
  DotsThreeOutline,
  GridFour,
  House,
  SquaresFour,
  UserCircle,
  Wallet,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PhosphorIcon } from "../../../components/ui/icon";
import { trpc } from "../../../lib/trpc";

const ACTIVE = "#7A3414"; // maroon-700
const INACTIVE = "#948676"; // sand/ink-muted

/** Filled Phosphor glyph when the tab is focused, regular otherwise (design handoff). */
function tabIcon(Icon: PhosphorIcon) {
  return function TabIcon({ color, focused }: { color: string; focused: boolean }) {
    return <Icon color={color} size={24} weight={focused ? "fill" : "regular"} />;
  };
}

/** A tab is hidden by giving it `href: null`; visible tabs pass `undefined`. */
const show = (visible: boolean): { href?: null } => (visible ? {} : { href: null });

/** A badge count → the tab-bar badge value (undefined hides it). */
const badge = (n: number): number | undefined => (n > 0 ? n : undefined);

/**
 * Role-aware bottom tab bar (design handoff). One tab set is declared; each role
 * sees only its four tabs via `href: null` on the rest, in this declared order:
 *   Parent  → Home · Attendance · Fees · More
 *   Teacher → Today · Attendance · Classes · More
 *   Admin   → Overview · Modules · Alerts · Profile
 * Deep routes live in the parent (app) stack and push OVER the tab bar.
 */
export default function TabsLayout() {
  const { dict } = useTranslation();
  const t = dict.tabs;
  const insets = useSafeAreaInsets();
  const role = trpc.auth.me.useQuery().data?.role;

  const isParent = role === "PARENT";
  const isTeacher = role === "TEACHER";
  const isAdmin = role === "SUPER_ADMIN" || role === "OFFICE_ADMIN" || role === "ACCOUNTANT";

  // Badges (design: counts sit on Alerts / Messages-in-More). Gated to avoid 403s.
  const unreadMessages =
    trpc.message.unreadCount.useQuery(undefined, {
      enabled: isParent || isTeacher,
      refetchInterval: 30_000,
      retry: false,
    }).data?.count ?? 0;
  const unreadAlerts =
    trpc.notification.unreadCount.useQuery(undefined, {
      enabled: isAdmin,
      refetchInterval: 30_000,
      retry: false,
    }).data ?? 0;

  const homeTitle = isParent ? t.home : isTeacher ? t.today : t.overview;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E0D3BF",
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 10.5 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: homeTitle, tabBarIcon: tabIcon(isAdmin ? SquaresFour : House) }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: t.attendance,
          tabBarIcon: tabIcon(CalendarCheck),
          ...show(isParent || isTeacher),
        }}
      />
      <Tabs.Screen
        name="fees"
        options={{ title: t.fees, tabBarIcon: tabIcon(Wallet), ...show(isParent) }}
      />
      <Tabs.Screen
        name="classes"
        options={{ title: t.classes, tabBarIcon: tabIcon(Chalkboard), ...show(isTeacher) }}
      />
      <Tabs.Screen
        name="modules"
        options={{ title: t.modules, tabBarIcon: tabIcon(GridFour), ...show(isAdmin) }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t.alerts,
          tabBarIcon: tabIcon(Bell),
          tabBarBadge: badge(unreadAlerts),
          ...show(isAdmin),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t.more,
          tabBarIcon: tabIcon(DotsThreeOutline),
          tabBarBadge: badge(unreadMessages),
          ...show(isParent || isTeacher),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t.profile, tabBarIcon: tabIcon(UserCircle), ...show(isAdmin) }}
      />
    </Tabs>
  );
}
