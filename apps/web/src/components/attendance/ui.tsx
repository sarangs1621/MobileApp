"use client";

import type { AttendanceStatusKey } from "@repo/types";
import { useState } from "react";

import { inputClass, labelClass } from "@/src/components/academic/ui";
import { trpc } from "@/src/trpc/react";

/** The five marks, in register order (ADR-011). */
export const ATTENDANCE_STATUSES: readonly AttendanceStatusKey[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "LEAVE",
];

export const STATUS_LABEL: Record<AttendanceStatusKey, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  HALF_DAY: "Half day",
  LEAVE: "Leave",
};

/** Class → section cascading picker. Emits the chosen sectionId (or "" when cleared). */
export function SectionPicker({ onSection }: { onSection: (sectionId: string) => void }) {
  const classes = trpc.class.list.useQuery();
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const sections = trpc.section.list.useQuery({ classId }, { enabled: classId !== "" });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={labelClass}>
        Class
        <select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSectionId("");
            onSection("");
          }}
          className={inputClass}
        >
          <option value="">Select a class…</option>
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Section
        <select
          value={sectionId}
          onChange={(e) => {
            setSectionId(e.target.value);
            onSection(e.target.value);
          }}
          className={inputClass}
          disabled={classId === ""}
        >
          <option value="">Select a section…</option>
          {(sections.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Trigger a client-side CSV download (no dependency — Blob + a transient anchor). */
export function downloadCsv(filename: string, rows: readonly (readonly string[])[]): void {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
