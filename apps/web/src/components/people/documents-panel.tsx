"use client";

import { STORAGE_BUCKETS } from "@repo/constants";
import type { StudentDocumentDto, StudentDocumentTypeKey } from "@repo/types";
import { useState } from "react";

import {
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  smallDangerBtn,
  smallGhostBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { ConfirmAction } from "@/src/components/people/confirm";
import { getSupabaseClient } from "@/src/lib/supabase/client";
import { trpc } from "@/src/trpc/react";

const DOCUMENT_TYPES: readonly StudentDocumentTypeKey[] = [
  "BIRTH_CERTIFICATE",
  "PASSPORT",
  "AADHAAR",
  "MEDICAL_RECORD",
  "TRANSFER_CERTIFICATE",
  "PHOTO",
  "OTHER",
];

const TYPE_LABEL: Record<StudentDocumentTypeKey, string> = {
  BIRTH_CERTIFICATE: "Birth certificate",
  PASSPORT: "Passport",
  AADHAAR: "Aadhaar",
  MEDICAL_RECORD: "Medical record",
  TRANSFER_CERTIFICATE: "Transfer certificate",
  PHOTO: "Photo",
  OTHER: "Other",
};

/**
 * Student documents — metadata rows over private-bucket files (ADR-004). Upload
 * and replace mint a one-time signed upload URL server-side (path is chosen by
 * the SERVER), push bytes from the browser, then persist metadata; replace
 * bumps `version`. View mints a short-lived signed read URL AFTER the service
 * re-checks scope + type visibility. Delete removes metadata only.
 */
export function DocumentsPanel({
  studentId,
  canManage,
}: {
  studentId: string;
  canManage: boolean;
}) {
  const documents = trpc.studentDocument.list.useQuery({ studentId });
  const utils = trpc.useUtils();
  const invalidate = () => void utils.studentDocument.list.invalidate({ studentId });

  const mintUpload = trpc.studentDocument.uploadUrl.useMutation();
  const createDoc = trpc.studentDocument.upload.useMutation({ onSuccess: invalidate });
  const replaceDoc = trpc.studentDocument.replace.useMutation({ onSuccess: invalidate });
  const removeDoc = trpc.studentDocument.delete.useMutation({ onSuccess: invalidate });
  const mintDownload = trpc.studentDocument.downloadUrl.useMutation();

  const [uploading, setUploading] = useState(false);
  const [replacing, setReplacing] = useState<StudentDocumentDto | null>(null);
  const [deleting, setDeleting] = useState<StudentDocumentDto | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  /** Mint → push bytes to the signed URL → return the server-chosen path. */
  async function pushFile(file: File): Promise<string> {
    const minted = await mintUpload.mutateAsync({ studentId, fileName: file.name });
    const { error } = await getSupabaseClient()
      .storage.from(STORAGE_BUCKETS.STUDENT_DOCUMENTS)
      .uploadToSignedUrl(minted.storagePath, minted.token, file);
    if (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
    return minted.storagePath;
  }

  async function handleView(doc: StudentDocumentDto) {
    setViewError(null);
    try {
      const { url } = await mintDownload.mutateAsync({ id: doc.id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setViewError(error instanceof Error ? error.message : "Could not open the document");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Documents</h3>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              mintUpload.reset();
              createDoc.reset();
              setUploading(true);
            }}
            className={primaryBtn}
          >
            Upload document
          </button>
        ) : null}
      </div>

      {viewError ? <p className="text-sm text-destructive">{viewError}</p> : null}

      <TableShell
        head={["Type", "File", "Size", "Version", "Actions"]}
        isLoading={documents.isLoading}
        isError={documents.isError}
        isEmpty={(documents.data ?? []).length === 0}
        emptyText="No documents uploaded."
      >
        {(documents.data ?? []).map((doc) => (
          <tr key={doc.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{TYPE_LABEL[doc.type]}</td>
            <td className="px-4 py-3 text-muted-foreground">{doc.fileName}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {doc.sizeBytes != null ? `${Math.max(1, Math.round(doc.sizeBytes / 1024))} KB` : "—"}
            </td>
            <td className="px-4 py-3 text-muted-foreground">v{doc.version}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void handleView(doc)}
                  disabled={mintDownload.isPending}
                  className={smallGhostBtn}
                >
                  View
                </button>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        mintUpload.reset();
                        replaceDoc.reset();
                        setReplacing(doc);
                      }}
                      className={smallGhostBtn}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeDoc.reset();
                        setDeleting(doc);
                      }}
                      className={smallDangerBtn}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {uploading ? (
        <FileModal
          title="Upload document"
          withType
          busy={mintUpload.isPending || createDoc.isPending}
          onClose={() => setUploading(false)}
          onSubmit={async (file, type) => {
            const storagePath = await pushFile(file);
            await createDoc.mutateAsync({
              studentId,
              type: type ?? "OTHER",
              storagePath,
              fileName: file.name,
              ...(file.type ? { mimeType: file.type } : {}),
              sizeBytes: file.size,
            });
            setUploading(false);
          }}
        />
      ) : null}

      {replacing !== null ? (
        <FileModal
          title={`Replace ${TYPE_LABEL[replacing.type]} (v${replacing.version} → v${replacing.version + 1})`}
          withType={false}
          busy={mintUpload.isPending || replaceDoc.isPending}
          onClose={() => setReplacing(null)}
          onSubmit={async (file) => {
            const storagePath = await pushFile(file);
            await replaceDoc.mutateAsync({
              id: replacing.id,
              storagePath,
              fileName: file.name,
              ...(file.type ? { mimeType: file.type } : {}),
              sizeBytes: file.size,
            });
            setReplacing(null);
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmAction
          title="Delete document"
          message={`Delete the ${TYPE_LABEL[deleting.type].toLowerCase()} “${deleting.fileName}”? The metadata row is removed; the stored file stays in the private bucket until storage cleanup.`}
          actionLabel="Delete"
          busyLabel="Deleting…"
          busy={removeDoc.isPending}
          error={removeDoc.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            removeDoc.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </section>
  );
}

/** File picker (+ optional type select) driving the mint→upload→persist flow. */
function FileModal({
  title,
  withType,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  withType: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (file: File, type?: StudentDocumentTypeKey) => Promise<void>;
}) {
  const [type, setType] = useState<StudentDocumentTypeKey>("BIRTH_CERTIFICATE");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!file) return;
          setError(null);
          setSubmitting(true);
          onSubmit(file, withType ? type : undefined)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Upload failed");
            })
            .finally(() => setSubmitting(false));
        }}
        className="flex flex-col gap-3"
      >
        {withType ? (
          <label className={labelClass}>
            Document type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as StudentDocumentTypeKey)}
              className={inputClass}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className={labelClass}>
          File
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={inputClass}
            required
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={outlineBtn}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || submitting || file === null}
            className={primaryBtn}
          >
            {busy || submitting ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
