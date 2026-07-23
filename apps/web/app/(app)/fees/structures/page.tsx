"use client";

import { Check, Info, Invoice, PencilSimple, Plus, X } from "@phosphor-icons/react";
import type { FeeStructureDto } from "@repo/types";
import { cn } from "@repo/ui";
import { useMemo, useState } from "react";

import { formatPaise } from "@/src/components/fees/ui";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Select,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

interface DraftComponent {
  name: string;
  amount: string; // rupees, as typed
  mandatory: boolean;
}
const emptyComponent = (): DraftComponent => ({ name: "", amount: "", mandatory: true });

/**
 * Fees console — Fee structures tab (M13, ADR-021; design handoff §9). One card
 * per structure showing its components and their Required/Optional flags, with an
 * editor modal (component rows + Required/Optional pill toggle + live total).
 * Editing components affects only FUTURE invoices (issued invoices keep their
 * snapshotted total — §2). Admin-only; the service is the authority.
 */
export default function FeeStructuresPage() {
  const { show } = useToast();
  const years = trpc.academicYear.list.useQuery();
  const list = trpc.fee.listStructures.useQuery({});
  const invoices = trpc.fee.listInvoices.useQuery({});
  const utils = trpc.useUtils();
  const rows = list.data ?? [];

  // Invoice counts per structure (for "used by N invoices").
  const invoiceCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of invoices.data ?? []) {
      map.set(i.feeStructureId, (map.get(i.feeStructureId) ?? 0) + 1);
    }
    return map;
  }, [invoices.data]);
  const yearName = useMemo(
    () => new Map((years.data ?? []).map((y) => [y.id, y.name])),
    [years.data],
  );

  const [editing, setEditing] = useState<FeeStructureDto | "new" | null>(null);

  const refresh = () => void utils.fee.listStructures.invalidate();
  const create = trpc.fee.createStructure.useMutation({
    onSuccess: () => {
      refresh();
      setEditing(null);
      show("success", "Fee structure saved");
    },
    onError: (e) => show("error", e.message),
  });
  const update = trpc.fee.updateStructure.useMutation({
    onSuccess: () => {
      refresh();
      setEditing(null);
      show("success", "Fee structure saved");
    },
    onError: (e) => show("error", e.message),
  });

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center">
        <div className="flex-1" />
        <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
          New structure
        </Button>
      </div>

      {list.isLoading ? (
        <div className="flex flex-col gap-3.5">
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      ) : list.isError ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <ErrorState onRetry={() => void list.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            icon={Invoice}
            title="No fee structures yet."
            message="A structure is a named template of fee components — create one to generate invoices."
            action={
              <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                New structure
              </Button>
            }
          />
        </div>
      ) : (
        rows.map((s) => {
          const total = s.components.reduce((sum, c) => sum + (c.mandatory ? c.amount : 0), 0);
          const used = invoiceCount.get(s.id) ?? 0;
          return (
            <div
              key={s.id}
              className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm"
            >
              <div className="flex items-center gap-3.5 border-b border-cream-100 px-5 py-[18px]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
                  <Invoice aria-hidden size={20} weight="bold" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-lg font-semibold text-ink-900">
                      {s.name}
                    </span>
                    <StatusChip
                      tone={s.active ? "success" : "neutral"}
                      label={s.active ? "Active" : "Inactive"}
                      dot={s.active}
                    />
                  </span>
                  <span className="text-[12.5px] text-ink-500">
                    {yearName.get(s.academicYearId) ?? "—"}
                    {used > 0 ? ` · used by ${used} invoice${used === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                <span className="font-display text-[22px] font-semibold text-ink-900">
                  {formatPaise(total)}
                </span>
                <IconButton label="Edit" icon={PencilSimple} onClick={() => setEditing(s)} />
              </div>

              <div className="grid grid-cols-[1.6fr_1fr_0.8fr] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                <span>Component</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Required</span>
              </div>
              {s.components.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1.6fr_1fr_0.8fr] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
                >
                  <span className="text-sm font-semibold text-ink-900">{c.name}</span>
                  <span className="text-right text-[13.5px] tabular-nums text-ink-700">
                    {formatPaise(c.amount)}
                  </span>
                  <span className="flex justify-end">
                    {c.mandatory ? (
                      <Check aria-hidden size={15} weight="bold" className="text-green-600" />
                    ) : (
                      <span className="text-[12.5px] text-ink-400">Optional</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          );
        })
      )}

      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
        <Info aria-hidden size={15} />
        Structures with invoices can’t be deleted — deactivate them instead to hide from generation.
      </p>

      {editing ? (
        <StructureModal
          initial={editing === "new" ? null : editing}
          years={(years.data ?? []).map((y) => ({ id: y.id, name: y.name }))}
          busy={create.isPending || update.isPending}
          error={(create.error ?? update.error)?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => {
            if (editing === "new") create.mutate(payload);
            else update.mutate({ id: editing.id, ...payload });
          }}
        />
      ) : null}
    </section>
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

  const total = components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

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
      description: initial?.description ?? null,
      ...(initial ? { active } : {}),
      components: parsed,
    });
  };

  const cellInput =
    "min-w-0 rounded-[10px] border border-subtle bg-white px-2.5 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100";

  return (
    <Dialog title="Fee structure" onClose={onClose} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Term Fees 2026-27"
          required
        />
        <Select
          label="Academic year"
          value={academicYearId}
          onChange={(e) => setAcademicYearId(e.target.value)}
          disabled={!!initial}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </Select>

        {/* Components */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-ink-900">Components</span>
            <span className="text-[12.5px] text-ink-500">
              Total:{" "}
              <strong className="text-ink-900">{formatPaise(Math.round(total * 100))}</strong>
            </span>
          </div>
          {components.map((c, i) => (
            <div key={i} className="grid grid-cols-[1.4fr_1fr_auto_32px] items-center gap-2">
              <input
                aria-label={`Component ${i + 1} name`}
                className={cellInput}
                placeholder="Tuition"
                value={c.name}
                onChange={(e) => setComp(i, { name: e.target.value })}
              />
              <input
                aria-label={`Component ${i + 1} amount`}
                className={cellInput}
                placeholder="5000"
                inputMode="decimal"
                value={c.amount}
                onChange={(e) => setComp(i, { amount: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setComp(i, { mandatory: !c.mandatory })}
                title="Required components are always billed; optional ones can be skipped."
                className={cn(
                  "cursor-pointer whitespace-nowrap rounded-full border px-3 py-[7px] text-[11.5px] font-bold transition-colors duration-fast",
                  c.mandatory
                    ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                    : "border-subtle bg-white text-ink-500 hover:border-strong",
                )}
              >
                {c.mandatory ? "Required" : "Optional"}
              </button>
              <button
                type="button"
                aria-label="Remove component"
                disabled={components.length <= 1}
                onClick={() => setComponents((cs) => cs.filter((_, idx) => idx !== i))}
                className="flex size-8 cursor-pointer items-center justify-center rounded-[9px] text-ink-400 transition-colors duration-fast hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X aria-hidden size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setComponents((cs) => [...cs, emptyComponent()])}
            className="flex cursor-pointer items-center gap-1.5 self-start rounded-full border border-dashed border-strong bg-white px-4 py-2 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-300 hover:bg-maroon-50"
          >
            <Plus aria-hidden size={14} />
            Add component
          </button>
        </div>

        {initial ? (
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="mt-0.5 size-4 accent-maroon-700"
            />
            <span className="flex flex-col gap-px">
              <span className="text-[13.5px] font-semibold text-ink-900">Active</span>
              <span className="text-caption text-ink-500">Available when generating invoices.</span>
            </span>
          </label>
        ) : null}

        {(localError ?? error) ? (
          <p className="text-sm text-red-600">{localError ?? error}</p>
        ) : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save structure
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
