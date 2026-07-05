"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { ClassDto } from "@repo/types";
import Link from "next/link";
import { useCallback, useState } from "react";

import {
  ConfirmDelete,
  inputClass,
  labelClass,
  ListToolbar,
  Modal,
  outlineBtn,
  Paginator,
  primaryBtn,
  smallDangerBtn,
  smallGhostBtn,
  TableShell,
  usePagedSearch,
} from "@/src/components/academic/ui";
import { trpc } from "@/src/trpc/react";

/** Classes CRUD. Sections are managed on the class's detail page. */
export default function ClassesPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const classes = trpc.class.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.class.list.invalidate();

  const create = trpc.class.create.useMutation({ onSuccess: invalidate });
  const update = trpc.class.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.class.delete.useMutation({ onSuccess: invalidate });

  const [editing, setEditing] = useState<ClassDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClassDto | null>(null);

  const paged = usePagedSearch(
    classes.data,
    useCallback((item: ClassDto, q: string) => item.name.toLowerCase().includes(q), []),
  );

  return (
    <section className="flex flex-col gap-4">
      <ListToolbar
        searchValue={paged.query}
        onSearch={paged.setQuery}
        searchLabel="Search classes"
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                create.reset();
                update.reset();
                setEditing("new");
              }}
              className={primaryBtn}
            >
              New class
            </button>
          ) : undefined
        }
      />

      <TableShell
        head={["Name", "Sort order", "Sections", "Actions"]}
        isLoading={classes.isLoading}
        isError={classes.isError}
        isEmpty={paged.total === 0}
        emptyText="No classes yet."
      >
        {paged.pageItems.map((item) => (
          <tr key={item.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{item.sortOrder}</td>
            <td className="px-4 py-3">
              <Link href={`/academic/classes/${item.id}`} className={smallGhostBtn}>
                Manage sections
              </Link>
            </td>
            <td className="px-4 py-3">
              {canManage ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      create.reset();
                      update.reset();
                      setEditing(item);
                    }}
                    className={smallGhostBtn}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove.reset();
                      setDeleting(item);
                    }}
                    className={smallDangerBtn}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      <Paginator
        page={paged.page}
        pageCount={paged.pageCount}
        total={paged.total}
        onPage={paged.setPage}
      />

      {editing !== null ? (
        <ClassFormModal
          item={editing === "new" ? null : editing}
          busy={create.isPending || update.isPending}
          error={create.error?.message ?? update.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing === "new") create.mutate(values, done);
            else update.mutate({ id: editing.id, ...values }, done);
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDelete
          title="Delete class"
          message={`Permanently delete “${deleting.name}”? Classes with sections cannot be deleted.`}
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
  onSubmit: (values: { name: string; sortOrder: number }) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));

  return (
    <Modal title={item ? "Edit class" : "New class"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), sortOrder: Number(sortOrder) });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Class 5"
            required
          />
        </label>
        <label className={labelClass}>
          Sort order
          <input
            type="number"
            step="1"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass}
            required
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={outlineBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
