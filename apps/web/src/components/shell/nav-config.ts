import { type Icon } from "@phosphor-icons/react";
import {
  BookOpen,
  Buildings,
  CalendarBlank,
  CalendarCheck,
  ChatCircleText,
  Clock,
  CreditCard,
  FileText,
  Gear,
  GraduationCap,
  Megaphone,
  ShieldCheck,
  SquaresFour,
  Users,
} from "@phosphor-icons/react";
import { PERMISSIONS, type Permission, type RoleKey } from "@repo/constants";
import { can } from "@repo/core";

/**
 * Sidebar navigation config (ADR-UX1 §3, restyled per the design handoff —
 * Phosphor icons, handoff nav order/labels). The `permission` gate on each item
 * is the EXACT same `can(role, …)` check the dashboard used — presentation moves
 * to the sidebar, the gating is unchanged. `href` is the module landing route.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Omitted = always visible (Dashboard). */
  permission?: Permission;
  /**
   * Roles for which this item is suppressed even if they hold `permission`.
   * Used to keep staff-oriented routes out of the PARENT sidebar (the parent
   * portal is mobile-first; those web routes 403/lead to admin views — BUG-5).
   */
  hideForRoles?: RoleKey[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "",
    items: [{ href: "/dashboard", label: "Dashboard", icon: SquaresFour }],
  },
  {
    label: "Academics",
    items: [
      {
        href: "/academic/years",
        label: "Academic structure",
        icon: Buildings,
        permission: PERMISSIONS.ACADEMIC_READ,
      },
      {
        href: "/exams",
        label: "Examinations",
        icon: GraduationCap,
        permission: PERMISSIONS.EXAM_MANAGE,
      },
      {
        // Teacher marks-entry surface (BUG-4). Admins manage exams via /exams above
        // (they hold EXAM_MANAGE); teachers hold marks:enter but not exam:manage, so
        // this is their only Examinations entry point. Hidden for admins to avoid a
        // duplicate Examinations link.
        href: "/exams/marks",
        label: "Examinations",
        icon: GraduationCap,
        permission: PERMISSIONS.MARK_ENTER,
        hideForRoles: ["SUPER_ADMIN", "OFFICE_ADMIN"],
      },
      {
        href: "/homework",
        label: "Homework",
        icon: BookOpen,
        permission: PERMISSIONS.HOMEWORK_READ,
      },
      {
        href: "/timetable",
        label: "Timetable",
        icon: Clock,
        permission: PERMISSIONS.TIMETABLE_MANAGE,
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        href: "/people/students",
        label: "People",
        icon: Users,
        permission: PERMISSIONS.STUDENT_READ,
        // Parents hold student:read (own child) but this is the admin roster; their
        // people view lives on mobile (BUG-5).
        hideForRoles: ["PARENT"],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/attendance/mark",
        label: "Attendance",
        icon: CalendarCheck,
        permission: PERMISSIONS.ATTENDANCE_READ,
        // This is the staff marking screen (class.list 403s for parents). Parents
        // read their child's attendance on mobile (BUG-5).
        hideForRoles: ["PARENT"],
      },
      {
        href: "/behaviour",
        label: "Behaviour & discipline",
        icon: ShieldCheck,
        permission: PERMISSIONS.BEHAVIOUR_MANAGE,
      },
      {
        href: "/fees",
        label: "Fees & payments",
        icon: CreditCard,
        permission: PERMISSIONS.FEE_MANAGE,
      },
      {
        href: "/documents",
        label: "Documents & certificates",
        icon: FileText,
        permission: PERMISSIONS.DOCUMENT_READ,
      },
      {
        href: "/settings",
        label: "Administration",
        icon: Gear,
        permission: PERMISSIONS.SETTINGS_MANAGE,
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        href: "/messages",
        label: "Messages",
        icon: ChatCircleText,
        permission: PERMISSIONS.MESSAGE_READ,
      },
      {
        href: "/announcements",
        label: "Announcements",
        icon: Megaphone,
        permission: PERMISSIONS.ANNOUNCEMENT_READ,
      },
      {
        href: "/calendar",
        label: "School calendar",
        icon: CalendarBlank,
        permission: PERMISSIONS.CALENDAR_READ,
      },
    ],
  },
];

/** Groups with only the items this role may see (same gating as before). */
export function visibleNavGroups(role: RoleKey): NavGroup[] {
  return GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter(
      (i) => (!i.permission || can(role, i.permission)) && !i.hideForRoles?.includes(role),
    ),
  })).filter((g) => g.items.length > 0);
}

/** Best-match page label for the breadcrumb ("School portal / {Page}"). */
export function pageLabelFor(pathname: string): string {
  const all = GROUPS.flatMap((g) => g.items);
  const hit = all.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  if (hit) return hit.label;
  // Routes reachable outside the nav config.
  if (pathname.startsWith("/report-cards")) return "Report cards";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/academic")) return "Academic structure";
  if (pathname.startsWith("/attendance")) return "Attendance";
  if (pathname.startsWith("/people")) return "People";
  return "Dashboard";
}
