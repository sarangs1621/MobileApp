"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Legacy M2 CRUD primitives. The full component kit (ADR-UX1 Step 2) now lives in
 * `@/src/components/ui` and is re-exported below, so existing screens importing
 * from here keep working while Step 4 migrates them onto the new components.
 * These legacy class constants + Modal/TableShell/etc. remain until migrated.
 */
export * from "@/src/components/ui";

// Legacy class constants, restyled to the design-handoff tokens so screens still
// on them (attendance, marks grids, …) match the new look without a rewrite.
export const inputClass =
  "rounded-[10px] border border-subtle bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 " +
  "focus:outline-none focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100 " +
  "disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-60";
export const primaryBtn =
  "min-h-11 cursor-pointer rounded-full border border-maroon-700 bg-maroon-700 px-5 py-2 text-sm font-semibold text-cream-50 shadow-sm " +
  "transition-colors duration-fast hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-50";
export const outlineBtn =
  "min-h-11 cursor-pointer rounded-full border border-strong bg-transparent px-5 py-2 text-sm font-semibold text-maroon-700 " +
  "transition-colors duration-fast hover:border-maroon-300 hover:bg-maroon-50 disabled:cursor-not-allowed disabled:opacity-50";
export const destructiveBtn =
  "min-h-11 cursor-pointer rounded-full border border-red-600 bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm " +
  "transition-colors duration-fast hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-50";
export const smallGhostBtn =
  "cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:bg-maroon-50 disabled:opacity-50";
export const smallDangerBtn =
  "cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-red-600 transition-colors duration-fast hover:bg-red-100 disabled:opacity-50";
export const labelClass = "flex flex-col gap-1.5 text-[13px] font-semibold text-ink-900";

/** Modal dialog: overlay + Esc/backdrop close, initial focus inside. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(36,26,17,0.55)] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md animate-pop-in overflow-y-auto rounded-modal bg-white p-6 shadow-modal"
      >
        <h2 className="mb-4 font-display text-2xl font-medium text-ink-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Destructive confirm dialog naming the consequence (UI_DESIGN_SYSTEM.md §11). */
export function ConfirmDelete({
  title,
  message,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={outlineBtn}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className={destructiveBtn}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

/** Table wrapper with mandatory loading / error / empty states (§9). */
export function TableShell({
  head,
  isLoading,
  isError,
  isEmpty,
  emptyText,
  children,
}: {
  head: readonly string[];
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-subtle bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-cream-100">
          <tr>
            {head.map((h, i) => (
              <th
                key={`${h}-${i}`}
                className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-cream-100">
          {isLoading ? (
            <StateRow colSpan={head.length}>Loading…</StateRow>
          ) : isError ? (
            <StateRow colSpan={head.length}>
              <span className="text-red-600">
                Couldn’t load this list. You may not have access, or the server is unreachable.
              </span>
            </StateRow>
          ) : isEmpty ? (
            <StateRow colSpan={head.length}>{emptyText}</StateRow>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function StateRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-ink-500">
        {children}
      </td>
    </tr>
  );
}

const PAGE_SIZE = 10;

/**
 * Client-side search + pagination over a fully fetched list. The academic API
 * (Step 5) returns bounded full lists (years/classes/subjects are small,
 * single-tenant); cursor pagination arrives with genuinely unbounded data.
 */
export function usePagedSearch<T>(
  items: readonly T[] | undefined,
  matches: (item: T, query: string) => boolean,
) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const all = items ?? [];
    const q = query.trim().toLowerCase();
    return q ? all.filter((item) => matches(item, q)) : all;
  }, [items, query, matches]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return {
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setPage(1);
    },
    page: safePage,
    setPage,
    pageCount,
    pageItems,
    total: filtered.length,
  };
}

/** Search box + optional primary action, above a table. */
export function ListToolbar({
  searchValue,
  onSearch,
  searchLabel,
  action,
}: {
  searchValue: string;
  onSearch: (value: string) => void;
  searchLabel: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className={labelClass}>
        {searchLabel}
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          className={`${inputClass} w-64`}
          placeholder="Search…"
        />
      </label>
      {action}
    </div>
  );
}

const pagerBtn =
  "cursor-pointer rounded-full border border-subtle bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-subtle disabled:hover:bg-white";

/** Prev/next pager — renders inside the DataTable card footer (only when >1 page). */
export function Paginator({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total === 0 || pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-cream-100 px-5 py-3 text-[12.5px] text-ink-400">
      <span>
        Page {page} of {pageCount} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className={pagerBtn}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className={pagerBtn}
        >
          Next
        </button>
      </div>
    </div>
  );
}
