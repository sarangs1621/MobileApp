"use client";

import {
  Buildings,
  CalendarBlank,
  CheckCircle,
  Hourglass,
  LockSimple,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { AcademicYearDto, AcademicYearStatusKey } from "@repo/types";
import { cn } from "@repo/ui";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Paginator, usePagedSearch } from "@/src/components/academic/ui";
import {
  Button,
  type Column,
  ConfirmDialog,
  DataTable,
  DateField,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  SearchInput,
  StatusChip,
  TableToolbar,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/** "2026-06-01" → "1 Jun 2026". */
function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Academic-years CRUD. Terms are managed on the year's detail page. */
export default function AcademicYearsPage() {
  const { show } = useToast();
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const years = trpc.academicYear.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.academicYear.list.invalidate();

  const create = trpc.academicYear.create.useMutation({
    onSuccess: () => {
      show("success", "Academic year created");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const update = trpc.academicYear.update.useMutation({
    onSuccess: () => {
      show("success", "Academic year updated");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.academicYear.delete.useMutation({
    onSuccess: () => {
      show("success", "Academic year deleted");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const [editing, setEditing] = useState<AcademicYearDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<AcademicYearDto | null>(null);

  const paged = usePagedSearch(
    years.data,
    useCallback((year: AcademicYearDto, q: string) => year.name.toLowerCase().includes(q), []),
  );

  const activeYear = years.data?.find((y) => y.status === "ACTIVE");

  const columns: Column<AcademicYearDto>[] = [
    {
      key: "name",
      header: "Name",
      render: (year) => (
        <span className="flex items-center gap-2.5 text-[14.5px] font-semibold text-ink-900">
          <CalendarBlank aria-hidden size={17} className="shrink-0 text-maroon-700" />
          {year.name}
        </span>
      ),
    },
    {
      key: "start",
      header: "Start",
      render: (year) => (
        <span className="text-[13.5px] text-ink-500">{fmtDate(year.startDate)}</span>
      ),
    },
    {
      key: "end",
      header: "End",
      render: (year) => <span className="text-[13.5px] text-ink-500">{fmtDate(year.endDate)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (year) => <StatusChip status={year.status} dot={year.status === "ACTIVE"} />,
    },
    {
      key: "terms",
      header: "Terms",
      render: (year) => (
        <Link
          href={`/academic/years/${year.id}`}
          className="text-[13px] font-semibold text-maroon-700 hover:text-maroon-800"
        >
          Manage terms →
        </Link>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (year) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <IconButton
              label="Edit"
              icon={PencilSimple}
              onClick={() => {
                create.reset();
                update.reset();
                setEditing(year);
              }}
            />
            <IconButton
              label="Delete"
              tone="danger"
              icon={Trash}
              onClick={() => {
                remove.reset();
                setDeleting(year);
              }}
            />
          </div>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <DataTable
        columns={columns}
        rows={paged.pageItems}
        rowKey={(year) => year.id}
        loading={years.isLoading}
        error={years.isError}
        onRetry={() => years.refetch()}
        toolbar={
          <TableToolbar
            search={
              <SearchInput
                placeholder="Search years…"
                value={paged.query}
                onChange={(e) => paged.setQuery(e.target.value)}
              />
            }
            count={`${paged.total} academic year${paged.total === 1 ? "" : "s"}`}
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
                  New academic year
                </Button>
              ) : undefined
            }
          />
        }
        empty={
          <EmptyState
            icon={Buildings}
            title="No academic years yet."
            message="Create the first session (e.g. 2026-27) to start setting up classes and terms."
            action={
              canManage ? (
                <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                  New academic year
                </Button>
              ) : undefined
            }
          />
        }
        footer={
          <Paginator
            page={paged.page}
            pageCount={paged.pageCount}
            total={paged.total}
            onPage={paged.setPage}
          />
        }
      />

      {editing !== null ? (
        <YearFormModal
          year={editing === "new" ? null : editing}
          activeYearName={
            activeYear && activeYear.id !== (editing === "new" ? "" : editing.id)
              ? activeYear.name
              : null
          }
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
        <ConfirmDialog
          title="Delete academic year?"
          objectName={deleting.name}
          message="Permanently delete this year and its terms? This cannot be undone —"
          confirmLabel="Delete year"
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

const STATUS_TILES: {
  key: AcademicYearStatusKey;
  label: string;
  icon: typeof Hourglass;
  activeWeight?: "bold";
}[] = [
  { key: "PLANNED", label: "Planned", icon: Hourglass },
  { key: "ACTIVE", label: "Active", icon: CheckCircle, activeWeight: "bold" },
  { key: "CLOSED", label: "Closed", icon: LockSimple },
];

function YearFormModal({
  year,
  activeYearName,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  year: AcademicYearDto | null;
  /** Name of the currently ACTIVE year (other than this one), for the hint. */
  activeYearName: string | null;
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
    <Dialog title={year ? "Edit academic year" : "New academic year"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), startDate, endDate, status });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="2026-27"
          required
        />
        <div className="grid grid-cols-2 gap-3.5">
          <DateField
            label="Start date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <DateField
            label="End date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        {/* Status choice tiles (design handoff §Choice pills) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Status</span>
          <div className="flex gap-2">
            {STATUS_TILES.map((tile) => {
              const selected = status === tile.key;
              const TileIcon = tile.icon;
              return (
                <button
                  key={tile.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setStatus(tile.key)}
                  className={cn(
                    "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-[11px] text-[13px] font-semibold transition-colors duration-fast",
                    selected
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  <TileIcon
                    aria-hidden
                    size={18}
                    weight={selected && tile.activeWeight ? "bold" : "regular"}
                  />
                  {tile.label}
                </button>
              );
            })}
          </div>
          {status === "ACTIVE" && activeYearName ? (
            <span className="text-caption text-ink-400">
              Only one year can be active at a time — activating this one closes {activeYearName}.
            </span>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save academic year
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
