"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { AcademicYearDto, AcademicYearStatusKey } from "@repo/types";
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

const STATUS_OPTIONS: readonly AcademicYearStatusKey[] = ["PLANNED", "ACTIVE", "CLOSED"];
const STATUS_CLASS: Record<AcademicYearStatusKey, string> = {
  ACTIVE: "text-success",
  PLANNED: "text-info",
  CLOSED: "text-muted-foreground",
};

/** Academic-years CRUD. Terms are managed on the year's detail page. */
export default function AcademicYearsPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const years = trpc.academicYear.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.academicYear.list.invalidate();

  const create = trpc.academicYear.create.useMutation({ onSuccess: invalidate });
  const update = trpc.academicYear.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.academicYear.delete.useMutation({ onSuccess: invalidate });

  const [editing, setEditing] = useState<AcademicYearDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<AcademicYearDto | null>(null);

  const paged = usePagedSearch(
    years.data,
    useCallback((year: AcademicYearDto, q: string) => year.name.toLowerCase().includes(q), []),
  );

  return (
    <section className="flex flex-col gap-4">
      <ListToolbar
        searchValue={paged.query}
        onSearch={paged.setQuery}
        searchLabel="Search years"
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
              New academic year
            </button>
          ) : undefined
        }
      />

      <TableShell
        head={["Name", "Start", "End", "Status", "Terms", "Actions"]}
        isLoading={years.isLoading}
        isError={years.isError}
        isEmpty={paged.total === 0}
        emptyText="No academic years yet."
      >
        {paged.pageItems.map((year) => (
          <tr key={year.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{year.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{year.startDate}</td>
            <td className="px-4 py-3 text-muted-foreground">{year.endDate}</td>
            <td className={`px-4 py-3 font-medium ${STATUS_CLASS[year.status]}`}>{year.status}</td>
            <td className="px-4 py-3">
              <Link href={`/academic/years/${year.id}`} className={smallGhostBtn}>
                Manage terms
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
                      setEditing(year);
                    }}
                    className={smallGhostBtn}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove.reset();
                      setDeleting(year);
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
        <YearFormModal
          year={editing === "new" ? null : editing}
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
          title="Delete academic year"
          message={`Permanently delete “${deleting.name}” and its terms? This cannot be undone.`}
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

function YearFormModal({
  year,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  year: AcademicYearDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    startDate: string;
    endDate: string;
    status: AcademicYearStatusKey;
  }) => void;
}) {
  const [name, setName] = useState(year?.name ?? "");
  const [startDate, setStartDate] = useState<string>(year?.startDate ?? "");
  const [endDate, setEndDate] = useState<string>(year?.endDate ?? "");
  const [status, setStatus] = useState<AcademicYearStatusKey>(year?.status ?? "PLANNED");

  return (
    <Modal title={year ? "Edit academic year" : "New academic year"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), startDate, endDate, status });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="2026–27"
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
        <label className={labelClass}>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AcademicYearStatusKey)}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
