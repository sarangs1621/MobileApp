"use client";

import { DotsSixVertical, Info, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { ClassDto } from "@repo/types";
import { cn } from "@repo/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  SearchInput,
  Skeleton,
  TableToolbar,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Classes (design handoff §2 — Classes tab). A card list with section chips per
 * class and drag-the-handle reordering (writes `sortOrder` via the existing
 * update mutation — no new API). Sections are managed on the class detail page;
 * the chips and "+ Add section" link there.
 */
export default function ClassesPage() {
  const { show } = useToast();
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const classes = trpc.class.list.useQuery();
  const sectionLists = trpc.useQueries((t) =>
    (classes.data ?? []).map((item) => t.section.list({ classId: item.id })),
  );
  const sectionsByClass = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    (classes.data ?? []).forEach((item, i) => {
      map.set(item.id, sectionLists[i]?.data ?? []);
    });
    return map;
  }, [classes.data, sectionLists]);

  const utils = trpc.useUtils();
  const invalidate = () => utils.class.list.invalidate();

  const create = trpc.class.create.useMutation({
    onSuccess: () => {
      show("success", "Class created");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const update = trpc.class.update.useMutation({
    onSuccess: () => {
      show("success", "Class updated");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  // Silent variant for drag-reorder (one toast for the whole drop, not per row).
  const reorder = trpc.class.update.useMutation({
    onError: (e) => show("error", e.message),
  });

  const remove = trpc.class.delete.useMutation({
    onSuccess: () => {
      show("success", "Class deleted");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const [editing, setEditing] = useState<ClassDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClassDto | null>(null);
  const [query, setQuery] = useState("");

  // Local order for optimistic drag feedback; resyncs whenever the list changes.
  const sorted = useMemo(
    () => [...(classes.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [classes.data],
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [localIds, setLocalIds] = useState<string[] | null>(null);
  const orderedIds = localIds ?? sorted.map((c) => c.id);
  const byId = useMemo(() => new Map(sorted.map((c) => [c.id, c])), [sorted]);

  const q = query.trim().toLowerCase();
  const visible = orderedIds
    .map((id) => byId.get(id))
    .filter((c): c is ClassDto => c !== undefined)
    .filter((c) => !q || c.name.toLowerCase().includes(q));
  const dragEnabled = canManage && q === "";

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = orderedIds.filter((id) => id !== dragId);
    ids.splice(
      ids.indexOf(targetId) + (orderedIds.indexOf(dragId) < orderedIds.indexOf(targetId) ? 1 : 0),
      0,
      dragId,
    );
    setLocalIds(ids);
    // Persist: each class whose position changed gets its new index as sortOrder.
    const changed = ids
      .map((id, index) => ({ id, index }))
      .filter(({ id, index }) => byId.get(id)?.sortOrder !== index);
    void Promise.all(changed.map(({ id, index }) => reorder.mutateAsync({ id, sortOrder: index })))
      .then(() => {
        show("success", "Class order updated");
        return invalidate();
      })
      .catch(() => invalidate())
      .finally(() => setLocalIds(null));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="border-b border-cream-100 px-5 py-4">
          <TableToolbar
            search={
              <SearchInput
                placeholder="Search classes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            }
            count={`${visible.length} class${visible.length === 1 ? "" : "es"}`}
            actions={
              canManage ? (
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    create.reset();
                    update.reset();
                    setEditing("new");
                  }}
                >
                  New class
                </Button>
              ) : undefined
            }
          />
        </div>

        <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Class</span>
          <span>Sections</span>
          <span className="w-[76px] text-right">Actions</span>
        </div>

        {classes.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : classes.isError ? (
          <ErrorState onRetry={() => classes.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={q ? "No classes match." : "No classes yet."}
            message={q ? undefined : "Add the first class (e.g. Class 1) to begin."}
            action={
              canManage && !q ? (
                <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                  New class
                </Button>
              ) : undefined
            }
          />
        ) : (
          visible.map((item) => {
            const sections = sectionsByClass.get(item.id) ?? [];
            return (
              <div
                key={item.id}
                draggable={dragEnabled}
                onDragStart={() => setDragId(item.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  if (dragEnabled) e.preventDefault();
                }}
                onDrop={() => dropOn(item.id)}
                className={cn(
                  "grid grid-cols-[1fr_2fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50",
                  dragId === item.id && "opacity-50",
                )}
              >
                <span className="flex items-center gap-2.5 text-[14.5px] font-semibold text-ink-900">
                  {dragEnabled ? (
                    <DotsSixVertical
                      aria-hidden
                      size={16}
                      className="shrink-0 cursor-grab text-ink-300"
                    />
                  ) : null}
                  {item.name}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {sections.map((s) => (
                    <Link
                      key={s.id}
                      href={`/academic/classes/${item.id}`}
                      className="rounded-lg border border-maroon-200 bg-maroon-50 px-[11px] py-1 text-[12.5px] font-bold text-maroon-800 transition-colors duration-fast hover:bg-maroon-100"
                    >
                      {s.name}
                    </Link>
                  ))}
                  {canManage ? (
                    <Link
                      href={`/academic/classes/${item.id}`}
                      className="text-[12.5px] font-semibold text-maroon-700 hover:text-maroon-800"
                    >
                      + Add section
                    </Link>
                  ) : sections.length === 0 ? (
                    <span className="text-[12.5px] text-ink-400">No sections</span>
                  ) : null}
                </span>
                <span className="flex w-[76px] justify-end gap-1.5">
                  {canManage ? (
                    <>
                      <IconButton
                        label="Edit"
                        icon={PencilSimple}
                        onClick={() => {
                          create.reset();
                          update.reset();
                          setEditing(item);
                        }}
                      />
                      <IconButton
                        label="Delete"
                        tone="danger"
                        icon={Trash}
                        onClick={() => {
                          remove.reset();
                          setDeleting(item);
                        }}
                      />
                    </>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      {dragEnabled && visible.length > 1 ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
          <Info aria-hidden size={15} />
          Drag the handle to reorder classes — the sort order updates automatically.
        </p>
      ) : null}

      {editing !== null ? (
        <ClassFormModal
          item={editing === "new" ? null : editing}
          busy={create.isPending || update.isPending}
          error={create.error?.message ?? update.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing === "new") {
              // New classes append at the end; position is changed by dragging.
              const nextOrder =
                sorted.length > 0 ? Math.max(...sorted.map((c) => c.sortOrder)) + 1 : 0;
              create.mutate({ ...values, sortOrder: nextOrder }, done);
            } else {
              update.mutate({ id: editing.id, ...values }, done);
            }
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDialog
          title="Delete class?"
          objectName={deleting.name}
          message="Permanently delete this class? Classes with sections cannot be deleted —"
          confirmLabel="Delete class"
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </section>
  );
}

function ClassFormModal({
  item,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  item: ClassDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string }) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");

  return (
    <Dialog title={item ? "Edit class" : "New class"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim() });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Class 5"
          helper="Position in lists is set by dragging on the Classes tab — no sort number needed."
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save class
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
