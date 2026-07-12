/**
 * Dependency-free CSV download (M14, ADR-022 §8) — Blob + transient anchor, RFC-4180
 * quoting, CRLF. One canonical helper for the analytics exports. No PDF, no library,
 * no server round-trip. ponytail: the two pre-existing per-screen `downloadCsv` copies
 * (attendance/timetable) are left in place — consolidating them would touch frozen
 * M9/M12 UI for no functional gain; new exports use this one.
 */
/** Pure CSV serializer (RFC-4180 quoting, CRLF) — testable without the DOM. */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const esc = (v: string | number): string => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): void {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
