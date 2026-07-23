"use client";

import { SignOut } from "@phosphor-icons/react";
import { signOut } from "@repo/auth";
import type { RoleKey } from "@repo/constants";
import { cn } from "@repo/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar } from "@/src/components/ui";
import { getSupabaseClient } from "@/src/lib/supabase/client";
import { trpc } from "@/src/trpc/react";

import { visibleNavGroups } from "./nav-config";

const ROLE_LABEL: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  OFFICE_ADMIN: "Office Admin",
  TEACHER: "Teacher",
  PARENT: "Parent",
  ACCOUNTANT: "Accountant",
};

/**
 * Fixed left sidebar (design handoff, global shell). Maroon-950 surface, crest +
 * serif school name + gold eyebrow header, nav grouped under gold uppercase
 * section labels, crest watermark, signed-in footer. Active item: translucent
 * cream fill + inset gold bar + bold gold icon. Collapses to icons below xl
 * (1280px). Gating is unchanged (`visibleNavGroups` reuses `can(role, …)`).
 */
export function Sidebar({ role }: { role: RoleKey }) {
  const pathname = usePathname();
  const router = useRouter();
  const groups = visibleNavGroups(role);
  // `auth.me` returns only the DB Principal (role/schoolId/status) — no display
  // name. Showing the role here; a real name needs a `name` on auth.me (future).
  const label = ROLE_LABEL[role];

  // Unread-messages badge — only for roles that can even see Messages (avoids 403s).
  const hasMessages = groups.some((g) => g.items.some((i) => i.href === "/messages"));
  const unread = trpc.message.unreadCount.useQuery(undefined, {
    enabled: hasMessages,
    refetchInterval: 30_000,
    retry: false,
  });
  const unreadCount = unread.data?.count ?? 0;

  async function logout() {
    await signOut(getSupabaseClient());
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside
      data-surface="dark"
      className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col overflow-hidden bg-maroon-950 text-cream-50 xl:w-[264px]"
    >
      {/* Header: crest + serif name + gold eyebrow */}
      <div className="flex items-center gap-3 border-b border-on-dark px-3 py-4 xl:px-5 xl:pb-[18px] xl:pt-5">
        <img
          src="/assets/crest-cream.png"
          alt="School crest"
          className="size-[38px] shrink-0 object-contain"
        />
        <div className="hidden min-w-0 flex-col gap-0.5 xl:flex">
          <span className="truncate font-display text-base font-semibold tracking-[0.01em]">
            Sri Gujarati Vidyalaya
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-gold-400">
            School portal · Est. 1869
          </span>
        </div>
      </div>

      <nav className="relative z-10 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-5 pt-3.5 xl:px-3">
        {groups.map((group, gi) => (
          <div key={group.label || gi} className="flex flex-col gap-0.5">
            {group.label && (
              <p className="hidden px-3 pb-1.5 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gold-400 xl:block">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-3 rounded-[10px] px-3 text-sm transition-colors duration-fast",
                    active
                      ? "bg-cream-50/[0.14] py-2.5 font-semibold text-cream-50 shadow-[inset_3px_0_0_#C29A45]"
                      : "py-[9px] text-cream-50/[0.82] hover:bg-cream-50/[0.08] hover:text-cream-50",
                  )}
                >
                  <Icon
                    aria-hidden
                    size={18}
                    weight={active ? "bold" : "regular"}
                    className={cn("shrink-0", active ? "text-gold-400" : "opacity-85")}
                  />
                  <span className="hidden truncate xl:block">{item.label}</span>
                  {item.href === "/messages" && unreadCount > 0 ? (
                    <span
                      aria-label={`${unreadCount} unread messages`}
                      className="ml-auto hidden min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1.5 py-px text-[10.5px] font-bold text-maroon-950 xl:inline-flex"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Crest watermark */}
      <img
        src="/assets/crest-cream.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 opacity-5"
      />

      {/* Footer: avatar + role + sign out */}
      <div className="relative z-10 flex items-center gap-3 border-t border-on-dark px-2 py-3.5 xl:px-4">
        <Avatar name={label} size="sm" />
        <div className="hidden min-w-0 flex-1 flex-col gap-px xl:flex">
          <span className="truncate text-[13.5px] font-semibold">{label}</span>
          <span className="text-[11.5px] text-cream-50/55">Signed in</span>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => void logout()}
          className="hidden cursor-pointer rounded-lg p-1.5 text-cream-50/60 transition-colors duration-fast hover:bg-cream-50/10 hover:text-cream-50 xl:flex"
        >
          <SignOut aria-hidden size={18} />
        </button>
      </div>
    </aside>
  );
}
