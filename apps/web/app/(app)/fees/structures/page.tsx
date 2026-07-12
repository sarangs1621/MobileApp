"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { FeeStructureDto } from "@repo/types";
import Link from "next/link";
import { useState } from "react";

import {
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  smallGhostBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { formatPaise } from "@/src/components/fees/ui";
import { trpc } from "@/src/trpc/react";

interface DraftComponent {
  name: string;
  amount: string; // rupees, as typed
  mandatory: boolean;
}

const emptyComponent = (): DraftComponent => ({ name: "", amount: "", mandatory: true });

/**
 * Fee structures (M13, ADR-021 Step 7) — admin-only (fee:manage). Create/edit named,
 * per-year fee templates and their component lines. Editing components affects only
 * FUTURE invoices (issued invoices keep their snapshotted total — §2).
 */
export default function FeeStructuresPage() {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.FEE_MANAGE);

  const years = trpc.academicYear.list.useQuery(undefined, { enabled: canManage });
  const list = trpc.fee.listStructures.useQuery({}, { enabled: canManage });
  const utils = trpc.useUtils();
  const rows = list.data ?? [];

  const [editing, setEditing] = useState<FeeStructureDto | "new" | null>(null);

  const refresh = () => void utils.fee.listStructures.invalidate();
  const create = trpc.fee.createStructure.useMutation({
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });
  const update = trpc.fee.updateStructure.useMutation({
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });

  if (!me.isLoading && !canManage) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-destructive">You don’t have access to fee structures.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/fees" className="text-sm text-primary">
            ← Fees
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Fee structures</h1>
        </div>
        <button type="button" className={primaryBtn} onClick={() => setEditing("new")}>
          New structure
        </button>
      </header>

      <TableShell
        head={["Name", "Year", "Components", "Total", "Active", ""]}
        isLoading={list.isLoading}
        isError={list.isError}
        isEmpty={rows.length === 0}
        emptyText="No fee structures yet."
      >
        {rows.map((s) => {
          const total = s.components.reduce((sum, c) => sum + (c.mandatory ? c.amount : 0), 0);
          const yearName = years.data?.find((y) => y.id === s.academicYearId)?.name ?? "—";
          return (
            <tr key={s.id} className="border-b border-border align-top last:border-b-0">
              <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{yearName}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.components.length}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatPaise(total)}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.active ? "Yes" : "No"}</td>
              <td className="px-4 py-3">
                <button type="button" className={smallGhostBtn} onClick={() => setEditing(s)}>
                  Edit
                </button>
              </td>
            </tr>
          );
        })}
      </TableShell>

      {editing ? (
        <StructureModal
          initial={editing === "new" ? null : editing}
          years={(years.data ?? []).map((y) => ({ id: y.id, name: y.name }))}
          busy={create.isPending || update.isPending}
          error={(create.error ?? update.error)?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => {
            if (editing === "new") {
              create.mutate(payload);
            } else {
              update.mutate({ id: editing.id, ...payload });
            }
          }}
        />
      ) : null}
    </main>
  );
}

function StructureModal({
  initial,
  years,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  initial: FeeStructureDto | null;
  years: { id: string; name: string }[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    academicYearId: string;
    name: string;
    description: string | null;
    active?: boolean;
    components: { name: string; amount: number; order: number; mandatory: boolean }[];
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [academicYearId, setAcademicYearId] = useState(
    initial?.academicYearId ?? years[0]?.id ?? "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [components, setComponents] = useState<DraftComponent[]>(
    initial
      ? initial.components.map((c) => ({
          name: c.name,
          amount: (c.amount / 100).toString(),
          mandatory: c.mandatory,
        }))
      : [emptyComponent()],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const setComp = (i: number, patch: Partial<DraftComponent>) =>
    setComponents((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const submit = () => {
    const parsed = components
      .filter((c) => c.name.trim() !== "")
      .map((c, i) => ({
        name: c.name.trim(),
        amount: Math.round(Number(c.amount) * 100),
        order: i,
        mandatory: c.mandatory,
      }));
    if (!name.trim() || !academicYearId || parsed.length === 0) {
      setLocalError("Name, year and at least one component are required");
      return;
    }
    if (parsed.some((c) => !Number.isFinite(c.amount) || c.amount < 0)) {
      setLocalError("Every component needs a valid, non-negative amount");
      return;
    }
    setLocalError(null);
    onSubmit({
      academicYearId,
      name: name.trim(),
      description: description.trim() || null,
      ...(initial ? { active } : {}),
      components: parsed,
    });
  };

  return (
    <Modal title={initial ? "Edit fee structure" : "New fee structure"} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className={labelClass}>
          Name
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={labelClass}>
          Academic year
          <select
            className={inputClass}
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            disabled={!!initial}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Description (optional)
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Components (₹)</span>
          {components.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputClass}
                placeholder="Name (e.g. Tuition)"
                value={c.name}
                onChange={(e) => setComp(i, { name: e.target.value })}
              />
              <input
                className={`${inputClass} w-28`}
                placeholder="Amount"
                inputMode="decimal"
                value={c.amount}
                onChange={(e) => setComp(i, { amount: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={c.mandatory}
                  onChange={(e) => setComp(i, { mandatory: e.target.checked })}
                />
                Req.
              </label>
              <button
                type="button"
                className={smallGhostBtn}
                onClick={() => setComponents((cs) => cs.filter((_, idx) => idx !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className={outlineBtn}
            onClick={() => setComponents((cs) => [...cs, emptyComponent()])}
          >
            Add component
          </button>
        </div>

        {initial ? (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (available for invoice generation)
          </label>
        ) : null}

        {(localError ?? error) ? (
          <p className="text-sm text-destructive">{localError ?? error}</p>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className={outlineBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryBtn} disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
