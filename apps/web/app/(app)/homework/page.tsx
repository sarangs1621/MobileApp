"use client";

import type { HomeworkTargetDto } from "@repo/types";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { HW_STATUS_LABEL } from "@/src/components/homework/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Homework dashboard (M6, ADR-013), role-aware:
 * - admin → a year's homework (all states) + create;
 * - teacher → own (subject × section) homework + create;
 * - parent → PUBLISHED/CLOSED homework for their children (§10 or-clause).
 * Lifecycle, files, submissions + review live on the detail page.
 */
export default function HomeworkDashboardPage() {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "OFFICE_ADMIN";
  const isParent = role === "PARENT";
  const canManage = role === "SUPER_ADMIN" || role === "OFFICE_ADMIN" || role === "TEACHER";

  const years = trpc.academicYear.list.useQuery(undefined, { enabled: isAdmin });
  const [yearId, setYearId] = useState("");
  useEffect(() => {
    if (isAdmin && yearId === "" && years.data) {
      const active = years.data.find((y) => y.status === "ACTIVE") ?? years.data[0];
      if (active) setYearId(active.id);
    }
  }, [isAdmin, years.data, yearId]);

  const homework = trpc.homework.list.useQuery(isAdmin ? { academicYearId: yearId } : {}, {
    enabled: !isAdmin || yearId !== "",
  });
  const targets = trpc.homework.targets.useQuery(undefined, { enabled: canManage });
  const label = new Map(
    (targets.data ?? []).map((t) => [
      `${t.subjectId}:${t.sectionId}`,
      `${t.subjectName} · ${t.sectionName}`,
    ]),
  );

  const [creating, setCreating] = useState(false);
  const rows = homework.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {isAdmin ? (
          <label className={labelClass}>
            Academic year
            <select
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              className={inputClass}
            >
              {(years.data ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                  {y.status === "ACTIVE" ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div />
        )}
        {canManage ? (
          <button type="button" onClick={() => setCreating(true)} className={primaryBtn}>
            New homework
          </button>
        ) : null}
      </div>

      <TableShell
        head={
          isParent ? ["Title", "Due", "Status"] : ["Title", "Subject · Section", "Due", "Status"]
        }
        isLoading={homework.isLoading}
        isError={homework.isError}
        isEmpty={rows.length === 0}
        emptyText={isParent ? "No homework published for your children yet." : "No homework yet."}
      >
        {rows.map((h) => (
          <tr key={h.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">
              <Link href={`/homework/${h.id}`} className="text-primary hover:underline">
                {h.title}
              </Link>
            </td>
            {!isParent ? (
              <td className="px-4 py-3 text-muted-foreground">
                {label.get(`${h.subjectId}:${h.sectionId}`) ?? "—"}
              </td>
            ) : null}
            <td className="px-4 py-3 text-muted-foreground">{h.dueDate}</td>
            <td className="px-4 py-3 text-muted-foreground">{HW_STATUS_LABEL[h.status]}</td>
          </tr>
        ))}
      </TableShell>

      {creating ? (
        <CreateHomeworkModal
          targets={targets.data ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            void homework.refetch();
            setCreating(false);
          }}
        />
      ) : null}
    </section>
  );
}

function CreateHomeworkModal({
  targets,
  onClose,
  onCreated,
}: {
  targets: HomeworkTargetDto[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const create = trpc.homework.create.useMutation({ onSuccess: onCreated });
  const [pair, setPair] = useState(
    targets[0] ? `${targets[0].subjectId}:${targets[0].sectionId}` : "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const selected = targets.find((t) => `${t.subjectId}:${t.sectionId}` === pair);

  return (
    <Modal title="New homework" onClose={onClose}>
      {targets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no subject/section assignments to create homework for. (Admins: create from a
          teacher account, or assign yourself in academic structure.)
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selected) return;
            create.mutate({
              subjectId: selected.subjectId,
              sectionId: selected.sectionId,
              title: title.trim(),
              description: description.trim() === "" ? null : description.trim(),
              dueDate,
            });
          }}
          className="flex flex-col gap-3"
        >
          <label className={labelClass}>
            Subject &amp; section
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className={inputClass}
              required
            >
              {targets.map((t) => (
                <option
                  key={`${t.subjectId}:${t.sectionId}`}
                  value={`${t.subjectId}:${t.sectionId}`}
                >
                  {t.subjectName} · {t.sectionName}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className={labelClass}>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              rows={3}
            />
          </label>
          <label className={labelClass}>
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
              required
            />
          </label>
          {create.error ? <p className="text-sm text-destructive">{create.error.message}</p> : null}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={outlineBtn}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || title.trim() === ""}
              className={primaryBtn}
            >
              {create.isPending ? "Creating…" : "Create draft"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
