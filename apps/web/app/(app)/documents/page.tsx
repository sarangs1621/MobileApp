"use client";

import {
  ArrowSquareOut,
  Book,
  Certificate,
  CloudArrowUp,
  DownloadSimple,
  FileText,
  IdentificationCard,
  Info,
  Medal,
  Printer,
  Prohibit,
  Ticket,
  Trash,
  UploadSimple,
  type Icon,
} from "@phosphor-icons/react";
import { PERMISSIONS, STORAGE_BUCKETS } from "@repo/constants";
import { can } from "@repo/core";
import type { DocumentDto, DocumentTypeKey } from "@repo/types";
import { cn } from "@repo/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

import { downloadCsv } from "@/src/components/analytics/csv";
import {
  CERT_TYPES,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABEL,
  GENERATABLE_TYPES,
} from "@/src/components/documents/ui";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Select,
  Skeleton,
  StatusChip,
  type Tone,
  useToast,
} from "@/src/components/ui";
import { getSupabaseClient } from "@/src/lib/supabase/client";
import { trpc } from "@/src/trpc/react";

const STATUS_TONE: Record<string, Tone> = {
  GENERATED: "neutral",
  UPLOADED: "info",
  APPROVED: "success",
  ARCHIVED: "neutral",
};

/** Icon per certificate/document type (design handoff tiles + row icons). */
const TYPE_ICON: Partial<Record<DocumentTypeKey, Icon>> = {
  BONAFIDE_CERTIFICATE: Certificate,
  STUDY_CERTIFICATE: Book,
  CHARACTER_CERTIFICATE: Medal,
  TRANSFER_CERTIFICATE: ArrowSquareOut,
  HALL_TICKET: Ticket,
  ID_CARD: IdentificationCard,
};

