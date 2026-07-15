import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type {
  CertificatePdfData,
  PdfRenderer,
  PdfRow,
  ReportCardPdfData,
  ReportCardPdfMark,
} from "@repo/api";

/**
 * The web host's `PdfRenderer` adapter (ADR-026). This is the ONLY place react-pdf
 * is imported — the business layer stays framework-free and hands us plain, already
 * FROZEN data (ADR-014). Two clean institutional templates: a school header, a title,
 * a label/value table of the snapshot, and the issue date.
 */

const styles = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 56,
    fontSize: 11,
    color: "#1a1a1a",
    fontFamily: "Helvetica",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 10,
    marginBottom: 24,
  },
  schoolName: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  title: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  subline: { fontSize: 10, color: "#555", textAlign: "center", marginBottom: 24 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e2e2",
    paddingVertical: 6,
  },
  label: { width: "40%", fontFamily: "Helvetica-Bold", color: "#333" },
  value: { width: "60%" },
  issued: { marginTop: 32, fontSize: 10, color: "#555" },
  marksTable: { marginBottom: 24 },
  marksHead: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a1a",
    paddingVertical: 5,
  },
  marksRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e2e2",
    paddingVertical: 5,
  },
  colExam: { width: "24%" },
  colSubject: { width: "30%" },
  colMarks: { width: "20%" },
  colPct: { width: "13%", textAlign: "right" },
  colGrade: { width: "13%", textAlign: "right" },
  marksHeadText: { fontFamily: "Helvetica-Bold", color: "#333" },
});

function placement(cls: string | null, section: string | null): string {
  return [cls, section].filter(Boolean).join(" · ") || "—";
}

function TableDoc(props: {
  schoolName: string;
  title: string;
  studentName: string;
  placementLine: string;
  /** Subject-wise marks table (report cards); omitted for certificates. */
  marks?: ReportCardPdfMark[];
  rows: PdfRow[];
  issuedOn: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{props.schoolName}</Text>
        </View>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.subline}>
          {props.studentName} — {props.placementLine}
        </Text>
        {props.marks && props.marks.length > 0 ? (
          <View style={styles.marksTable}>
            <View style={styles.marksHead}>
              <Text style={[styles.colExam, styles.marksHeadText]}>Exam</Text>
              <Text style={[styles.colSubject, styles.marksHeadText]}>Subject</Text>
              <Text style={[styles.colMarks, styles.marksHeadText]}>Marks</Text>
              <Text style={[styles.colPct, styles.marksHeadText]}>%</Text>
              <Text style={[styles.colGrade, styles.marksHeadText]}>Grade</Text>
            </View>
            {props.marks.map((m, i) => (
              <View key={i} style={styles.marksRow}>
                <Text style={styles.colExam}>{m.exam}</Text>
                <Text style={styles.colSubject}>{m.subject}</Text>
                <Text style={styles.colMarks}>{m.marks}</Text>
                <Text style={styles.colPct}>{m.percentage}</Text>
                <Text style={styles.colGrade}>{m.grade}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View>
          {props.rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.value}>{r.value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.issued}>Issued on {props.issuedOn}</Text>
      </Page>
    </Document>
  );
}

/** Build the web host's PDF renderer. `renderToBuffer` returns a Node Buffer (a Uint8Array). */
export function createPdfRenderer(): PdfRenderer {
  return {
    renderCertificate: (data: CertificatePdfData) =>
      renderToBuffer(
        <TableDoc
          schoolName={data.schoolName}
          title={data.title}
          studentName={data.studentName}
          placementLine={placement(data.class, data.section)}
          rows={[
            ...(data.academicYear ? [{ label: "Academic Year", value: data.academicYear }] : []),
            ...data.rows,
          ]}
          issuedOn={data.issuedOn}
        />,
      ),
    renderReportCard: (data: ReportCardPdfData) =>
      renderToBuffer(
        <TableDoc
          schoolName={data.schoolName}
          title={data.title}
          studentName={data.studentName}
          placementLine={placement(data.class, data.section)}
          marks={data.marks}
          rows={data.rows}
          issuedOn={data.issuedOn}
        />,
      ),
  };
}
