"use client";

import {
  ArrowLeft,
  ChatCircleText,
  IdentificationCard,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, Button, EmptyState, Select, SkeletonText } from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

type Thread = {
  id: string;
  staffUserId: string;
  guardianUserId: string;
  studentId: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessagePreview: string | null;
};

/** A short "when" for the thread list — time for today, else a compact date. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * Teacher ↔ parent messaging (M18), rebuilt to the design-handoff two-pane layout:
 * a thread list on the left and the live conversation on the right (master-detail),
 * replacing the old single-column list + separate route. Selection lives in the URL
 * (`?thread=`) so deep links and the back button work; `[threadId]` redirects here.
 */
export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <SkeletonText lines={6} />
        </div>
      }
    >
      <MessagesInner />
    </Suspense>
  );
}

function MessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("thread");
  const composing = searchParams.get("compose") === "1";

  const me = trpc.auth.me.useQuery();
  const myUserId = me.data?.userId;
  const isParent = me.data?.role === "PARENT";

  // Modest poll so a reply shows up without a manual reopen (no realtime yet).
  const threads = trpc.message.listThreads.useQuery({}, { refetchInterval: 20_000 });
  const students = trpc.student.list.useQuery();
  const studentName = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [students.data],
  );

  const rows = threads.data?.items ?? [];
  const [search, setSearch] = useState("");

  const setParams = (next: { thread?: string | null; compose?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString());
    if ("thread" in next) {
      if (next.thread) params.set("thread", next.thread);
      else params.delete("thread");
    }
    if ("compose" in next) {
      if (next.compose) params.set("compose", "1");
      else params.delete("compose");
    }
    const qs = params.toString();
    router.replace(qs ? `/messages?${qs}` : "/messages", { scroll: false });
  };

  const selected = rows.find((t) => t.id === selectedId) ?? null;

  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-0">
      {/* ---------- Thread list ---------- */}
      <aside
        className={`${
          selectedId ? "hidden lg:flex" : "flex"
        } w-full shrink-0 flex-col border-r border-subtle bg-white lg:w-[340px]`}
      >
        <div className="flex flex-col gap-3 border-b border-cream-100 px-5 pb-3.5 pt-4">
          <div className="flex items-center gap-2.5">
            <h1 className="flex-1 font-display text-2xl font-medium text-ink-900">Messages</h1>
            <button
              type="button"
              onClick={() => setParams({ compose: true })}
              aria-label="New message"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-maroon-700 text-cream-50 transition-colors duration-fast hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <PencilSimple aria-hidden className="size-[17px]" />
            </button>
          </div>
          <div className="flex items-center gap-2.5 rounded-full border border-subtle bg-cream-50 px-3.5 py-2.5">
            <MagnifyingGlass aria-hidden className="size-[15px] shrink-0 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isParent ? "Search teachers…" : "Search parents…"}
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {threads.isLoading ? (
            <div className="p-4">
              <SkeletonText lines={6} />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ChatCircleText}
                title="No conversations yet"
                message={
                  isParent
                    ? "Start a message to your child's teacher."
                    : "Start a message to a parent."
                }
              />
            </div>
          ) : (
            rows.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                studentLabel={studentName.get(t.studentId) ?? "Student"}
                myUserId={myUserId}
                active={t.id === selectedId}
                search={search}
                onOpen={() => setParams({ thread: t.id, compose: false })}
              />
            ))
          )}
        </div>
      </aside>

      {/* ---------- Conversation ---------- */}
      <section
        className={`${selectedId ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col bg-cream-50`}
      >
        {selected ? (
          <Conversation
            key={selected.id}
            thread={selected}
            studentLabel={studentName.get(selected.studentId) ?? "Student"}
            myUserId={myUserId}
            isParent={isParent}
            onBack={() => setParams({ thread: null })}
          />
        ) : (
          <div className="m-auto max-w-sm p-8">
            <EmptyState
              icon={ChatCircleText}
              title="Select a conversation"
              message="Choose a thread on the left, or start a new message."
            />
          </div>
        )}
      </section>

      {composing ? (
        <Composer
          studentName={studentName}
          onClose={() => setParams({ compose: false })}
          onCreated={(threadId) => setParams({ thread: threadId, compose: false })}
        />
      ) : null}
    </main>
  );
}

