"use client";

import { CaretDown, CaretUp, CaretUpDown } from "@phosphor-icons/react";
import { cn } from "@repo/ui";
import type { ReactNode } from "react";

import { ErrorState, Skeleton } from "./feedback";

/**
 * DataTable (design handoff §Tables) — one white 16px-radius card holding the
 * toolbar (search/filters/actions), an 11px uppercase header row, cream-hover
 * body rows, and the footer/paginator, separated by cream hairlines. Built-in
 * skeleton / empty / error states so no consumer re-implements them.
 * Hand-rolled (no table lib): a styled wrapper over a column config.
 */
export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  /** Mark sortable + wire `sort`/`onSort` to get the header affordance. */
  sortable?: boolean;
  render: (row: T) => ReactNode;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  sort,
  onSort,
  toolbar,
  footer,
}: {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  loading?: boolean | undefined;
  error?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  empty?: ReactNode;
  sort?: SortState | undefined;
  onSort?: ((key: string) => void) | undefined;
  toolbar?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
      {toolbar ? <div className="border-b border-cream-100 px-5 py-4">{toolbar}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-cream-100">
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const sortable = col.sortable && onSort;
                return (
                  <th
                    key={col.key}
                    aria-sort={
                      active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={cn(
                      "px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400",
                      col.align === "right" && "text-right",
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 uppercase tracking-[0.1em] hover:text-ink-700",
                          col.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {col.header}
                        {!active ? (
                          <CaretUpDown aria-hidden className="size-3.5" />
                        ) : sort.dir === "asc" ? (
                          <CaretUp aria-hidden className="size-3.5" />
                        ) : (
                          <CaretDown aria-hidden className="size-3.5" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <ErrorState onRetry={onRetry} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors duration-fast hover:bg-cream-50">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-5 py-3.5 text-ink-800",
                        col.align === "right" && "text-right tabular-nums",
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Footer components (e.g. Paginator) carry their own padding + top hairline
          so an empty footer renders nothing. */}
      {footer}
    </div>
  );
}

/** Standard toolbar row: filters (left) · search + count + actions (right). */
export function TableToolbar({
  filters,
  search,
  count,
  actions,
}: {
  filters?: ReactNode;
  search?: ReactNode;
  /** e.g. "3 classes" — muted count text before the primary action. */
  count?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      {search}
      {filters ? <div className="flex flex-wrap items-end gap-2.5">{filters}</div> : null}
      <div className="ml-auto flex items-center gap-3.5">
        {count ? <span className="text-[12.5px] text-ink-400">{count}</span> : null}
        {actions}
      </div>
    </div>
  );
}
