"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { AcademicTermDto } from "@repo/types";
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

/** Terms of one academic year (year detail). Term dates must not overlap. */
export default function AcademicYearDetailPage() {
  const params = useParams<{ id: string }>();
  const yearId = params.id;

  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const year = trpc.academicYear.get.useQuery({ id: yearId });
  const terms = trpc.academicTerm.list.useQuery({ academicYearId: yearId });
  const utils = trpc.useUtils();
  const invalidate = () => utils.academicTerm.list.invalidate({ academicYearId: yearId });

  const create = trpc.academicTerm.create.useMutation({ onSuccess: invalidate });
  const update = trpc.academicTerm.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.academicTerm.delete.useMutation({ onSuccess: invalidate });

  const [editing, setEditing] = useState<AcademicTermDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<AcademicTermDto | null>(null);

  if (year.isError) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-destructive">Academic year not found.</p>
        <Link href="/academic/years" className="text-sm text-primary">
          ← Back to academic years
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/academic/years" className="text-sm text-primary">
            ← Academic years
          </Link>
          <h2 className="text-xl font-semibold text-foreground">
            {year.data ? `Terms — ${year.data.name}` : "Terms"}
          </h2>
          {year.data ? (
            <p className="text-sm text-muted-foreground">
              {year.data.startDate} → {year.data.endDate} · {year.data.status}
            </p>
          ) : null}
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
            New term
          </button>
        ) : null}
      </div>

      <TableShell
        head={["Name", "Start", "End", "Actions"]}
        isLoading={terms.isLoading}
        isError={terms.isError}
        isEmpty={(terms.data ?? []).length === 0}
        emptyText="No terms in this year yet."
      >
        {(terms.data ?? []).map((term) => (
          <tr key={term.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{term.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{term.startDate}</td>
            <td className="px-4 py-3 text-muted-foreground">{term.endDate}</td>
            <td className="px-4 py-3">
              {canManage ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      create.reset();
                      update.reset();
                      setEditing(term);
                    }}
                    className={smallGhostBtn}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove.reset();
                      setDeleting(term);
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
        <TermFormModal
          term={editing === "new" ? null : editing}
          busy={create.isPending || update.isPending}
          error={create.error?.message ?? update.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing === "new") create.mutate({ academicYearId: yearId, ...values }, done);
            else update.mutate({ id: editing.id, ...values }, done);
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDelete
          title="Delete term"
          message={`Permanently delete “${deleting.name}”? This cannot be undone.`}
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

function TermFormModal({
  term,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  term: AcademicTermDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string; startDate: string; endDate: string }) => void;
}) {
  const [name, setName] = useState(term?.name ?? "");
  const [startDate, setStartDate] = useState<string>(term?.startDate ?? "");
  const [endDate, setEndDate] = useState<string>(term?.endDate ?? "");

  return (
    <Modal title={term ? "Edit term" : "New term"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), startDate, endDate });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Term 1"
            required
          />
        </label>
        <label className={labelClass}>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className={labelClass}>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
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
