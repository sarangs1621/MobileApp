"use client";

import { HOMEWORK_ATTACHMENT, STORAGE_BUCKETS } from "@repo/constants";
import type { HomeworkStatusKey, SubmissionStatusKey } from "@repo/types";

import { getSupabaseClient } from "@/src/lib/supabase/client";

export const HW_STATUS_LABEL: Record<HomeworkStatusKey, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CLOSED: "Closed",
};

export const SUB_STATUS_LABEL: Record<SubmissionStatusKey, string> = {
  SUBMITTED: "Submitted",
  RETURNED: "Changes requested",
  REVIEWED: "Reviewed",
};

/** Client-side pre-check mirroring the service allow-list (ADR-013 §7) for a fast error. */
export function fileError(file: File): string | null {
  if (!HOMEWORK_ATTACHMENT.ALLOWED_MIME_TYPES.includes(file.type)) {
    return `File type not allowed: ${file.type || "unknown"}`;
  }
  if (file.size <= 0 || file.size > HOMEWORK_ATTACHMENT.MAX_FILE_BYTES) {
    return "File exceeds the maximum allowed size";
  }
  return null;
}

/** Push bytes to a server-minted signed upload URL for the homework-files bucket. */
export async function pushToSignedUrl(
  storagePath: string,
  token: string,
  file: File,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .storage.from(STORAGE_BUCKETS.HOMEWORK_FILES)
    .uploadToSignedUrl(storagePath, token, file);
  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }
}

export const kb = (bytes: number | null): string =>
  bytes != null ? `${Math.max(1, Math.round(bytes / 1024))} KB` : "—";
