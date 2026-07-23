"use client";

import {
  BookBookmark,
  BookOpen,
  Flask,
  GlobeHemisphereEast,
  PencilSimple,
  Plus,
  PlusMinus,
  TextAa,
  Translate,
  Trash,
  type Icon,
} from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { SubjectDto } from "@repo/types";
import { useCallback, useMemo, useState } from "react";

import { Paginator, usePagedSearch } from "@/src/components/academic/ui";
import {
  Button,
  type Column,
  ConfirmDialog,
  DataTable,
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

/** Best-effort subject icon by name (design handoff §Subjects tab). */
function subjectIcon(name: string): Icon {
  const n = name.toLowerCase();
  if (/english/.test(n)) return TextAa;
  if (/gujarati|hindi|malayalam|sanskrit|language/.test(n)) return Translate;
  if (/math/.test(n)) return PlusMinus;
  if (/science|physics|chemistry|biology/.test(n)) return Flask;
  if (/social|history|geography|civics/.test(n)) return GlobeHemisphereEast;
  return BookOpen;
}

/** Subjects CRUD — a school-wide catalog; names are unique per school. */
export default function SubjectsPage() {
  const { show } = useToast();
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_MANAGE);

  const subjects = trpc.subject.list.useQuery();
  // Assignment counts drive the "in use" badge + the guarded delete (existing API).
  const assignments = trpc.teacherAssignment.list.useQuery({});
  const useCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assignments.data ?? []) {
      counts.set(a.subjectId, (counts.get(a.subjectId) ?? 0) + 1);
    }
    return counts;
  }, [assignments.data]);

  const utils = trpc.useUtils();
  const invalidate = () => utils.subject.list.invalidate();

  const create = trpc.subject.create.useMutation({
    onSuccess: () => {
      show("success", "Subject created");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const update = trpc.subject.update.useMutation({
    onSuccess: () => {
      show("success", "Subject updated");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.subject.delete.useMutation({
    onSuccess: () => {
      show("success", "Subject deleted");
      return invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const [editing, setEditing] = useState<SubjectDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<SubjectDto | null>(null);
  const [blocked, setBlocked] = useState<SubjectDto | null>(null);

  const paged = usePagedSearch(
    subjects.data,
    useCallback((subject: SubjectDto, q: string) => subject.name.toLowerCase().includes(q), []),
  );

  const columns: Column<SubjectDto>[] = [
    {
      key: "name",
      header: "Name",
      render: (subject) => {
        const SubjectIcon = subjectIcon(subject.name);
        return (
          <span className="flex items-center gap-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-maroon-50 text-maroon-700">
              <SubjectIcon aria-hidden size={18} />
            </span>
            <span className="text-[14.5px] font-semibold text-ink-900">{subject.name}</span>
          </span>
        );
      },
    },
    {
      key: "usage",
      header: "Usage",
      render: (subject) => {
        const n = useCount.get(subject.id) ?? 0;
        return n > 0 ? (
          <StatusChip tone="gold" label={`${n} assignment${n === 1 ? "" : "s"}`} />
        ) : (
          <span className="text-[13px] text-ink-400">Not assigned yet</span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (subject) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <IconButton
              label="Edit"
              icon={PencilSimple}
              onClick={() => {
                create.reset();
                update.reset();
                setEditing(subject);
              }}
            />
            <IconButton
              label="Delete"
              tone="danger"
              icon={Trash}
              onClick={() => {
                remove.reset();
                if ((useCount.get(subject.id) ?? 0) > 0) setBlocked(subject);
                else setDeleting(subject);
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
        rowKey={(subject) => subject.id}
        loading={subjects.isLoading}
        error={subjects.isError}
        onRetry={() => subjects.refetch()}
        toolbar={
          <TableToolbar
            search={
              <SearchInput
                placeholder="Search subjects…"
                value={paged.query}
                onChange={(e) => paged.setQuery(e.target.value)}
              />
            }
            count={`${paged.total} subject${paged.total === 1 ? "" : "s"}`}
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
                  New subject
                </Button>
              ) : undefined
            }
          />
        }
        empty={
          <EmptyState
            icon={BookBookmark}
            title="No subjects yet."
            message="Add the subjects taught at the school — they power assignments, homework and exams."
            action={
              canManage ? (
                <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                  New subject
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
        <SubjectFormModal
          subject={editing === "new" ? null : editing}
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
          title="Delete subject?"
          objectName={deleting.name}
          message="Permanently delete this subject? This cannot be undone —"
          confirmLabel="Delete subject"
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}

      {/* In-use subjects can't be deleted (design handoff): explain, don't offer a doomed action. */}
      {blocked !== null ? (
        <Dialog title={`Cannot delete ${blocked.name}`} onClose={() => setBlocked(null)} size="sm">
          <p className="text-sm text-ink-500">
            {blocked.name} has active teacher assignments. Remove those assignments first, then
            delete the subject.
          </p>
          <div className="mt-5 flex justify-end">
            <Button size="sm" onClick={() => setBlocked(null)}>
              OK, got it
            </Button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}

function SubjectFormModal({
  subject,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  subject: SubjectDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string }) => void;
}) {
  const [name, setName] = useState(subject?.name ?? "");

  return (
    <Dialog title={subject ? "Edit subject" : "New subject"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim() });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hindi"
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save subject
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
