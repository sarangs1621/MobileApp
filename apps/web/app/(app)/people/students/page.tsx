"use client";

import { Archive, PencilSimple, Plus, UploadSimple, Users } from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { StudentDto, StudentStatusKey } from "@repo/types";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Paginator, usePagedSearch } from "@/src/components/academic/ui";
import { ImportCsvDialog } from "@/src/components/people/import-csv";
import { StudentFormModal, type StudentFormValues } from "@/src/components/people/student-form";
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  SearchInput,
  Select,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const STATUSES: readonly StudentStatusKey[] = ["ACTIVE", "ARCHIVED", "GRADUATED", "WITHDRAWN"];
const STATUS_LABEL: Record<StudentStatusKey, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  GRADUATED: "Graduated",
  WITHDRAWN: "Withdrawn",
};

/** "2019-03-09" → "9 Mar 2019". */
function fmtDob(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Whole years between a DOB and today (school time). */
function ageYears(iso: string): number | null {
  const dob = new Date(iso + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/**
 * Students directory (M3; design handoff §6 — Students tab). Identity CRUD
 * (placement lives on Enrollment, ADR-010). The section column + filter join the
 * active year's section rosters client-side (no bulk enrollment endpoint). Status
 * filters server-side; search is client-side over the bounded list. Row scope
 * (teacher → own sections, parent → own children) is applied by the service.
 */
export default function StudentsPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.STUDENT_MANAGE);
  const canReadSections = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_READ);
  const { show } = useToast();

  const [status, setStatus] = useState<StudentStatusKey | "">("");
  const [sectionFilter, setSectionFilter] = useState("");
  const students = trpc.student.list.useQuery(status ? { status } : undefined);

  // Section map: active year × all sections → studentId → section label.
  const years = trpc.academicYear.list.useQuery(undefined, { enabled: canReadSections });
  const activeYearId = years.data?.find((y) => y.status === "ACTIVE")?.id;
  const classes = trpc.class.list.useQuery(undefined, { enabled: canReadSections });
  const sectionLists = trpc.useQueries((t) =>
    canReadSections ? (classes.data ?? []).map((c) => t.section.list({ classId: c.id })) : [],
  );
  const allSections = useMemo(() => {
    const className = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
    return sectionLists.flatMap((q) =>
      (q.data ?? []).map((s) => ({
        id: s.id,
        label: `${className.get(s.classId) ?? ""} ${s.name}`.trim(),
      })),
    );
  }, [classes.data, sectionLists]);
  const rosters = trpc.useQueries((t) =>
    activeYearId
      ? allSections.map((s) =>
          t.enrollment.sectionRoster({ academicYearId: activeYearId, sectionId: s.id }),
        )
      : [],
  );
  const studentSection = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    rosters.forEach((q, i) => {
      const section = allSections[i];
      if (!section) return;
      (q.data ?? []).forEach((row) => map.set(row.studentId, section));
    });
    return map;
  }, [rosters, allSections]);

  const utils = trpc.useUtils();
  const invalidate = () => utils.student.list.invalidate();
  const create = trpc.student.create.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Student saved");
    },
    onError: (e) => show("error", e.message),
  });
  const update = trpc.student.update.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Student saved");
    },
    onError: (e) => show("error", e.message),
  });
  const archive = trpc.student.archive.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Student archived");
    },
    onError: (e) => show("error", e.message),
  });

  const [editing, setEditing] = useState<StudentDto | "new" | null>(null);
  const [archiving, setArchiving] = useState<StudentDto | null>(null);
  const [importing, setImporting] = useState(false);

  const paged = usePagedSearch(
    students.data,
    useCallback(
      (student: StudentDto, q: string) =>
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(q) ||
        student.admissionNo.toLowerCase().includes(q),
      [],
    ),
  );

  // Section filter is applied on top of the paged/searched list, client-side.
  const visible = sectionFilter
    ? paged.pageItems.filter((s) => studentSection.get(s.id)?.id === sectionFilter)
    : paged.pageItems;

  return (
    <section className="flex flex-col gap-3.5">
      {/* Filters + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          placeholder="Search name or admission no…"
          value={paged.query}
          onChange={(e) => paged.setQuery(e.target.value)}
          aria-label="Search students"
          className="min-w-[260px]"
        />
        <div className="min-w-[140px]">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentStatusKey | "")}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        {canReadSections ? (
          <div className="min-w-[130px]">
            <Select
              label="Section"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="">All sections</option>
              {allSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="flex-1" />
        {canManage ? (
          <>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-4 py-2.5 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
            >
              <UploadSimple aria-hidden size={15} />
              Import CSV
            </button>
            <Button
              size="sm"
              icon={Plus}
              onClick={() => {
                create.reset();
                update.reset();
                setEditing("new");
              }}
            >
              New student
            </Button>
          </>
        ) : null}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1.7fr_1fr_1.1fr_0.9fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Student</span>
          <span>Section</span>
          <span>Date of birth</span>
          <span>Status</span>
          <span className="w-[76px] text-right">Actions</span>
        </div>

        {students.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : students.isError ? (
          <ErrorState onRetry={() => void students.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={paged.total === 0 ? "No students yet." : "No students match."}
            message={
              paged.total === 0 && canManage
                ? "Add the first student, or import a class list from CSV."
                : undefined
            }
            action={
              paged.total === 0 && canManage ? (
                <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                  New student
                </Button>
              ) : undefined
            }
          />
        ) : (
          visible.map((s) => {
            const section = studentSection.get(s.id)?.label;
            const age = s.dob ? ageYears(s.dob) : null;
            return (
              <div
                key={s.id}
                className="grid grid-cols-[1.7fr_1fr_1.1fr_0.9fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3 transition-colors duration-fast last:border-0 hover:bg-cream-50"
              >
                <span className="flex items-center gap-3">
                  <Avatar name={`${s.firstName} ${s.lastName}`} size="sm" />
                  <span className="flex min-w-0 flex-col gap-px">
                    <Link
                      href={`/people/students/${s.id}`}
                      className="truncate text-sm font-semibold text-ink-900 hover:text-maroon-700"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                    <span className="truncate font-mono text-xs text-ink-400">{s.admissionNo}</span>
                  </span>
                </span>
                <span className="text-[13.5px] text-ink-500">
                  {section ?? (canReadSections ? "Not enrolled" : "—")}
                </span>
                <span className="flex flex-col gap-px">
                  <span className="text-[13.5px] text-ink-900">{s.dob ? fmtDob(s.dob) : "—"}</span>
                  {age !== null ? <span className="text-xs text-ink-400">{age} yrs</span> : null}
                </span>
                <span>
                  <StatusChip status={s.status} label={STATUS_LABEL[s.status]} />
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
                          setEditing(s);
                        }}
                      />
                      {s.status === "ACTIVE" ? (
                        <IconButton
                          label="Archive"
                          tone="brand"
                          icon={Archive}
                          className="border-subtle text-ink-500 hover:border-strong hover:bg-cream-100 hover:text-ink-700"
                          onClick={() => {
                            archive.reset();
                            setArchiving(s);
                          }}
                        />
                      ) : null}
                    </>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </span>
              </div>
            );
          })
        )}

        <Paginator
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          onPage={paged.setPage}
        />
      </div>

      {editing !== null ? (
        <StudentFormModal
          student={editing === "new" ? null : editing}
          busy={create.isPending || update.isPending}
          error={create.error?.message ?? update.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values: StudentFormValues) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing === "new") {
              create.mutate(
                {
                  admissionNo: values.admissionNo,
                  firstName: values.firstName,
                  lastName: values.lastName,
                  ...(values.dob ? { dob: values.dob } : {}),
                  ...(values.gender ? { gender: values.gender } : {}),
                  ...(values.bloodGroup ? { bloodGroup: values.bloodGroup } : {}),
                  ...(values.nationality ? { nationality: values.nationality } : {}),
                  ...(values.aadhaar ? { aadhaar: values.aadhaar } : {}),
                  ...(values.passport ? { passport: values.passport } : {}),
                  ...(values.address ? { address: values.address } : {}),
                },
                done,
              );
            } else {
              update.mutate(
                {
                  id: editing.id,
                  firstName: values.firstName,
                  lastName: values.lastName,
                  dob: values.dob,
                  gender: values.gender,
                  bloodGroup: values.bloodGroup,
                  nationality: values.nationality,
                  aadhaar: values.aadhaar,
                  passport: values.passport,
                  address: values.address,
                },
                done,
              );
            }
          }}
        />
      ) : null}

      {archiving !== null ? (
        <ConfirmDialog
          title={`Archive ${archiving.firstName} ${archiving.lastName}?`}
          message="The record is kept forever (history is never deleted), but the student can no longer be enrolled or marked in attendance."
          confirmLabel="Archive student"
          busy={archive.isPending}
          error={archive.error?.message ?? null}
          onCancel={() => setArchiving(null)}
          onConfirm={() =>
            archive.mutate({ id: archiving.id }, { onSuccess: () => setArchiving(null) })
          }
        />
      ) : null}

      {importing ? <ImportCsvDialog onClose={() => setImporting(false)} /> : null}
    </section>
  );
}
