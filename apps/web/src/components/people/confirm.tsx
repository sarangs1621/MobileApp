"use client";

import { destructiveBtn, Modal, outlineBtn, primaryBtn } from "@/src/components/academic/ui";

/**
 * Generic confirm dialog for the M3 people screens. Like the M2 `ConfirmDelete`
 * but with configurable action wording — archive/withdraw/unlink are lifecycle
 * changes, not deletions, and the button must say what actually happens
 * (UI_DESIGN_SYSTEM.md §11).
 */
export function ConfirmAction({
  title,
  message,
  actionLabel,
  busyLabel,
  destructive = true,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  actionLabel: string;
  busyLabel: string;
  destructive?: boolean;
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
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={destructive ? destructiveBtn : primaryBtn}
        >
          {busy ? busyLabel : actionLabel}
        </button>
      </div>
    </Modal>
  );
}
