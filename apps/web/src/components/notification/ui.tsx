"use client";

import { Bell } from "@phosphor-icons/react";
import type { NotificationDto, NotificationTypeKey } from "@repo/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { trpc } from "@/src/trpc/react";

/**
 * Notification web UI (M10, ADR-018 Step 8). A top-nav bell with an unread badge
 * and a dropdown of recent notifications, plus the shared row helpers reused by the
 * dedicated /notifications page. Every role has an inbox (notification:manage_own).
 */

/** Notification TYPE → the web destination screen (web routes differ from mobile). */
export function deepLinkForType(type: NotificationTypeKey): string | null {
  switch (type) {
    case "HOMEWORK":
    case "HOMEWORK_PUBLISHED":
      return "/homework";
    case "REPORT_CARD_PUBLISHED":
      return "/report-cards";
    case "EXAM_PUBLISHED":
      return "/exams";
    case "TIMETABLE_UPDATED":
      return "/timetable";
    default:
      return null;
  }
}

export function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Top-nav bell + unread badge + recent-notifications dropdown. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const unread = trpc.notification.unreadCount.useQuery();
  const recent = trpc.notification.list.useQuery({ limit: 8 }, { enabled: open });
  const count = unread.data ?? 0;

  const refresh = () => {
    void utils.notification.unreadCount.invalidate();
    void utils.notification.list.invalidate();
  };
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: refresh });
  const markAllRead = trpc.notification.markAllRead.useMutation({ onSuccess: refresh });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const openNotification = (n: NotificationDto) => {
    if (!n.isRead) markRead.mutate({ id: n.id });
    const href = deepLinkForType(n.type);
    setOpen(false);
    if (href) router.push(href);
  };

  const items = recent.data ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 cursor-pointer items-center justify-center rounded-full border border-subtle bg-white text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
      >
        <Bell aria-hidden size={19} />
        {count > 0 ? (
          <span className="absolute -right-[3px] -top-[3px] flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border-2 border-cream-50 bg-maroon-700 px-1 text-[10.5px] font-bold text-cream-50">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[360px] animate-pop-in overflow-hidden rounded-card border border-subtle bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-subtle px-[18px] py-3.5">
            <span className="font-display text-base font-semibold text-ink-900">Notifications</span>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="cursor-pointer text-[12.5px] font-semibold text-maroon-700 hover:text-maroon-900"
              >
                Mark all as read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent.isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">
                You have no notifications.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className="flex w-full cursor-pointer items-start gap-3 border-b border-cream-100 px-[18px] py-3 text-left last:border-0 hover:bg-cream-50"
                >
                  <span className="mt-1.5 w-2 shrink-0">
                    {!n.isRead ? (
                      <span className="block size-2 rounded-full bg-maroon-700" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`block text-[13.5px] text-ink-900 ${n.isRead ? "" : "font-semibold"}`}
                    >
                      {n.title}
                    </span>
                    <span className="block text-[12.5px] text-ink-500">{n.body}</span>
                    <span className="block text-[11.5px] text-ink-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-subtle bg-cream-50 px-4 py-3 text-center text-[13px] font-semibold text-maroon-700 hover:bg-cream-100"
          >
            See all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
