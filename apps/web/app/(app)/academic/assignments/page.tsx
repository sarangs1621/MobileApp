"use client";

import { Plus, Trash, UserCheck } from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { TeacherAssignmentDto } from "@repo/types";
import { useMemo, useState } from "react";

import {
  Avatar,
  Button,
  type Column,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  IconButton,
  Select,
  TableToolbar,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Teacher-assignments CRUD (assignments are immutable — create/delete only).
 * Filters are server-side (the list procedure accepts teacher/subject/section).
 * Teachers are picked BY NAME via the existing `teacherProfile.list` directory
 * (design handoff: "no user ids to copy around") — managers see names
 * everywhere; non-managers (who can't fetch the directory) still see raw ids.
 */
export default function TeacherAssignmentsPage() {
  const { show } = useToast();
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const subjects = trpc.subject.list.useQuery();
  const classes = trpc.class.list.useQuery();
  const sectionLists = trpc.useQueries((t) =>
    (classes.data ?? []).map((item) => t.section.list({ classId: item.id })),
  );
  // Name directory (admins only — same gating as the class-teachers screen).
  const teachers = trpc.teacherProfile.list.useQuery(undefined, { enabled: canManage });
  const teacherById = useMemo(
    () => new Map((teachers.data ?? []).map((t) => [t.userId, t])),
    [teachers.data],
  );

  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");

  const assignments = trpc.teacherAssignment.list.useQuery({
    ...(filterSubjectId ? { subjectId: filterSubjectId } : {}),
    ...(filterSectionId ? { sectionId: filterSectionId } : {}),
    ...(filterTeacherId ? { teacherId: filterTeacherId } : {}),
  });

  const utils = trpc.useUtils();
  const invalidate = () => utils.teacherAssignment.list.invalidate();
  const create = trpc.teacherAssignment.create.useMutation({
    onSuccess: () => {
      show("success", "Assignment created");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.teacherAssignment.delete.useMutation({
    onSuccess: () => {
      show("success", "Assignment removed");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });

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

  const teacherCell = (teacherId: string) => {
    const profile = teacherById.get(teacherId);
    const isYou = teacherId === me.data?.userId;
    if (!profile) {
      return <span className="font-mono text-xs text-ink-800">{isYou ? "You" : teacherId}</span>;
    }
    return (
      <span className="flex items-center gap-3">
        <Avatar name={profile.name} size="sm" />
        <span className="flex flex-col gap-px">
          <span className="text-sm font-semibold text-ink-900">
            {profile.name}
            {isYou ? " (You)" : ""}
          </span>
          <span className="text-caption text-ink-400">{profile.employeeId} · Teacher</span>
        </span>
      </span>
    );
  };

  const columns: Column<TeacherAssignmentDto>[] = [
    { key: "teacher", header: "Teacher", render: (a) => teacherCell(a.teacherId) },
    {
      key: "subject",
      header: "Subject",
      render: (a) => (
        <span className="text-[13.5px] font-semibold text-maroon-800">
          {subjectName.get(a.subjectId) ?? a.subjectId}
        </span>
      ),
    },
    {
      key: "section",
      header: "Section",
      render: (a) => (
        <span className="text-[13.5px] text-ink-500">
          {sectionLabel.get(a.sectionId) ?? a.sectionId}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (a) =>
        canManage ? (
          <div className="flex justify-end">
            <IconButton
              label="Delete"
              tone="danger"
              icon={Trash}
              onClick={() => {
                remove.reset();
                setDeleting(a);
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
        rows={visibleRows}
        rowKey={(a) => a.id}
        loading={assignments.isLoading}
        error={assignments.isError}
        onRetry={() => assignments.refetch()}
        toolbar={
          <TableToolbar
            filters={
              <>
                <Select
                  label="Subject"
                  value={filterSubjectId}
                  onChange={(e) => setFilterSubjectId(e.target.value)}
                  className="min-w-[150px]"
                >
                  <option value="">All subjects</option>
                  {(subjects.data ?? []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Class"
                  value={filterClassId}
                  onChange={(e) => {
                    setFilterClassId(e.target.value);
                    setFilterSectionId("");
                  }}
                  className="min-w-[130px]"
                >
                  <option value="">All classes</option>
                  {(classes.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Section"
                  value={filterSectionId}
                  onChange={(e) => setFilterSectionId(e.target.value)}
                  className="min-w-[120px]"
                >
                  <option value="">All sections</option>
                  {filterSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sectionLabel.get(s.id) ?? s.name}
                    </option>
                  ))}
                </Select>
                {canManage ? (
                  <Select
                    label="Teacher"
                    value={filterTeacherId}
                    onChange={(e) => setFilterTeacherId(e.target.value)}
                    className="min-w-[170px]"
                  >
                    <option value="">All teachers</option>
                    {(teachers.data ?? []).map((t) => (
                      <option key={t.userId} value={t.userId}>
                        {t.name} · {t.employeeId}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </>
            }
            actions={
              canManage ? (
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    create.reset();
                    setCreating(true);
                  }}
                >
                  New assignment
                </Button>
              ) : undefined
            }
          />
        }
        empty={
          <EmptyState
            icon={UserCheck}
            title="No teacher assignments match."
            message="Assignments connect a teacher to a subject in one section — they power homework, marks and timetables."
            action={
              canManage ? (
                <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                  New assignment
                </Button>
              ) : undefined
            }
          />
        }
      />

      {creating ? (
        <AssignmentFormModal
          teachers={(teachers.data ?? []).map((t) => ({
            id: t.userId,
            label: `${t.name} · ${t.employeeId}`,
          }))}
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
        <ConfirmDialog
          title="Remove assignment?"
          message={`${
            teacherById.get(deleting.teacherId)?.name ?? "This teacher"
          } will no longer teach ${subjectName.get(deleting.subjectId) ?? "this subject"} for ${
            sectionLabel.get(deleting.sectionId) ?? "this section"
          }.`}
          confirmLabel="Remove"
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
  teachers,
  subjects,
  classes,
  sectionsByClass,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  teachers: readonly { id: string; label: string }[];
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
    <Dialog title="New teacher assignment" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ teacherId, subjectId, sectionId });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Select
          label="Teacher"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          helper="Pick by name — no user ids to copy around. Only active users with the Teacher role appear."
          required
        >
          <option value="">Select a teacher…</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          label="Subject"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          required
        >
          <option value="">Select a subject…</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.label}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3.5">
          <Select
            label="Class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
            }}
            required
          >
            <option value="">Select a class…</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select
            label="Section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!classId}
            required
          >
            <option value="">Select a section…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create assignment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
