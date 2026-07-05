"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { StudentDto, StudentStatusKey } from "@repo/types";
import Link from "next/link";
import { useCallback, useState } from "react";

import {
  inputClass,
  labelClass,
  ListToolbar,
  Paginator,
  primaryBtn,
  smallDangerBtn,
  smallGhostBtn,
  TableShell,
  usePagedSearch,
} from "@/src/components/academic/ui";
import { ConfirmAction } from "@/src/components/people/confirm";
import { StudentFormModal, type StudentFormValues } from "@/src/components/people/student-form";
import { trpc } from "@/src/trpc/react";

const STATUSES: readonly StudentStatusKey[] = ["ACTIVE", "ARCHIVED", "GRADUATED", "WITHDRAWN"];

/**
 * Students CRUD (identity only — placement lives on Enrollment, ADR-010).
 * Status filters server-side; search is client-side over the bounded list. Row
 * scope (teacher → own sections, parent → own children) is applied by the
 * service, so non-admins simply see a shorter list with no actions.
 */
export default function StudentsPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.STUDENT_MANAGE);

  const [status, setStatus] = useState<StudentStatusKey | "">("");
  const students = trpc.student.list.useQuery(status ? { status } : undefined);
  const utils = trpc.useUtils();
  const invalidate = () => utils.student.list.invalidate();

  const create = trpc.student.create.useMutation({ onSuccess: invalidate });
  const update = trpc.student.update.useMutation({ onSuccess: invalidate });
  const archive = trpc.student.archive.useMutation({ onSuccess: invalidate });

  const [editing, setEditing] = useState<StudentDto | "new" | null>(null);
  const [archiving, setArchiving] = useState<StudentDto | null>(null);

  const paged = usePagedSearch(
    students.data,
    useCallback(
      (student: StudentDto, q: string) =>
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(q) ||
        student.admissionNo.toLowerCase().includes(q),
      [],
    ),
  );

  return (
    <section className="flex flex-col gap-4">
      <ListToolbar
        searchValue={paged.query}
        onSearch={paged.setQuery}
        searchLabel="Search students"
        action={
          <div className="flex items-end gap-3">
            <label className={labelClass}>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentStatusKey | "")}
                className={inputClass}
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
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
                New student
              </button>
            ) : null}
          </div>
        }
      />

      <TableShell
        head={["Name", "Admission no", "Date of birth", "Status", "Actions"]}
        isLoading={students.isLoading}
        isError={students.isError}
        isEmpty={paged.total === 0}
        emptyText="No students match."
      >
        {paged.pageItems.map((student) => (
          <tr key={student.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">
              <Link
                href={`/people/students/${student.id}`}
                className="text-primary hover:underline"
              >
                {student.firstName} {student.lastName}
              </Link>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{student.admissionNo}</td>
            <td className="px-4 py-3 text-muted-foreground">{student.dob ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{student.status}</td>
            <td className="px-4 py-3">
              {canManage ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      create.reset();
                      update.reset();
                      setEditing(student);
                    }}
                    className={smallGhostBtn}
                  >
                    Edit
                  </button>
                  {student.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() => {
                        archive.reset();
                        setArchiving(student);
                      }}
                      className={smallDangerBtn}
                    >
                      Archive
                    </button>
                  ) : null}
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
        <ConfirmAction
          title="Archive student"
          message={`Archive “${archiving.firstName} ${archiving.lastName}”? The record is kept (history is never deleted) but the student can no longer be enrolled.`}
          actionLabel="Archive"
          busyLabel="Archiving…"
          busy={archive.isPending}
          error={archive.error?.message ?? null}
          onCancel={() => setArchiving(null)}
          onConfirm={() =>
            archive.mutate({ id: archiving.id }, { onSuccess: () => setArchiving(null) })
          }
        />
      ) : null}
    </section>
  );
}
