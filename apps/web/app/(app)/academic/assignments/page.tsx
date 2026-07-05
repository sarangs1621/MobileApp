"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { TeacherAssignmentDto } from "@repo/types";
import { useMemo, useState } from "react";

import {
  ConfirmDelete,
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  smallDangerBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Teacher-assignments CRUD (assignments are immutable — create/delete only).
 * Filters are server-side (the list procedure accepts teacher/subject/section).
 * Teachers are referenced by user id: there is no people directory until M3,
 * and the M2 API surface is limited to the six academic routers by design.
 */
export default function TeacherAssignmentsPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const subjects = trpc.subject.list.useQuery();
  const classes = trpc.class.list.useQuery();
  const sectionLists = trpc.useQueries((t) =>
    (classes.data ?? []).map((item) => t.section.list({ classId: item.id })),
  );

  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");

  const assignments = trpc.teacherAssignment.list.useQuery({
    ...(filterSubjectId ? { subjectId: filterSubjectId } : {}),
    ...(filterSectionId ? { sectionId: filterSectionId } : {}),
    ...(filterTeacherId.trim() ? { teacherId: filterTeacherId.trim() } : {}),
  });

  const utils = trpc.useUtils();
  const invalidate = () => utils.teacherAssignment.list.invalidate();
  const create = trpc.teacherAssignment.create.useMutation({ onSuccess: invalidate });
  const remove = trpc.teacherAssignment.delete.useMutation({ onSuccess: invalidate });

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TeacherAssignmentDto | null>(null);

  const subjectName = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s.name])),
    [subjects.data],
  );
  const className = useMemo(
    () => new Map((classes.data ?? []).map((c) => [c.id, c.name])),
    [classes.data],
  );
  const allSections = useMemo(
    () => sectionLists.flatMap((query) => query.data ?? []),
    [sectionLists],
  );
  const sectionLabel = useMemo(
    () =>
      new Map(allSections.map((s) => [s.id, `${className.get(s.classId) ?? ""} ${s.name}`.trim()])),
    [allSections, className],
  );

  const filterSections = filterClassId
    ? allSections.filter((s) => s.classId === filterClassId)
    : allSections;

  const rows = assignments.data ?? [];
  // Class is a client-side narrowing of the section filter (the API filters by section).
  const visibleRows = filterClassId
    ? rows.filter((row) => {
        const section = allSections.find((s) => s.id === row.sectionId);
        return section?.classId === filterClassId;
      })
    : rows;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            Subject
            <select
              value={filterSubjectId}
              onChange={(e) => setFilterSubjectId(e.target.value)}
              className={inputClass}
            >
              <option value="">All subjects</option>
              {(subjects.data ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Class
            <select
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setFilterSectionId("");
              }}
              className={inputClass}
            >
              <option value="">All classes</option>
              {(classes.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Section
            <select
              value={filterSectionId}
              onChange={(e) => setFilterSectionId(e.target.value)}
              className={inputClass}
            >
              <option value="">All sections</option>
              {filterSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {sectionLabel.get(s.id) ?? s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Teacher user id
            <input
              value={filterTeacherId}
              onChange={(e) => setFilterTeacherId(e.target.value)}
              className={inputClass}
              placeholder="All teachers"
            />
          </label>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              create.reset();
              setCreating(true);
            }}
            className={primaryBtn}
          >
            New assignment
          </button>
        ) : null}
      </div>

      <TableShell
        head={["Teacher", "Subject", "Section", "Actions"]}
        isLoading={assignments.isLoading}
        isError={assignments.isError}
        isEmpty={visibleRows.length === 0}
        emptyText="No teacher assignments match."
      >
        {visibleRows.map((assignment) => (
          <tr key={assignment.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-mono text-xs text-foreground">
              {assignment.teacherId === me.data?.userId ? "You" : assignment.teacherId}
            </td>
            <td className="px-4 py-3 font-medium text-foreground">
              {subjectName.get(assignment.subjectId) ?? assignment.subjectId}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {sectionLabel.get(assignment.sectionId) ?? assignment.sectionId}
            </td>
            <td className="px-4 py-3">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    remove.reset();
                    setDeleting(assignment);
                  }}
                  className={smallDangerBtn}
                >
                  Delete
                </button>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      {creating ? (
        <AssignmentFormModal
          subjects={(subjects.data ?? []).map((s) => ({ id: s.id, label: s.name }))}
          classes={(classes.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
          sectionsByClass={(classId) =>
            allSections
              .filter((s) => s.classId === classId)
              .map((s) => ({ id: s.id, label: s.name }))
          }
          busy={create.isPending}
          error={create.error?.message ?? null}
          onClose={() => setCreating(false)}
          onSubmit={(values) => create.mutate(values, { onSuccess: () => setCreating(false) })}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDelete
          title="Delete assignment"
          message={`Permanently remove ${
            subjectName.get(deleting.subjectId) ?? "this subject"
          } for ${sectionLabel.get(deleting.sectionId) ?? "this section"} from this teacher?`}
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

function AssignmentFormModal({
  subjects,
  classes,
  sectionsByClass,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  subjects: readonly { id: string; label: string }[];
  classes: readonly { id: string; label: string }[];
  sectionsByClass: (classId: string) => readonly { id: string; label: string }[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { teacherId: string; subjectId: string; sectionId: string }) => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const sections = classId ? sectionsByClass(classId) : [];

  return (
    <Modal title="New teacher assignment" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ teacherId: teacherId.trim(), subjectId, sectionId });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Teacher user id
          <input
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className={`${inputClass} font-mono`}
            placeholder="usr_…"
            required
          />
          <span className="text-xs font-normal text-muted-foreground">
            The teacher’s user id (a teacher directory arrives with M3 people records). The teacher
            must be an ACTIVE user with the TEACHER role.
          </span>
        </label>
        <label className={labelClass}>
          Subject
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">Select a subject…</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Class
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
            }}
            className={inputClass}
            required
          >
            <option value="">Select a class…</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Section
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className={inputClass}
            disabled={!classId}
            required
          >
            <option value="">Select a section…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
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
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
