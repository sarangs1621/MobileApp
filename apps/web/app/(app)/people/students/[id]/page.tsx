"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { primaryBtn } from "@/src/components/academic/ui";
import { DocumentsPanel } from "@/src/components/people/documents-panel";
import { EnrollmentsPanel } from "@/src/components/people/enrollments-panel";
import { GuardiansPanel } from "@/src/components/people/guardians-panel";
import { StudentFormModal, type StudentFormValues } from "@/src/components/people/student-form";
import { trpc } from "@/src/trpc/react";

/**
 * Student detail: identity card (edit here), then the three ownership panels —
 * enrollment history (ADR-010 placement), guardians (StudentParent links), and
 * documents (private-bucket metadata). Action visibility follows the manage
 * permissions; the services stay authoritative.
 */
export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canManageStudent = role !== undefined && can(role, PERMISSIONS.STUDENT_MANAGE);
  const canManageEnrollment = role !== undefined && can(role, PERMISSIONS.ENROLLMENT_MANAGE);
  const canManageParents = role !== undefined && can(role, PERMISSIONS.PARENT_MANAGE);
  const canManageDocuments = role !== undefined && can(role, PERMISSIONS.STUDENT_DOCUMENT_MANAGE);
  const canReadAcademic = role !== undefined && can(role, PERMISSIONS.ACADEMIC_READ);
  const canReadParents = role !== undefined && can(role, PERMISSIONS.PARENT_READ);

  const student = trpc.student.get.useQuery({ id: studentId });
  const utils = trpc.useUtils();
  const update = trpc.student.update.useMutation({
    onSuccess: () => {
      void utils.student.get.invalidate({ id: studentId });
      void utils.student.list.invalidate();
    },
  });

  const [editing, setEditing] = useState(false);

  if (student.isError) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-destructive">Student not found, or you don’t have access.</p>
        <Link href="/people/students" className="text-sm text-primary">
          ← Back to students
        </Link>
      </section>
    );
  }

  const data = student.data;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/people/students" className="text-sm text-primary">
            ← Students
          </Link>
          <h2 className="text-xl font-semibold text-foreground">
            {data ? `${data.firstName} ${data.lastName}` : "Student"}
          </h2>
          {data ? (
            <p className="text-sm text-muted-foreground">
              Admission no {data.admissionNo} · {data.status}
            </p>
          ) : null}
        </div>
        {canManageStudent && data ? (
          <button
            type="button"
            onClick={() => {
              update.reset();
              setEditing(true);
            }}
            className={primaryBtn}
          >
            Edit details
          </button>
        ) : null}
      </div>

      {data === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-border bg-card p-4 sm:grid-cols-3">
          <IdentityField label="Date of birth" value={data.dob} />
          <IdentityField label="Gender" value={data.gender} />
          <IdentityField label="Blood group" value={data.bloodGroup} />
          <IdentityField label="Nationality" value={data.nationality} />
          <IdentityField label="Aadhaar" value={data.aadhaar} />
          <IdentityField label="Passport" value={data.passport} />
          <div className="col-span-2 sm:col-span-3">
            <IdentityField label="Address" value={data.address} />
          </div>
        </dl>
      )}

      <EnrollmentsPanel
        studentId={studentId}
        canManage={canManageEnrollment}
        canReadAcademic={canReadAcademic}
      />
      <GuardiansPanel
        studentId={studentId}
        canManage={canManageParents}
        canReadParents={canReadParents}
      />
      <DocumentsPanel studentId={studentId} canManage={canManageDocuments} />

      {editing && data ? (
        <StudentFormModal
          student={data}
          busy={update.isPending}
          error={update.error?.message ?? null}
          onClose={() => setEditing(false)}
          onSubmit={(values: StudentFormValues) =>
            update.mutate(
              {
                id: data.id,
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
              { onSuccess: () => setEditing(false) },
            )
          }
        />
      ) : null}
    </section>
  );
}

function IdentityField({ label, value }: { label: string; value: ReactNode | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
