"use client";

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
        className="relative min-h-11 min-w-11 rounded-md text-2xl hover:bg-accent"
      >
        🔔
        {count > 0 ? (
          <span className="absolute right-1 top-1 min-w-5 rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-medium text-foreground">Notifications</span>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-sm font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent.isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                You have no notifications.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className="flex w-full items-start gap-2 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-accent"
                >
                  <span className="mt-1.5 w-2">
                    {!n.isRead ? <span className="block h-2 w-2 rounded-full bg-primary" /> : null}
                  </span>
                  <span className="flex-1">
                    <span
                      className={`block ${n.isRead ? "text-foreground" : "font-semibold text-foreground"}`}
                    >
                      {n.title}
                    </span>
                    <span className="block text-sm text-muted-foreground">{n.body}</span>
                    <span className="block text-xs text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2 text-center text-sm font-medium text-primary hover:bg-accent"
          >
            See all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
