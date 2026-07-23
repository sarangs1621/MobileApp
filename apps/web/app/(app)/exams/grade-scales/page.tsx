"use client";

import { Medal, Plus, X } from "@phosphor-icons/react";
import { cn } from "@repo/ui";
import { useState } from "react";

import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

type BandForm = { grade: string; minPercent: string; maxPercent: string; gradePoint: string };
const blankBand: BandForm = { grade: "", minPercent: "", maxPercent: "", gradePoint: "" };

/** Rank a band 0..1 by its position in the scale (by min%) → traffic-light tint. */
function bandTone(rankFraction: number): { bar: string; chip: string } {
  if (rankFraction >= 0.66) return { bar: "bg-green-600", chip: "bg-green-100 text-green-600" };
  if (rankFraction >= 0.33) return { bar: "bg-gold-300", chip: "bg-gold-100 text-gold-700" };
  return { bar: "bg-red-100", chip: "bg-red-100 text-red-600" };
}

/**
 * Grade-scale management (M5, ADR-012; design handoff §3 — Grade scales tab).
 * A scale is a set of percent bands with an optional grade point, shown with the
 * handoff's proportional band bar. Marks snapshot the letter/point at lock, so
 * scales are append-only here (edits never mutate published history — create a
 * new scale).
 */
