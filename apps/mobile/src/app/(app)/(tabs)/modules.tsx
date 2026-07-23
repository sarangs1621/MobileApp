import { PERMISSIONS, type Permission } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import { Link, type Href } from "expo-router";
import {
  Buildings,
  CalendarBlank,
  ChatCircleText,
  Clock,
  CreditCard,
  FileText,
  Gear,
  GraduationCap,
  Megaphone,
  ShieldCheck,
  Users,
} from "phosphor-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HubHeader } from "../../../components/nav-menu";
import type { PhosphorIcon } from "../../../components/ui/icon";
import { trpc } from "../../../lib/trpc";

/**
 * Admin "Modules" tab — the office in your pocket, as a 2-column icon grid
 * (design handoff). Every management area, permission-gated so Accountant sees
 * only finance, Office Admin the middle set, Super Admin everything.
 */
export default function ModulesTab() {
  const { dict } = useTranslation();
  const t = dict.home;
  const insets = useSafeAreaInsets();
  const role = trpc.auth.me.useQuery().data?.role;
  const has = (p: Permission) => role !== undefined && can(role, p);

  const modules: { perm: Permission; icon: PhosphorIcon; href: Href; label: string; tint: Tint }[] =
    [
      {
        perm: PERMISSIONS.ACADEMIC_READ,
        icon: Buildings,
        href: "/academic/years",
        label: t.academicStructure,
        tint: "maroon",
      },
      {
        perm: PERMISSIONS.MARK_ENTER,
        icon: GraduationCap,
        href: "/exam/markable",
        label: t.examinations,
        tint: "gold",
      },
      {
        perm: PERMISSIONS.STUDENT_READ,
        icon: Users,
        href: "/people/students",
        label: t.people,
        tint: "maroon",
      },
      { perm: PERMISSIONS.FEE_READ, icon: CreditCard, href: "/fees", label: t.fees, tint: "gold" },
      {
        perm: PERMISSIONS.HOMEWORK_MANAGE,
        icon: Clock,
        href: "/homework",
        label: t.homework,
        tint: "maroon",
      },
      {
        perm: PERMISSIONS.BEHAVIOUR_MANAGE,
        icon: ShieldCheck,
        href: "/behaviour",
        label: t.behaviourAndDiscipline,
        tint: "gold",
      },
      {
        perm: PERMISSIONS.DOCUMENT_READ,
        icon: FileText,
        href: "/documents",
        label: t.documents,
        tint: "maroon",
      },
      {
        perm: PERMISSIONS.ANNOUNCEMENT_READ,
        icon: Megaphone,
        href: "/announcements",
        label: t.announcements,
        tint: "gold",
      },
      {
        perm: PERMISSIONS.CALENDAR_READ,
        icon: CalendarBlank,
        href: "/calendar",
        label: t.schoolCalendar,
        tint: "maroon",
      },
      {
        perm: PERMISSIONS.MESSAGE_READ,
        icon: ChatCircleText,
        href: "/messages",
        label: t.messages,
        tint: "gold",
      },
      {
        perm: PERMISSIONS.SETTINGS_MANAGE,
        icon: Gear,
        href: "/settings",
        label: t.settings,
        tint: "maroon",
      },
    ];
  const visible = modules.filter((m) => has(m.perm));

  return (
    <View className="flex-1 bg-neutral-50">
      <HubHeader title={dict.tabs.modules} subtitle={t.manageEveryPart} />
      <ScrollView
        contentContainerClassName="p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="flex-row flex-wrap gap-3">
          {visible.map((m) => (
            <ModuleCard key={m.label} icon={m.icon} label={m.label} href={m.href} tint={m.tint} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

type Tint = "maroon" | "gold";
const TINT: Record<Tint, { bg: string; fg: string }> = {
  maroon: { bg: "bg-primary-50", fg: "#7A3414" },
  gold: { bg: "bg-gold-100", fg: "#8A661F" },
};

function ModuleCard({
  icon: Icon,
  label,
  href,
  tint,
}: {
  icon: PhosphorIcon;
  label: string;
  href: Href;
  tint: Tint;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        className="min-w-[45%] flex-1 gap-2.5 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50"
      >
        <View className={`size-10 items-center justify-center rounded-xl ${TINT[tint].bg}`}>
          <Icon size={20} color={TINT[tint].fg} />
        </View>
        <Text className="font-sans font-semibold text-neutral-900">{label}</Text>
      </Pressable>
    </Link>
  );
}