/** One thread row; resolves the counterparty's name (falls back to a role label). */
function ThreadRow({
  thread,
  studentLabel,
  myUserId,
  active,
  search,
  onOpen,
}: {
  thread: Thread;
  studentLabel: string;
  myUserId: string | undefined;
  active: boolean;
  search: string;
  onOpen: () => void;
}) {
  const iAmStaff = thread.staffUserId === myUserId;
  const counterpartyUserId = iAmStaff ? thread.guardianUserId : thread.staffUserId;
  // A persisted thread whose student left scope makes this 403 — degrade, don't break.
  const cps = trpc.message.counterparties.useQuery(
    { studentId: thread.studentId },
    { retry: false },
  );
  const resolved = cps.data?.find((c) => c.userId === counterpartyUserId)?.name;
  const name = resolved ?? (iAmStaff ? "Parent" : "Teacher");

  // Client-side filter (matches the design's search box; names/students only).
  const q = search.trim().toLowerCase();
  if (q && !`${name} ${studentLabel}`.toLowerCase().includes(q)) return null;

  const unread = thread.unreadCount > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full cursor-pointer items-center gap-3 border-b border-cream-100 px-[18px] py-3.5 text-left transition-colors duration-fast hover:bg-cream-50 ${
        active ? "bg-cream-100" : "bg-white"
      }`}
    >
      <Avatar name={name} size="md" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span
            className={`flex-1 truncate text-sm text-ink-900 ${
              unread ? "font-bold" : "font-semibold"
            }`}
          >
            {name}
          </span>
          <span className="shrink-0 text-[11px] text-ink-400">
            {whenLabel(thread.lastMessageAt)}
          </span>
        </span>
        {thread.lastMessagePreview ? (
          <span className="truncate text-[12.5px] text-ink-500">{thread.lastMessagePreview}</span>
        ) : null}
        <span className="truncate text-[11px] font-semibold text-maroon-700">
          Re: {studentLabel}
        </span>
      </span>
      {unread ? (
        <span
          aria-label={`${thread.unreadCount} unread`}
          className="size-2.5 shrink-0 rounded-full bg-maroon-700"
        />
      ) : null}
    </button>
  );
}

/** The live conversation pane: header, message bubbles, and a composer. */
function Conversation({
  thread,
  studentLabel,
  myUserId,
  isParent,
  onBack,
}: {
  thread: Thread;
  studentLabel: string;
  myUserId: string | undefined;
  isParent: boolean;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const iAmStaff = thread.staffUserId === myUserId;
  const counterpartyUserId = iAmStaff ? thread.guardianUserId : thread.staffUserId;
  const cps = trpc.message.counterparties.useQuery(
    { studentId: thread.studentId },
    { retry: false },
  );
  const name =
    cps.data?.find((c) => c.userId === counterpartyUserId)?.name ??
    (iAmStaff ? "Parent" : "Teacher");

  // Poll so the counterparty's reply appears while the conversation is open.
  const query = trpc.message.threadMessages.useQuery(
    { threadId: thread.id },
    { refetchInterval: 15_000 },
  );
  // Newest-first from the server → render oldest at top.
  const messages = useMemo(() => [...(query.data?.items ?? [])].reverse(), [query.data?.items]);

  // Flip incoming messages to read whenever a NEW one arrives (poll), not just on
  // mount — keeps the sidebar unread badge honest while the thread is open.
  const latestIncomingId = query.data?.items.find((m) => m.senderUserId !== myUserId)?.id;
  const markRead = trpc.message.markRead.useMutation({
    onSuccess: () => {
      void utils.message.unreadCount.invalidate();
      void utils.message.listThreads.invalidate();
    },
  });
  useEffect(() => {
    markRead.mutate({ threadId: thread.id });
  }, [thread.id, latestIncomingId]);

  const [body, setBody] = useState("");
  const send = trpc.message.send.useMutation({
    onSuccess: () => {
      setBody("");
      void utils.message.threadMessages.invalidate({ threadId: thread.id });
      void utils.message.listThreads.invalidate();
    },
  });
  const submit = () => {
    const trimmed = body.trim();
    if (trimmed.length === 0 || send.isPending) return;
    send.mutate({ threadId: thread.id, body: trimmed });
  };

  // Keep the newest message in view as the list grows / on open.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-subtle bg-white px-4 py-3.5 lg:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-maroon-700 hover:bg-maroon-50 lg:hidden"
        >
          <ArrowLeft aria-hidden className="size-[18px]" />
        </button>
        <Avatar name={name} size="md" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15.5px] font-semibold text-ink-900">{name}</span>
          <span className="truncate text-[12px] font-semibold text-maroon-700">
            Re: {studentLabel}
          </span>
        </span>
        <div className="flex-1" />
        <Link
          href={`/people/students/${thread.studentId}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-subtle bg-white px-3.5 py-2 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
        >
          <IdentificationCard aria-hidden className="size-[15px]" />
          <span className="hidden sm:inline">{isParent ? "My child" : "Student profile"}</span>
        </Link>
      </div>

      {/* Messages */}
      <div
        className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-6"
        aria-live="polite"
        aria-label="Messages"
      >
        {query.isLoading ? (
          <SkeletonText lines={4} />
        ) : messages.length === 0 ? (
          <p className="m-auto text-ink-500">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderUserId === myUserId;
            const time = new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={m.id}
                className={`max-w-[78%] px-4 py-3 sm:max-w-[62%] ${
                  mine
                    ? "self-end rounded-[16px_16px_4px_16px] bg-maroon-700 text-cream-50"
                    : "self-start rounded-[16px_16px_16px_4px] border border-subtle bg-white text-ink-900"
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-sm leading-normal">{m.body}</p>
                <p
                  className={`mt-1.5 text-[10.5px] ${
                    mine ? "text-right text-cream-50/60" : "text-ink-400"
                  }`}
                >
                  {mine ? "You" : name} · {time}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        className="flex items-center gap-3 border-t border-subtle bg-white px-4 py-3.5 lg:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          rows={1}
          value={body}
          placeholder="Write a message…"
          aria-label="Write a message"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-32 min-h-[46px] flex-1 resize-none rounded-[22px] border border-subtle bg-cream-50 px-[18px] py-3 text-[13.5px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-gold-500 focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={body.trim().length === 0 || send.isPending}
          aria-label="Send message"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-maroon-700 text-cream-50 transition-colors duration-fast hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PaperPlaneTilt aria-hidden weight="fill" className="size-[19px]" />
        </button>
      </form>
    </>
  );
}

/** New-message flow: pick a student → pick a counterparty → open (or reuse) the thread. */
function Composer({
  studentName,
  onClose,
  onCreated,
}: {
  studentName: Map<string, string>;
  onClose: () => void;
  onCreated: (threadId: string) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [otherUserId, setOtherUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const counterparties = trpc.message.counterparties.useQuery(
    { studentId },
    { enabled: !!studentId, retry: false },
  );
  const utils = trpc.useUtils();
  const create = trpc.message.createThread.useMutation({
    onSuccess: (thread) => {
      void utils.message.listThreads.invalidate();
      onCreated(thread.id);
    },
    onError: (e) => setError(e.message),
  });

  const options = [...studentName.entries()];

  // Local modal so the two-pane layout isn't disturbed (mirrors the DS Dialog styling).
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(36,26,17,0.55)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New message"
        className="w-full max-w-[440px] rounded-[18px] border border-subtle bg-white p-6 shadow-modal"
      >
        <h2 className="font-display text-2xl font-medium text-ink-900">New message</h2>
        <div className="mt-4 flex flex-col gap-4">
          {error ? <p className="text-sm text-danger-600">{error}</p> : null}

          <Select
            label="Student"
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setOtherUserId("");
              setError(null);
            }}
          >
            <option value="">Select…</option>
            {options.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>

          {studentId ? (
            <Select
              label="Recipient"
              value={otherUserId}
              onChange={(e) => setOtherUserId(e.target.value)}
              disabled={counterparties.isLoading}
            >
              <option value="">{counterparties.isLoading ? "Loading…" : "Select…"}</option>
              {(counterparties.data ?? []).map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : null}

          {studentId && !counterparties.isLoading && (counterparties.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-500">No one to message about this student.</p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              icon={ChatCircleText}
              disabled={!studentId || !otherUserId}
              loading={create.isPending}
              onClick={() => {
                setError(null);
                create.mutate({ studentId, otherUserId });
              }}
            >
              Start conversation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
