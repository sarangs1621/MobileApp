"use client";

import {
  Archive,
  Buildings,
  ChalkboardTeacher,
  Info,
  Megaphone,
  Paperclip,
  PencilSimple,
  Plus,
  SquaresFour,
  Student,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { AnnouncementScopeKey, AnnouncementStatusKey } from "@repo/types";
import { cn } from "@repo/ui";
import { useId, useState, type ComponentType } from "react";

import {
  formatDate,
  kb,
  pushAnnouncementFile,
  SCOPE_LABEL,
  STATUS_LABEL,
  validateAnnouncementFile,
} from "@/src/components/announcement/ui";
import {
  Button,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  SkeletonText,
  StatusChip,
  type Tab,
  Tabs,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const ADMIN_TABS: AnnouncementStatusKey[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const TEACHER_TABS: AnnouncementStatusKey[] = ["DRAFT", "PUBLISHED"];

const textareaClass =
  "w-full rounded-xl border border-subtle bg-white px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100 disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-60";

/** Audience tiles for admins — the design's icon grid (create-time only). */
const AUDIENCE_TILES: {
  key: AnnouncementScopeKey;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  hint: string;
}[] = [
  {
    key: "WHOLE_SCHOOL",
    label: "School",
    icon: Buildings,
    hint: "Everyone with a portal account.",
  },
  {
    key: "TEACHERS",
    label: "Teachers",
    icon: ChalkboardTeacher,
    hint: "Teaching and office staff.",
  },
  {
    key: "PARENTS",
    label: "Parents",
    icon: UsersThree,
    hint: "All parents see this in their feed.",
  },
  { key: "CLASS", label: "Class", icon: Student, hint: "Parents and teachers of one class." },
  {
    key: "SECTION",
    label: "Section",
    icon: SquaresFour,
    hint: "Parents and teachers of one section.",
  },
];

/**
 * Announcement console (M11, ADR-019 Step 7; design handoff §Announcements).
 * Draft / Published / Archive tabs with a scope filter and a card list; a modal
 * composer creates + edits drafts (attachment uploads while DRAFT) and runs the
 * lifecycle — publish/archive are admin-only, edit/delete apply to a draft the
 * author owns. Thin client over the tRPC surface; the service is the authority.
 */
export default function AnnouncementsPage() {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.ANNOUNCEMENT_MANAGE);
  const canDraft = role !== undefined && can(role, PERMISSIONS.ANNOUNCEMENT_DRAFT);
  const isAuthor = canManage || canDraft;

  const [tab, setTab] = useState<AnnouncementStatusKey>("PUBLISHED");
  const [scopeFilter, setScopeFilter] = useState<AnnouncementScopeKey | "ALL">("ALL");
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const list = trpc.announcement.list.useQuery({ status: tab });
  // Draft count for the tab badge (authors only).
  const drafts = trpc.announcement.list.useQuery({ status: "DRAFT" }, { enabled: isAuthor });
  const draftCount = drafts.data?.length ?? 0;

  const tabKeys = canManage ? ADMIN_TABS : TEACHER_TABS;
  const tabs: Tab[] = tabKeys.map((t) => ({
    key: t,
    label: STATUS_LABEL[t],
    count: t === "DRAFT" && isAuthor ? draftCount : undefined,
  }));

  const rows = (list.data ?? []).filter((a) => scopeFilter === "ALL" || a.scope === scopeFilter);

  const publish = trpc.announcement.publish.useMutation({
    onSuccess: () => {
      void list.refetch();
      void drafts.refetch();
    },
  });
  const archive = trpc.announcement.archive.useMutation({
    onSuccess: () => void list.refetch(),
  });

  return (
    <main className="mx-auto flex max-w-[980px] flex-col gap-5 px-9 py-7">
      <PageHeader
        eyebrow="Communication"
        title="Announcements"
        subtitle="Messages to parents, teachers and classes — drafts stay private until published."
        action={
          isAuthor ? (
            <Button icon={Plus} onClick={() => setEditing("new")}>
              New announcement
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as AnnouncementStatusKey)} />
        <Select
          label="Audience"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as AnnouncementScopeKey | "ALL")}
          className="h-[38px] min-w-[160px]"
        >
          <option value="ALL">All audiences</option>
          {(Object.keys(SCOPE_LABEL) as AnnouncementScopeKey[]).map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <section className="flex flex-col gap-3">
        {list.isLoading ? (
          <div className="rounded-card border border-subtle bg-white p-5 shadow-sm">
            <SkeletonText lines={4} />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-card border border-subtle bg-white shadow-sm">
            <EmptyState
              icon={Megaphone}
              title="No announcements"
              message={
                tab === "DRAFT"
                  ? "Start a new announcement — it stays a draft until you publish it."
                  : tab === "PUBLISHED"
                    ? "Published announcements appear in parents' and teachers' feeds."
                    : "Archiving removes an announcement from feeds but keeps it on record."
              }
            />
          </div>
        ) : (
          rows.map((a) => {
            const published = a.status === "PUBLISHED";
            return (
              <div
                key={a.id}
                className="flex items-start gap-4 rounded-card border border-subtle bg-white px-[22px] py-[18px] shadow-sm transition-shadow duration-base hover:shadow-md"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    published ? "bg-maroon-50 text-maroon-700" : "bg-cream-100 text-ink-500",
                  )}
                >
                  <Megaphone aria-hidden size={19} weight={published ? "bold" : "regular"} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-[17px] font-semibold text-ink-900">
                      {a.title}
                    </span>
                    <StatusChip status={a.status} label={STATUS_LABEL[a.status]} dot />
                  </div>
                  <p className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-700">
                    {a.body}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-400">
                    <span className="flex items-center gap-1.5">
                      <UsersThree aria-hidden size={13} />
                      {SCOPE_LABEL[a.scope]} · {formatDate(a.publishedAt ?? a.createdAt)}
                    </span>
                    {a.attachments.length > 0 ? (
                      <span className="flex items-center gap-1">
                        <Paperclip aria-hidden size={13} />
                        {a.attachments.length}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isAuthor ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {a.status === "DRAFT" && canManage ? (
                      <Button
                        size="sm"
                        loading={publish.isPending && publish.variables?.id === a.id}
                        onClick={() => publish.mutate({ id: a.id })}
                      >
                        Publish
                      </Button>
                    ) : null}
                    <IconButton label="Edit" icon={PencilSimple} onClick={() => setEditing(a.id)} />
                    {published && canManage ? (
                      <IconButton
                        label="Archive"
                        icon={Archive}
                        className="text-ink-500 hover:border-strong hover:bg-cream-100"
                        onClick={() => archive.mutate({ id: a.id })}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      {isAuthor ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
          <Info aria-hidden size={15} />
          Publishing notifies the audience immediately. Archived announcements disappear from feeds
          but stay on record.
        </p>
      ) : null}

      {editing ? (
        <Composer
          id={editing === "new" ? null : editing}
          canManage={canManage}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void list.refetch();
            void drafts.refetch();
          }}
        />
      ) : null}
    </main>
  );
}

/** Create (id=null) or edit an announcement; attachments + lifecycle in edit mode. */
function Composer({
  id,
  canManage,
  onClose,
  onSaved,
}: {
  id: string | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const utils = trpc.useUtils();
  const existing = trpc.announcement.get.useQuery({ id: id ?? "" }, { enabled: !!id });
  const a = existing.data;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<AnnouncementScopeKey>(canManage ? "WHOLE_SCHOOL" : "SECTION");
  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const bodyId = useId();

  // Prefill once when the edited row loads.
  if (a && hydratedId !== a.id) {
    setHydratedId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setScope(a.scope);
  }

  const classes = trpc.class.list.useQuery(undefined, { enabled: canManage });
  const sections = trpc.section.list.useQuery(
    { classId: classId ?? "" },
    { enabled: canManage && !!classId },
  );
  const targets = trpc.homework.targets.useQuery(undefined, { enabled: !canManage });
  const teacherSections = [
    ...new Map((targets.data ?? []).map((t) => [t.sectionId, t.sectionName])).entries(),
  ];

  const refresh = () => {
    if (id) void utils.announcement.get.invalidate({ id });
    onSaved();
  };
  const create = trpc.announcement.create.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Draft created.");
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const update = trpc.announcement.update.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Draft saved.");
    },
    onError: (e) => setError(e.message),
  });
  const publish = trpc.announcement.publish.useMutation({
    onSuccess: () => {
      onSaved();
      show("success", "Announcement published.");
      onClose();
    },
  });
  const archive = trpc.announcement.archive.useMutation({
    onSuccess: () => {
      onSaved();
      show("success", "Announcement archived.");
      onClose();
    },
  });
  const remove = trpc.announcement.delete.useMutation({
    onSuccess: () => {
      onSaved();
      show("success", "Draft deleted.");
      onClose();
    },
  });
  const mintUpload = trpc.announcement.attachmentUploadUrl.useMutation();
  const addAttachment = trpc.announcement.attachmentAdd.useMutation({ onSuccess: refresh });
  const removeAttachment = trpc.announcement.attachmentRemove.useMutation({ onSuccess: refresh });
  const download = trpc.announcement.attachmentDownloadUrl.useMutation();

  const targetId = scope === "CLASS" ? classId : scope === "SECTION" ? sectionId : undefined;
  const isDraft = !a || a.status === "DRAFT";
  const canEdit = isDraft;

  const save = () => {
    setError(null);
    if (id) {
      update.mutate({ id, title: title.trim(), body: body.trim() });
    } else {
      create.mutate({
        title: title.trim(),
        body: body.trim(),
        scope,
        ...(targetId ? { targetId } : {}),
      });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !id) return;
    setError(null);
    const err = validateAnnouncementFile(file);
    if (err) {
      setError(err);
      return;
    }
    try {
      const { storagePath, token } = await mintUpload.mutateAsync({
        announcementId: id,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      await pushAnnouncementFile(storagePath, token, file);
      await addAttachment.mutateAsync({
        announcementId: id,
        path: storagePath,
        fileName: file.name,
        sizeBytes: file.size,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const valid =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (canManage ? scope !== "SECTION" || !!sectionId : !!sectionId) &&
    (scope !== "CLASS" || !!classId);

  const activeTile = AUDIENCE_TILES.find((t) => t.key === scope);

  return (
    <Dialog title={id ? "Edit announcement" : "New announcement"} onClose={onClose} size="lg">
      <div className="flex flex-col gap-[18px]">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Input
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="PTA meeting on Friday"
          disabled={!canEdit}
        />
        <Field label="Message" required htmlFor={bodyId}>
          <textarea
            id={bodyId}
            rows={4}
            className={cn(textareaClass, "min-h-28 resize-y")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Keep it short — parents read this on their phones."
            disabled={!canEdit}
          />
        </Field>

        {/* Scope is chosen at creation only. */}
        {!id ? (
          <div className="flex flex-col gap-[7px]">
            <span className="text-[13px] font-semibold text-ink-900">Audience</span>
            {canManage ? (
              <>
                <div className="grid grid-cols-5 gap-2">
                  {AUDIENCE_TILES.map((t) => {
                    const active = scope === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setScope(t.key);
                          setClassId(undefined);
                          setSectionId(undefined);
                        }}
                        className={cn(
                          "flex cursor-pointer flex-col items-center gap-1.5 rounded-[11px] border px-1 py-2.5 text-[12px] font-semibold transition-colors duration-fast",
                          active
                            ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                            : "border-subtle bg-white text-ink-500 hover:border-strong",
                        )}
                      >
                        <t.icon aria-hidden size={16} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {scope === "CLASS" || scope === "SECTION" ? (
                  <div className="flex gap-2.5 pt-1">
                    <Select
                      label="Class"
                      value={classId ?? ""}
                      onChange={(e) => {
                        setClassId(e.target.value || undefined);
                        setSectionId(undefined);
                      }}
                      className="flex-1"
                    >
                      <option value="">Select…</option>
                      {(classes.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    {scope === "SECTION" && classId ? (
                      <Select
                        label="Section"
                        value={sectionId ?? ""}
                        onChange={(e) => setSectionId(e.target.value || undefined)}
                        className="flex-1"
                      >
                        <option value="">Select…</option>
                        {(sections.data ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                  </div>
                ) : null}
                <span className="text-[12px] text-ink-400">{activeTile?.hint}</span>
              </>
            ) : (
              <Select
                label="Section"
                value={sectionId ?? ""}
                onChange={(e) => setSectionId(e.target.value || undefined)}
              >
                <option value="">Select…</option>
                {teacherSections.map(([sid, name]) => (
                  <option key={sid} value={sid}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-subtle bg-cream-50 px-3.5 py-3 text-[12.5px] text-ink-500">
            <UsersThree aria-hidden size={15} />
            Audience: <strong className="text-ink-900">{SCOPE_LABEL[scope]}</strong> — fixed after
            creation
          </div>
        )}

        {/* Attachments — DRAFT only, after the row exists. */}
        {id && a && isDraft ? (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-900">Attachments</span>
            {a.attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-1.5 text-left text-maroon-700 hover:underline"
                  onClick={() =>
                    void download
                      .mutateAsync({ attachmentId: att.id })
                      .then(({ url }) => window.open(url, "_blank"))
                  }
                >
                  <Paperclip aria-hidden size={14} /> {att.fileName}
                </button>
                <span className="text-[12px] text-ink-400">{kb(att.sizeBytes)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment.mutate({ attachmentId: att.id })}
                >
                  Remove
                </Button>
              </div>
            ))}
            <input
              type="file"
              className="text-sm text-ink-700"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2.5 pt-1">
          <div>
            {id && a?.status === "DRAFT" ? (
              <Button variant="ghost" icon={Trash} onClick={() => remove.mutate({ id })}>
                Delete
              </Button>
            ) : id && a?.status === "PUBLISHED" && canManage ? (
              <Button variant="ghost" icon={Archive} onClick={() => archive.mutate({ id })}>
                Archive
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {canEdit ? (
              <Button
                variant={id && canManage ? "secondary" : "primary"}
                disabled={!valid}
                loading={create.isPending || update.isPending}
                onClick={save}
              >
                {id ? "Save draft" : "Create draft"}
              </Button>
            ) : null}
            {id && a?.status === "DRAFT" && canManage ? (
              <Button loading={publish.isPending} onClick={() => publish.mutate({ id })}>
                Publish now
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