/** Shared handoff header + pill tabs for the Documents section. */
function DocsHeader({ tab }: { tab: "documents" | "templates" }) {
  return (
    <nav
      aria-label="Documents sections"
      className="flex max-w-full flex-wrap gap-1.5 self-start rounded-[24px] border border-subtle bg-cream-100 p-[5px]"
    >
      {[
        { href: "/documents", label: "Documents", key: "documents" },
        { href: "/documents/templates", label: "Templates", key: "templates" },
      ].map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={tab === t.key ? "page" : undefined}
          className={cn(
            "whitespace-nowrap rounded-full px-[18px] py-[9px] text-[13.5px] font-semibold transition-colors duration-fast",
            tab === t.key
              ? "bg-maroon-700 text-cream-50 shadow-sm"
              : "text-ink-700 hover:text-maroon-800",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export default function DocumentsPage() {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  if (role === undefined) {
    return (
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
        <Skeleton className="h-24 w-2/3" />
        <Skeleton className="h-96 rounded-card" />
      </main>
    );
  }
  return can(role, PERMISSIONS.DOCUMENT_MANAGE) ? (
    <AdminConsole canApprove={can(role, PERMISSIONS.DOCUMENT_APPROVE)} />
  ) : (
    <ReadOnlyDocuments />
  );
}

/* ---------------------------------------------------------------- admin console */

function AdminConsole({ canApprove }: { canApprove: boolean }) {
  const { show } = useToast();
  const utils = trpc.useUtils();
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<DocumentTypeKey | "">("");
  const [status, setStatus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<DocumentDto | null>(null);

  const students = trpc.student.list.useQuery();
  const studentName = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [students.data],
  );

  const list = trpc.document.list.useQuery({
    ...(studentId ? { studentId } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status: status as DocumentDto["status"] } : {}),
  });
  const rows = list.data ?? [];
  const invalidate = () => void utils.document.list.invalidate();

  const approve = trpc.document.approve.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Document approved");
    },
    onError: (e) => show("error", e.message),
  });
  const archive = trpc.document.archive.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Document archived");
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.document.deleteDraft.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Draft deleted");
    },
    onError: (e) => show("error", e.message),
  });
  const mintDownload = trpc.document.downloadUrl.useMutation();
  const busy = approve.isPending || archive.isPending || remove.isPending;

  async function preview(doc: DocumentDto) {
    try {
      const { url } = await mintDownload.mutateAsync({ id: doc.id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Could not open the document");
    }
  }

  function exportCsv() {
    downloadCsv(
      "documents.csv",
      ["Student", "Type", "Status", "Issued on", "File"],
      rows.map((d) => [
        studentName.get(d.studentId) ?? d.studentId,
        DOCUMENT_TYPE_LABEL[d.type],
        DOCUMENT_STATUS_LABEL[d.status],
        d.snapshot?.issuedOn ?? "",
        d.fileName ?? "",
      ]),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
      {/* Header */}
      <section className="flex animate-fade-up flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
              <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
              Operations
            </div>
            <h1 className="font-display text-[34px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
              Documents &amp; certificates
            </h1>
            <p className="text-sm text-ink-500">
              Generate certificates from templates, or file uploaded records per student.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setUploading(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-[18px] py-2.5 text-[13px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
            >
              <UploadSimple aria-hidden size={15} />
              Upload
            </button>
            <Button icon={Certificate} onClick={() => setGenerating(true)}>
              Generate certificate
            </Button>
          </div>
        </div>
        <DocsHeader tab="documents" />
      </section>

      {/* Filters */}
      <div className="flex animate-fade-up flex-wrap items-end gap-3 [animation-delay:60ms]">
        <div className="min-w-[150px]">
          <Select label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">All students</option>
            {(students.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[150px]">
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as DocumentTypeKey | "")}
          >
            <option value="">All types</option>
            {CERT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[120px]">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DOCUMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-4 py-2.5 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50 disabled:opacity-50"
        >
          <DownloadSimple aria-hidden size={15} />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="animate-fade-up overflow-hidden rounded-card border border-subtle bg-white shadow-sm [animation-delay:120ms]">
        <div className="grid grid-cols-[1.5fr_1.4fr_1fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Student</span>
          <span>Document</span>
          <span>Status</span>
          <span>Issued</span>
          <span className="w-[130px] text-right">Actions</span>
        </div>

        {list.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-11 text-center">
            <span className="flex size-[52px] items-center justify-center rounded-card bg-cream-100 text-ink-400">
              <FileText aria-hidden size={26} />
            </span>
            <span className="text-sm font-semibold text-ink-900">No documents yet</span>
            <span className="max-w-[400px] text-[13px] text-ink-500">
              Generate a certificate from a template, or upload a scanned document to a student’s
              file.
            </span>
            <div className="flex gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={() => setUploading(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-[18px] py-2 text-[12.5px] font-semibold text-maroon-700 hover:border-maroon-200 hover:bg-maroon-50"
              >
                <UploadSimple aria-hidden size={14} />
                Upload
              </button>
              <button
                type="button"
                onClick={() => setGenerating(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-maroon-700 px-[18px] py-2 text-[12.5px] font-semibold text-cream-50 hover:bg-maroon-800"
              >
                <Certificate aria-hidden size={14} />
                Generate certificate
              </button>
            </div>
          </div>
        ) : (
          rows.map((d) => {
            const TypeIcon = TYPE_ICON[d.type] ?? FileText;
            const isDraft = d.status === "GENERATED" || d.status === "UPLOADED";
            return (
              <div
                key={d.id}
                className="grid grid-cols-[1.5fr_1.4fr_1fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
              >
                <span className="flex items-center gap-2.5">
                  <Avatar name={studentName.get(d.studentId) ?? "?"} size="sm" />
                  <span className="truncate text-sm font-semibold text-ink-900">
                    {studentName.get(d.studentId) ?? "—"}
                  </span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gold-100 text-gold-700">
                    <TypeIcon aria-hidden size={16} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="truncate text-[13.5px] font-semibold text-ink-900">
                      {DOCUMENT_TYPE_LABEL[d.type]}
                    </span>
                    {d.fileName ? (
                      <span className="truncate font-mono text-[11.5px] text-ink-400">
                        {d.fileName}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span>
                  <StatusChip
                    tone={STATUS_TONE[d.status] ?? "neutral"}
                    label={DOCUMENT_STATUS_LABEL[d.status]}
                    dot={d.status === "APPROVED"}
                  />
                </span>
                <span className="text-[13px] text-ink-500">{d.snapshot?.issuedOn ?? "—"}</span>
                <span className="flex w-[130px] items-center justify-end gap-1.5">
                  {canApprove && isDraft ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approve.mutate({ id: d.id })}
                      className="cursor-pointer rounded-full bg-maroon-700 px-3 py-[7px] text-[12px] font-semibold text-cream-50 transition-colors duration-fast hover:bg-maroon-800 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  ) : null}
                  {d.hasFile ? (
                    <IconButton
                      label="Print / preview"
                      icon={Printer}
                      disabled={mintDownload.isPending}
                      onClick={() => void preview(d)}
                    />
                  ) : null}
                  {d.status === "APPROVED" ? (
                    <IconButton
                      label="Revoke (archive)"
                      tone="danger"
                      icon={Prohibit}
                      disabled={busy}
                      onClick={() => archive.mutate({ id: d.id })}
                    />
                  ) : isDraft ? (
                    <IconButton
                      label="Delete draft"
                      tone="danger"
                      icon={Trash}
                      onClick={() => setDeleting(d)}
                    />
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
        <Info aria-hidden size={15} />
        Issued certificates snapshot the student’s details — later profile changes don’t alter them.
        Revoking keeps the record but marks it invalid.
      </p>

      {generating ? (
        <GenerateModal
          students={students.data ?? []}
          onClose={() => setGenerating(false)}
          onDone={() => {
            setGenerating(false);
            invalidate();
          }}
        />
      ) : null}
      {uploading ? (
        <UploadModal
          students={students.data ?? []}
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false);
            invalidate();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete draft document?"
          objectName={DOCUMENT_TYPE_LABEL[deleting.type]}
          message={`Delete this ${DOCUMENT_TYPE_LABEL[deleting.type].toLowerCase()} draft? Approved and archived documents can’t be deleted.`}
          confirmLabel="Delete draft"
          busy={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </main>
  );
}

type StudentOption = { id: string; firstName: string; lastName: string };

function GenerateModal({
  students,
  onClose,
  onDone,
}: {
  students: StudentOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { show } = useToast();
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<DocumentTypeKey>("BONAFIDE_CERTIFICATE");
  const [error, setError] = useState<string | null>(null);
  const generate = trpc.document.generate.useMutation({
    onSuccess: () => {
      show("success", "Certificate generated");
      onDone();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <Dialog title="Generate certificate" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!studentId) {
            setError("Pick a student");
            return;
          }
          setError(null);
          generate.mutate({ studentId, type });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Select
          label="Student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        >
          <option value="">Select a student…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.firstName} {s.lastName}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Certificate type</span>
          <div className="grid grid-cols-2 gap-2">
            {GENERATABLE_TYPES.map((t) => {
              const selected = type === t;
              const TileIcon = TYPE_ICON[t] ?? Certificate;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-[11px] border px-2 py-2.5 text-[12.5px] font-semibold transition-colors duration-fast",
                    selected
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  <TileIcon aria-hidden size={15} />
                  {DOCUMENT_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
          <span className="text-caption text-ink-400">
            The student’s current details are snapshotted at generation — later profile changes
            won’t alter this certificate.
          </span>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="mt-1 flex justify-end gap-2.5">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={generate.isPending}>
            Generate
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function UploadModal({
  students,
  onClose,
  onDone,
}: {
  students: StudentOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { show } = useToast();
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<DocumentTypeKey>("FEE_RECEIPT");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mintUpload = trpc.document.uploadUrl.useMutation();
  const createDoc = trpc.document.createUploaded.useMutation();

  async function submit() {
    if (!studentId || !file) {
      setError("Pick a student and a file");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const minted = await mintUpload.mutateAsync({ studentId, fileName: file.name });
      const { error: upErr } = await getSupabaseClient()
        .storage.from(STORAGE_BUCKETS.DOCUMENTS)
        .uploadToSignedUrl(minted.storagePath, minted.token, file);
      if (upErr) throw new Error(`File upload failed: ${upErr.message}`);
      await createDoc.mutateAsync({
        studentId,
        type,
        storagePath: minted.storagePath,
        fileName: file.name,
        ...(file.type ? { mimeType: file.type } : {}),
        sizeBytes: file.size,
      });
      show("success", "Document uploaded");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Upload document" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-[18px]"
      >
        <Select
          label="Student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        >
          <option value="">Select a student…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.firstName} {s.lastName}
            </option>
          ))}
        </Select>
        <Select
          label="Document type"
          value={type}
          onChange={(e) => setType(e.target.value as DocumentTypeKey)}
        >
          {CERT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">File</span>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-strong px-4 py-[26px] text-center transition-colors duration-fast hover:border-maroon-300 hover:bg-cream-50">
            <span className="flex size-10 items-center justify-center rounded-xl bg-maroon-50 text-maroon-700">
              <CloudArrowUp aria-hidden size={20} />
            </span>
            <span className="text-[13.5px] font-semibold text-maroon-700">
              {file ? file.name : "Choose a file or drag it here"}
            </span>
            <span className="text-xs text-ink-400">PDF or image · up to 10 MB</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="mt-1 flex justify-end gap-2.5">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={file === null}>
            Upload
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------- read-only (teacher / parent) */

function ReadOnlyDocuments() {
  const { show } = useToast();
  const [studentId, setStudentId] = useState("");
  const students = trpc.student.list.useQuery();
  const list = trpc.document.listStudentDocuments.useQuery({ studentId }, { enabled: !!studentId });
  const mintDownload = trpc.document.downloadUrl.useMutation();

  async function open(doc: DocumentDto) {
    try {
      const { url } = await mintDownload.mutateAsync({ id: doc.id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Could not open the document");
    }
  }

  const docs = list.data ?? [];

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
          <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
          Operations
        </div>
        <h1 className="font-display text-[34px] font-medium leading-tight text-ink-900">
          Documents
        </h1>
        <p className="text-sm text-ink-500">A student’s approved certificates and records.</p>
      </section>

      <div className="max-w-xs">
        <Select label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Select a student…</option>
          {(students.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.firstName} {s.lastName}
            </option>
          ))}
        </Select>
      </div>

      {studentId ? (
        <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_1fr_1.4fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
            <span>Type</span>
            <span>Issued</span>
            <span>File</span>
            <span className="w-24 text-right">Actions</span>
          </div>
          {list.isLoading ? (
            <div className="flex flex-col gap-3 p-5">
              <Skeleton className="h-10" />
            </div>
          ) : docs.length === 0 ? (
            <EmptyState icon={FileText} title="No documents" message="No documents available." />
          ) : (
            docs.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-[1.4fr_1fr_1.4fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 last:border-0 hover:bg-cream-50"
              >
                <span className="text-sm font-semibold text-ink-900">
                  {DOCUMENT_TYPE_LABEL[d.type]}
                </span>
                <span className="text-[13px] text-ink-500">{d.snapshot?.issuedOn ?? "—"}</span>
                <span className="truncate text-[13px] text-ink-500">{d.fileName ?? "—"}</span>
                <span className="flex w-24 justify-end">
                  {d.hasFile ? (
                    <button
                      type="button"
                      disabled={mintDownload.isPending}
                      onClick={() => void open(d)}
                      className="cursor-pointer rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-maroon-700 hover:border-maroon-200 hover:bg-maroon-50"
                    >
                      Download
                    </button>
                  ) : (
                    <span className="text-caption text-ink-400">No file</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </main>
  );
}