export default function GradeScalesPage() {
  const scales = trpc.gradeScale.list.useQuery();
  const [creating, setCreating] = useState(false);

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center">
        <div className="flex-1" />
        <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
          New grade scale
        </Button>
      </div>

      {scales.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      ) : scales.isError ? (
        <ErrorState message="Couldn’t load grade scales." onRetry={() => void scales.refetch()} />
      ) : (scales.data ?? []).length === 0 ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            icon={Medal}
            title="No grade scales yet."
            message="A grade scale turns percentages into letters and points on report cards."
            action={
              <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                New grade scale
              </Button>
            }
          />
        </div>
      ) : (
        (scales.data ?? []).map((scale) => {
          // Ascending by min% for the bar (left = 0%), descending for the rows.
          const asc = [...scale.bands].sort((a, b) => a.minPercent - b.minPercent);
          const desc = [...asc].reverse();
          const rank = new Map(
            asc.map((b, i) => [b.id, asc.length > 1 ? i / (asc.length - 1) : 1]),
          );
          return (
            <div
              key={scale.id}
              className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm"
            >
              <div className="flex items-center gap-3 px-5 pb-3.5 pt-[18px]">
                <span
                  className={cn(
                    "flex size-[38px] shrink-0 items-center justify-center rounded-xl",
                    scale.isDefault ? "bg-gold-100 text-gold-700" : "bg-maroon-50 text-maroon-700",
                  )}
                >
                  <Medal aria-hidden size={19} weight={scale.isDefault ? "bold" : "regular"} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold text-ink-900">
                      {scale.name}
                    </span>
                    {scale.isDefault ? <StatusChip tone="gold" label="Default" /> : null}
                  </span>
                  <span className="text-[12.5px] text-ink-500">
                    {scale.bands.length} band{scale.bands.length === 1 ? "" : "s"}
                    {scale.isDefault ? " · used by all exams unless overridden" : ""}
                  </span>
                </span>
              </div>

              {/* Proportional band bar (0–100%) */}
              {asc.length > 0 ? (
                <div className="mx-5 mb-4 flex h-3.5 overflow-hidden rounded-[7px]">
                  {asc.map((b) => (
                    <span
                      key={b.id}
                      title={`${b.grade} · ${b.minPercent}–${b.maxPercent}%`}
                      style={{ width: `${Math.max(2, b.maxPercent - b.minPercent)}%` }}
                      className={bandTone(rank.get(b.id) ?? 0).bar}
                    />
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-[0.7fr_1fr_1fr_0.7fr] items-center gap-3 border-y border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                <span>Grade</span>
                <span>Min %</span>
                <span>Max %</span>
                <span className="text-right">Points</span>
              </div>
              {desc.map((b) => (
                <div
                  key={b.id}
                  className="grid grid-cols-[0.7fr_1fr_1fr_0.7fr] items-center gap-3 border-b border-cream-100 px-5 py-3 transition-colors duration-fast last:border-0 hover:bg-cream-50"
                >
                  <span>
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-[9px] text-[13px] font-bold",
                        bandTone(rank.get(b.id) ?? 0).chip,
                      )}
                    >
                      {b.grade}
                    </span>
                  </span>
                  <span className="text-[13.5px] tabular-nums text-ink-500">{b.minPercent}</span>
                  <span className="text-[13.5px] tabular-nums text-ink-500">{b.maxPercent}</span>
                  <span className="text-right text-[13.5px] font-semibold tabular-nums text-ink-900">
                    {b.gradePoint ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          );
        })
      )}

      {creating ? <GradeScaleFormModal onClose={() => setCreating(false)} /> : null}
    </section>
  );
}

function GradeScaleFormModal({ onClose }: { onClose: () => void }) {
  const { show } = useToast();
  const utils = trpc.useUtils();
  const create = trpc.gradeScale.create.useMutation({
    onSuccess: () => {
      void utils.gradeScale.list.invalidate();
      show("success", "Grade scale saved");
      onClose();
    },
    onError: (e) => show("error", e.message),
  });

  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [bands, setBands] = useState<BandForm[]>([{ ...blankBand }, { ...blankBand }]);

  const setBand = (i: number, patch: Partial<BandForm>) =>
    setBands((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const bandInput =
    "min-w-0 rounded-[10px] border border-subtle bg-white px-2.5 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100";

  return (
    <Dialog title="New grade scale" onClose={onClose} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            name: name.trim(),
            isDefault,
            bands: bands.map((b) => ({
              grade: b.grade.trim(),
              minPercent: Number(b.minPercent),
              maxPercent: Number(b.maxPercent),
              gradePoint: b.gradePoint.trim() === "" ? null : Number(b.gradePoint),
            })),
          });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="CBSE 2024"
          required
        />

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="mt-0.5 size-4 accent-maroon-700"
          />
          <span className="flex flex-col gap-px">
            <span className="text-[13.5px] font-semibold text-ink-900">
              Make this the default scale
            </span>
            <span className="text-caption text-ink-500">
              New exams will use it unless another scale is chosen.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[0.8fr_1fr_1fr_0.8fr_32px] gap-2 text-caption font-semibold text-ink-500">
            <span>Grade</span>
            <span>Min %</span>
            <span>Max %</span>
            <span>Points</span>
            <span />
          </div>
          {bands.map((b, i) => (
            <div key={i} className="grid grid-cols-[0.8fr_1fr_1fr_0.8fr_32px] items-center gap-2">
              <input
                aria-label={`Band ${i + 1} grade`}
                type="text"
                value={b.grade}
                onChange={(e) => setBand(i, { grade: e.target.value })}
                placeholder="A"
                required
                className={bandInput}
              />
              <input
                aria-label={`Band ${i + 1} min percent`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={b.minPercent}
                onChange={(e) => setBand(i, { minPercent: e.target.value })}
                placeholder="70"
                required
                className={bandInput}
              />
              <input
                aria-label={`Band ${i + 1} max percent`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={b.maxPercent}
                onChange={(e) => setBand(i, { maxPercent: e.target.value })}
                placeholder="100"
                required
                className={bandInput}
              />
              <input
                aria-label={`Band ${i + 1} grade points`}
                type="number"
                min={0}
                step="0.1"
                value={b.gradePoint}
                onChange={(e) => setBand(i, { gradePoint: e.target.value })}
                placeholder="9"
                className={bandInput}
              />
              <button
                type="button"
                aria-label="Remove band"
                title="Remove band"
                disabled={bands.length <= 1}
                onClick={() => setBands((prev) => prev.filter((_, j) => j !== i))}
                className="flex size-8 cursor-pointer items-center justify-center rounded-[9px] text-ink-400 transition-colors duration-fast hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X aria-hidden size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBands((prev) => [...prev, { ...blankBand }])}
            className="flex cursor-pointer items-center gap-1.5 self-start rounded-full border border-dashed border-strong bg-white px-4 py-2 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-300 hover:bg-maroon-50"
          >
            <Plus aria-hidden size={14} />
            Add band
          </button>
          <span className="text-caption text-ink-400">
            Bands must cover 0–100% without gaps or overlaps — we check on save.
          </span>
        </div>

        {create.error ? <p className="text-sm text-red-600">{create.error.message}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Save grade scale
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
