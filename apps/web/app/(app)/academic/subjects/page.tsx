"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { SubjectDto } from "@repo/types";
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

/** Subjects CRUD — a school-wide catalog; names are unique per school. */
export default function SubjectsPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const subjects = trpc.subject.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.subject.list.invalidate();

  const create = trpc.subject.create.useMutation({ onSuccess: invalidate });
  const update = trpc.subject.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.subject.delete.useMutation({ onSuccess: invalidate });

  const [editing, setEditing] = useState<SubjectDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<SubjectDto | null>(null);

  const paged = usePagedSearch(
    subjects.data,
    useCallback((subject: SubjectDto, q: string) => subject.name.toLowerCase().includes(q), []),
  );

  return (
    <section className="flex flex-col gap-4">
      <ListToolbar
        searchValue={paged.query}
        onSearch={paged.setQuery}
        searchLabel="Search subjects"
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
              New subject
            </button>
          ) : undefined
        }
      />

      <TableShell
        head={["Name", "Actions"]}
        isLoading={subjects.isLoading}
        isError={subjects.isError}
        isEmpty={paged.total === 0}
        emptyText="No subjects yet."
      >
        {paged.pageItems.map((subject) => (
          <tr key={subject.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{subject.name}</td>
            <td className="px-4 py-3">
              {canManage ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      create.reset();
                      update.reset();
                      setEditing(subject);
                    }}
                    className={smallGhostBtn}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove.reset();
                      setDeleting(subject);
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
        <SubjectFormModal
          subject={editing === "new" ? null : editing}
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
          title="Delete subject"
          message={`Permanently delete “${deleting.name}”? Subjects with teacher assignments cannot be deleted.`}
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

function SubjectFormModal({
  subject,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  subject: SubjectDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string }) => void;
}) {
  const [name, setName] = useState(subject?.name ?? "");

  return (
    <Modal title={subject ? "Edit subject" : "New subject"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim() });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Mathematics"
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
