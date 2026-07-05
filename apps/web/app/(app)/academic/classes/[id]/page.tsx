"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { SectionDto } from "@repo/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  ConfirmDelete,
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  smallDangerBtn,
  smallGhostBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { trpc } from "@/src/trpc/react";

/** Sections of one class (class detail). Section names are unique per class. */
export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const classId = params.id;

  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const classQuery = trpc.class.get.useQuery({ id: classId });
  const sections = trpc.section.list.useQuery({ classId });
  const utils = trpc.useUtils();
  const invalidate = () => utils.section.list.invalidate({ classId });

  const create = trpc.section.create.useMutation({ onSuccess: invalidate });
  const update = trpc.section.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.section.delete.useMutation({ onSuccess: invalidate });

  const [editing, setEditing] = useState<SectionDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<SectionDto | null>(null);

  if (classQuery.isError) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-destructive">Class not found.</p>
        <Link href="/academic/classes" className="text-sm text-primary">
          ← Back to classes
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/academic/classes" className="text-sm text-primary">
            ← Classes
          </Link>
          <h2 className="text-xl font-semibold text-foreground">
            {classQuery.data ? `Sections — ${classQuery.data.name}` : "Sections"}
          </h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              create.reset();
              update.reset();
              setEditing("new");
            }}
            className={primaryBtn}
          >
            New section
          </button>
        ) : null}
      </div>

      <TableShell
        head={["Name", "Actions"]}
        isLoading={sections.isLoading}
        isError={sections.isError}
        isEmpty={(sections.data ?? []).length === 0}
        emptyText="No sections in this class yet."
      >
        {(sections.data ?? []).map((sectionRow) => (
          <tr key={sectionRow.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{sectionRow.name}</td>
            <td className="px-4 py-3">
              {canManage ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      create.reset();
                      update.reset();
                      setEditing(sectionRow);
                    }}
                    className={smallGhostBtn}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove.reset();
                      setDeleting(sectionRow);
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

      {editing !== null ? (
        <SectionFormModal
          sectionRow={editing === "new" ? null : editing}
          busy={create.isPending || update.isPending}
          error={create.error?.message ?? update.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing === "new") create.mutate({ classId, ...values }, done);
            else update.mutate({ id: editing.id, ...values }, done);
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDelete
          title="Delete section"
          message={`Permanently delete section “${deleting.name}”? Sections with teacher assignments cannot be deleted.`}
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

function SectionFormModal({
  sectionRow,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  sectionRow: SectionDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string }) => void;
}) {
  const [name, setName] = useState(sectionRow?.name ?? "");

  return (
    <Modal title={sectionRow ? "Edit section" : "New section"} onClose={onClose}>
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
            placeholder="A"
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
