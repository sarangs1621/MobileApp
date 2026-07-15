/**
 * Host-provided PDF rendering port (ADR-026). The business layer decides WHAT to
 * render (from FROZEN snapshots — ADR-014) and hands the host adapter plain data;
 * the adapter (apps/web, react-pdf) owns the layout. No React / react-pdf import
 * here — services stay framework-free, exactly like {@link StoragePort} (ADR-004).
 */

/** One label→value row rendered into a template's table. */
export interface PdfRow {
  label: string;
  value: string;
}

/** A generated certificate, rendered from a Document's frozen `snapshotJson` (ADR-023 §3). */
export interface CertificatePdfData {
  schoolName: string;
  /** Certificate heading, e.g. "Bonafide Certificate" (from the document type). */
  title: string;
  studentName: string;
  class: string | null;
  section: string | null;
  academicYear: string | null;
  /** IST issue date (frozen at generate). */
  issuedOn: string;
  /** The remaining snapshot values (admission no, per-type fields, …) as a table. */
  rows: PdfRow[];
}

/** One subject line of the marks table — values come from the FROZEN Mark
 *  snapshot columns (totalObtained/percentage/gradeLetterSnapshot, ADR-012). */
export interface ReportCardPdfMark {
  exam: string;
  subject: string;
  /** "78 / 100", "Absent", or "—". */
  marks: string;
  /** "78%" or "—". */
  percentage: string;
  /** Frozen grade letter, or "—". */
  grade: string;
}

/** A report card, rendered from its frozen snapshot columns (ADR-014) after publish. */
export interface ReportCardPdfData {
  schoolName: string;
  title: string;
  studentName: string;
  class: string | null;
  section: string | null;
  /** IST publish/issue date. */
  issuedOn: string;
  /** Subject-wise marks (frozen Mark snapshots); may be empty (no published marks). */
  marks: ReportCardPdfMark[];
  /** Snapshot + authored values (rank, GPA, attendance, remarks, …) as a table. */
  rows: PdfRow[];
}

export interface PdfRenderer {
  renderCertificate(data: CertificatePdfData): Promise<Uint8Array>;
  renderReportCard(data: ReportCardPdfData): Promise<Uint8Array>;
}
