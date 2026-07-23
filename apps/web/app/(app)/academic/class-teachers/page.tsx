"use client";

import { Info, UserCircleDashed } from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { ClassTeacherAssignmentDto } from "@repo/types";
import { useMemo, useState } from "react";

import {
  Avatar,
  Button,
  type Column,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Select,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Class Teacher Management (M6.5, ADR-015; restyled per the design handoff).
 * One class teacher per (year × section); a replacement is an in-place update
 * (never a second row). Management actions require ACADEMIC_MANAGE (enforced in
 * the service); the view requires ACADEMIC_READ (the section layout gate).
 * There is no list endpoint by design — the roster is one `classTeacher.get`
 * per section.
 */
export default function ClassTeachersPage() {
  const { show } = useToast();
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const years = trpc.academicYear.list.useQuery();
  const classes = trpc.class.list.useQuery();
  const sectionLists = trpc.useQueries((t) =>
    (classes.data ?? []).map((item) => t.section.list({ classId: item.id })),
  );

  const activeYear = years.data?.find((y) => y.status === "ACTIVE");
  const [pickedYearId, setPickedYearId] = useState("");
  const yearId = pickedYearId || activeYear?.id || "";
  const yearName = years.data?.find((y) => y.id === yearId)?.name;

  const className = useMemo(
    () => new Map((classes.data ?? []).map((c) => [c.id, c.name])),
    [classes.data],
  );
  const allSections = useMemo(
    () => sectionLists.flatMap((query) => query.data ?? []),
    [sectionLists],
  );
  const sectionLabel = (id: string, classId: string, name: string) =>
    `${className.get(classId) ?? ""} ${name}`.trim() || id;

  // No list endpoint (Get-only surface, ADR-015): the roster is one get per section.
  const classTeacherQueries = trpc.useQueries((t) =>
    yearId
      ? allSections.map((s) => t.classTeacher.get({ academicYearId: yearId, sectionId: s.id }))
      : [],
  );
  const bySection = new Map(allSections.map((s, i) => [s.id, classTeacherQueries[i]]));

  const utils = trpc.useUtils();
  const invalidate = () => utils.classTeacher.get.invalidate();
  const assign = trpc.classTeacher.assign.useMutation({
    onSuccess: () => {
      show("success", "Class teacher assigned");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const replace = trpc.classTeacher.replace.useMutation({
    onSuccess: () => {
      show("success", "Class teacher replaced");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.classTeacher.remove.useMutation({
    onSuccess: () => {
      show("success", "Class teacher removed");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  // Teacher directory for the picker (managers only — they see the assign form).
  const teachers = trpc.teacherProfile.list.useQuery(undefined, { enabled: canManage });
  const teacherOptions = useMemo(
    () =>
      (teachers.data ?? []).map((s) => ({ value: s.userId, label: `${s.name} · ${s.employeeId}` })),
    [teachers.data],
  );

  const [form, setForm] = useState<{
    mode: "assign" | "replace";
    sectionId: string;
    label: string;
    current: { teacherId: string; teacherName: string } | null;
  } | null>(null);
  const [removing, setRemoving] = useState<{
    dto: ClassTeacherAssignmentDto;
    label: string;
  } | null>(null);

  const sectionsLoading = classes.isLoading || sectionLists.some((q) => q.isLoading);
  const unassignedCount = yearId
    ? allSections.filter((s) => {
        const q = bySection.get(s.id);
        return q !== undefined && !q.isLoading && (q.data ?? null) === null;
      }).length
    : 0;

  const columns: Column<(typeof allSections)[number]>[] = [
    {
      key: "section",
      header: "Section",
      render: (section) => (
        <span className="text-[14.5px] font-semibold text-ink-900">
          {sectionLabel(section.id, section.classId, section.name)}
        </span>
      ),
    },
    {
      key: "teacher",
      header: "Class teacher",
      render: (section) => {
        const q = bySection.get(section.id);
        const dto = q?.data ?? null;
        if (!yearId) return <span className="text-ink-500">—</span>;
        if (q?.isLoading) return <span className="text-ink-400">…</span>;
        if (dto == null) {
          return (
            <span className="flex items-center gap-2 text-[13.5px] text-ink-400">
              <UserCircleDashed aria-hidden size={20} />
              Not assigned
            </span>
          );
        }
        return (
          <span className="flex items-center gap-3">
            <Avatar name={dto.teacherName} size="sm" />
            <span className="text-sm font-semibold text-ink-900">
              {dto.teacherName}
              {dto.teacherId === me.data?.userId ? " (You)" : ""}
            </span>
          </span>
        );
      },
    },
    {
      key: "since",
      header: "Since",
      render: (section) => {
        const dto = bySection.get(section.id)?.data ?? null;
        return (
          <span className="text-[13.5px] text-ink-500">
            {dto
              ? new Date(dto.assignedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (section) => {
        const dto = bySection.get(section.id)?.data ?? null;
        const label = sectionLabel(section.id, section.classId, section.name);
        if (!canManage || !yearId) return <span className="text-ink-400">—</span>;
        if (dto == null) {
          return (
            <button
              type="button"
              onClick={() => {
                assign.reset();
                setForm({ mode: "assign", sectionId: section.id, label, current: null });
              }}
              className="cursor-pointer rounded-full bg-maroon-700 px-4 py-2 text-[12.5px] font-semibold text-cream-50 transition-colors duration-fast hover:bg-maroon-800"
            >
              Assign teacher
            </button>
          );
        }
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                replace.reset();
                setForm({
                  mode: "replace",
                  sectionId: section.id,
                  label,
                  current: { teacherId: dto.teacherId, teacherName: dto.teacherName },
                });
              }}
              className="cursor-pointer rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                remove.reset();
                setRemoving({ dto, label });
              }}
              className="cursor-pointer px-1 py-[7px] text-[12.5px] font-semibold text-red-600 transition-colors duration-fast hover:text-maroon-900"
            >
              Remove
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex max-w-[220px] flex-col">
        <Select
          label="Academic year"
          value={yearId}
          onChange={(e) => setPickedYearId(e.target.value)}
        >
          {(years.data ?? []).map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
              {y.status === "ACTIVE" ? " (active)" : ""}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={allSections}
        rowKey={(section) => section.id}
        loading={sectionsLoading || years.isLoading}
        error={classes.isError || years.isError}
        onRetry={() => {
          classes.refetch();
          years.refetch();
        }}
        empty={
          <EmptyState
            title="No sections yet."
            message="Create classes and sections first — then assign each section its class teacher."
          />
        }
      />

      {yearId && unassignedCount > 0 ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
          <Info aria-hidden size={15} />
          {unassignedCount} of {allSections.length} section{allSections.length === 1 ? "" : "s"}{" "}
          still need{unassignedCount === 1 ? "s" : ""} a class teacher
          {yearName ? ` for ${yearName}` : ""}.
        </p>
      ) : null}
      {!canManage ? (
        <p className="text-[12.5px] text-ink-400">Read-only — you can’t manage class teachers.</p>
      ) : null}

      {form !== null ? (
        <ClassTeacherFormModal
          mode={form.mode}
          sectionLabel={form.label}
          teachers={teacherOptions}
          current={form.current}
          busy={form.mode === "assign" ? assign.isPending : replace.isPending}
          error={(form.mode === "assign" ? assign.error : replace.error)?.message ?? null}
          onClose={() => setForm(null)}
          onSubmit={(teacherId) => {
            const input = { academicYearId: yearId, sectionId: form.sectionId, teacherId };
            const opts = { onSuccess: () => setForm(null) };
            if (form.mode === "assign") assign.mutate(input, opts);
            else replace.mutate(input, opts);
          }}
        />
      ) : null}

      {removing !== null ? (
        <ConfirmDialog
          title="Remove class teacher?"
          confirmLabel="Remove"
          message={`Remove ${removing.dto.teacherName} as class teacher of ${removing.label}? This frees the slot; history stays in the audit log.`}
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            remove.mutate({ id: removing.dto.id }, { onSuccess: () => setRemoving(null) })
          }
        />
      ) : null}
    </section>
  );
}

function ClassTeacherFormModal({
  mode,
  sectionLabel,
  teachers,
  current,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  mode: "assign" | "replace";
  sectionLabel: string;
  teachers: readonly { value: string; label: string }[];
  current: { teacherId: string; teacherName: string } | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (teacherId: string) => void;
}) {
  const [teacherId, setTeacherId] = useState("");

  return (
    <Dialog title={`Class teacher — ${sectionLabel}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(teacherId);
        }}
        className="flex flex-col gap-[18px]"
      >
        {mode === "replace" && current ? (
          <div className="flex items-center gap-3 rounded-xl border border-subtle bg-cream-50 px-3.5 py-3">
            <Avatar name={current.teacherName} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="text-sm font-semibold text-ink-900">{current.teacherName}</span>
              <span className="text-caption text-ink-500">
                Current class teacher — kept in the audit log if replaced.
              </span>
            </span>
          </div>
        ) : null}
        <Select
          label={mode === "replace" ? "New teacher" : "Teacher"}
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          helper="Only active users with the Teacher role appear."
          required
        >
          <option value="">Select a teacher…</option>
          {teachers.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {mode === "assign" ? "Assign teacher" : "Replace teacher"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
