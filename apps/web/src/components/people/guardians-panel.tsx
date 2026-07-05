"use client";

import type { StudentParentDto, StudentRelationshipKey } from "@repo/types";
import { useState } from "react";

import {
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
  smallDangerBtn,
  TableShell,
} from "@/src/components/academic/ui";
import { ConfirmAction } from "@/src/components/people/confirm";
import { trpc } from "@/src/trpc/react";

const RELATIONSHIPS: readonly StudentRelationshipKey[] = [
  "FATHER",
  "MOTHER",
  "GUARDIAN",
  "EMERGENCY_CONTACT",
];

const RELATIONSHIP_LABEL: Record<StudentRelationshipKey, string> = {
  FATHER: "Father",
  MOTHER: "Mother",
  GUARDIAN: "Guardian",
  EMERGENCY_CONTACT: "Emergency contact",
};

/**
 * Guardians of one student — the StudentParent junction (many-to-many with a
 * relationship enum; at most one primary contact per student, enforced in the
 * service). Parent RECORDS are managed on /people/parents; here they are only
 * linked/unlinked. Name resolution needs PARENT_READ (admins) — teachers see
 * the relationship label instead.
 */
export function GuardiansPanel({
  studentId,
  canManage,
  canReadParents,
}: {
  studentId: string;
  canManage: boolean;
  canReadParents: boolean;
}) {
  const guardians = trpc.parent.guardians.useQuery({ studentId });
  const parents = trpc.parent.list.useQuery(undefined, { enabled: canReadParents });

  const utils = trpc.useUtils();
  const invalidate = () => void utils.parent.guardians.invalidate({ studentId });

  const link = trpc.parent.link.useMutation({ onSuccess: invalidate });
  const unlink = trpc.parent.unlink.useMutation({ onSuccess: invalidate });

  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<StudentParentDto | null>(null);

  const parentName = new Map((parents.data ?? []).map((p) => [p.id, p.name]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Guardians</h3>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              link.reset();
              setLinking(true);
            }}
            className={primaryBtn}
          >
            Link parent
          </button>
        ) : null}
      </div>

      <TableShell
        head={["Parent", "Relationship", "Primary", "Actions"]}
        isLoading={guardians.isLoading}
        isError={guardians.isError}
        isEmpty={(guardians.data ?? []).length === 0}
        emptyText="No guardians linked."
      >
        {(guardians.data ?? []).map((guardian) => (
          <tr
            key={`${guardian.parentId}:${guardian.relationship}`}
            className="border-b border-border last:border-b-0"
          >
            <td className="px-4 py-3 font-medium text-foreground">
              {parentName.get(guardian.parentId) ?? guardian.parentId}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {RELATIONSHIP_LABEL[guardian.relationship]}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{guardian.isPrimary ? "Yes" : "—"}</td>
            <td className="px-4 py-3">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    unlink.reset();
                    setUnlinking(guardian);
                  }}
                  className={smallDangerBtn}
                >
                  Unlink
                </button>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      {linking ? (
        <LinkParentModal
          parentOptions={parents.data ?? []}
          busy={link.isPending}
          error={link.error?.message ?? null}
          onClose={() => setLinking(false)}
          onSubmit={(values) =>
            link.mutate(
              {
                studentId,
                parentId: values.parentId,
                relationship: values.relationship,
                ...(values.isPrimary ? { isPrimary: true } : {}),
              },
              { onSuccess: () => setLinking(false) },
            )
          }
        />
      ) : null}

      {unlinking !== null ? (
        <ConfirmAction
          title="Unlink parent"
          message={`Remove this ${RELATIONSHIP_LABEL[unlinking.relationship].toLowerCase()} link? The parent record itself is kept.`}
          actionLabel="Unlink"
          busyLabel="Unlinking…"
          busy={unlink.isPending}
          error={unlink.error?.message ?? null}
          onCancel={() => setUnlinking(null)}
          onConfirm={() =>
            unlink.mutate(
              {
                studentId,
                parentId: unlinking.parentId,
                relationship: unlinking.relationship,
              },
              { onSuccess: () => setUnlinking(null) },
            )
          }
        />
      ) : null}
    </section>
  );
}

function LinkParentModal({
  parentOptions,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  parentOptions: readonly { id: string; name: string; phone: string }[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: {
    parentId: string;
    relationship: StudentRelationshipKey;
    isPrimary: boolean;
  }) => void;
}) {
  const [parentId, setParentId] = useState("");
  const [relationship, setRelationship] = useState<StudentRelationshipKey>("FATHER");
  const [isPrimary, setIsPrimary] = useState(false);

  return (
    <Modal title="Link parent" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ parentId, relationship, isPrimary });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Parent
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">Select a parent…</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.phone})
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Relationship
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as StudentRelationshipKey)}
            className={inputClass}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
          />
          Primary contact (replaces any existing primary)
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={outlineBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Linking…" : "Link"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
