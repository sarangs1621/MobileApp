"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { NotificationDto, NotificationPriorityKey } from "@repo/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { inputClass, labelClass, outlineBtn, primaryBtn } from "@/src/components/academic/ui";
import { deepLinkForType, timeAgo } from "@/src/components/notification/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Notifications page (M10, ADR-018 Step 8). The signed-in user's inbox — mark read
 * (row click also deep-links), archive, mark all read — plus, for admins
 * (announcement:send), the announcement composer (bulk school-wide or one section).
 */
export default function NotificationsPage() {
  const router = useRouter();
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const list = trpc.notification.list.useQuery({});
  const notifications = list.data ?? [];

  const refresh = () => {
    void utils.notification.unreadCount.invalidate();
    void utils.notification.list.invalidate();
  };
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: refresh });
  const markAllRead = trpc.notification.markAllRead.useMutation({ onSuccess: refresh });
  const archive = trpc.notification.archive.useMutation({ onSuccess: refresh });

  const role = me.data?.role;
  const canAnnounce = role !== undefined && can(role, PERMISSIONS.ANNOUNCEMENT_SEND);
  const hasUnread = notifications.some((n) => !n.isRead);

  const open = (n: NotificationDto) => {
    if (!n.isRead) markRead.mutate({ id: n.id });
    const href = deepLinkForType(n.type);
    if (href) router.push(href);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-primary">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
        </div>
        {hasUnread ? (
          <button type="button" className={outlineBtn} onClick={() => markAllRead.mutate()}>
            Mark all read
          </button>
        ) : null}
      </header>

      {canAnnounce ? <AnnouncementComposer onSent={refresh} /> : null}

      <section className="flex flex-col gap-3">
        {list.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="text-muted-foreground">You have no notifications.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-3 rounded-md border border-border bg-card p-4"
            >
              <span className="mt-1.5 w-2">
                {!n.isRead ? <span className="block h-2 w-2 rounded-full bg-primary" /> : null}
              </span>
              <button type="button" onClick={() => open(n)} className="flex-1 text-left">
                <span
                  className={`block ${n.isRead ? "text-foreground" : "font-semibold text-foreground"}`}
                >
                  {n.title}
                </span>
                <span className="block text-sm text-muted-foreground">{n.body}</span>
                <span className="block text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </button>
              <button
                type="button"
                onClick={() => archive.mutate({ id: n.id })}
                className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Archive
              </button>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

const PRIORITIES: readonly NotificationPriorityKey[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

/** Admin composer — bulk (whole school) or one section. */
function AnnouncementComposer({ onSent }: { onSent: () => void }) {
  const [scope, setScope] = useState<"SCHOOL" | "SECTION">("SCHOOL");
  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<NotificationPriorityKey>("NORMAL");
  const [sent, setSent] = useState<number | null>(null);

  const classes = trpc.class.list.useQuery();
  const sections = trpc.section.list.useQuery({ classId: classId! }, { enabled: !!classId });

  const create = trpc.notification.createAnnouncement.useMutation({
    onSuccess: (res) => {
      setSent(res.recipientCount);
      setTitle("");
      setBody("");
      onSent();
    },
  });

  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (scope === "SCHOOL" || !!sectionId) &&
    !create.isPending;

  const submit = () => {
    setSent(null);
    create.mutate({
      scope,
      title: title.trim(),
      body: body.trim(),
      priority,
      ...(scope === "SECTION" && sectionId ? { sectionId } : {}),
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <h2 className="text-lg font-semibold text-foreground">New announcement</h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className={labelClass}>
          Audience
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "SCHOOL" | "SECTION")}
            className={inputClass}
          >
            <option value="SCHOOL">Whole school (all parents &amp; teachers)</option>
            <option value="SECTION">One section</option>
          </select>
        </label>

        {scope === "SECTION" ? (
          <>
            <label className={labelClass}>
              Class
              <select
                value={classId ?? ""}
                onChange={(e) => {
                  setClassId(e.target.value || undefined);
                  setSectionId(undefined);
                }}
                className={inputClass}
              >
                <option value="">Select…</option>
                {(classes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Section
              <select
                value={sectionId ?? ""}
                onChange={(e) => setSectionId(e.target.value || undefined)}
                className={inputClass}
                disabled={!classId}
              >
                <option value="">Select…</option>
                {(sections.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <label className={labelClass}>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as NotificationPriorityKey)}
            className={inputClass}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className={inputClass}
          placeholder="Announcement title"
        />
      </label>
      <label className={labelClass}>
        Message
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          className={inputClass}
          placeholder="What do you want to tell them?"
        />
      </label>

      {create.isError ? <p className="text-sm text-destructive">{create.error.message}</p> : null}
      {sent !== null ? (
        <p className="text-sm text-success">
          Sent to {sent} recipient{sent === 1 ? "" : "s"}.
        </p>
      ) : null}

      <div>
        <button type="button" className={primaryBtn} disabled={!canSubmit} onClick={submit}>
          {create.isPending ? "Sending…" : "Send announcement"}
        </button>
      </div>
    </section>
  );
}
