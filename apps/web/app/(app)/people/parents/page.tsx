"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { ParentDto, PreferredContactKey } from "@repo/types";
import { useCallback, useState } from "react";

import {
  ConfirmDelete,
  inputClass,
  labelClass,
  ListToolbar,
  Modal,
  outlineBtn,
  Paginator,
  primaryBtn,
  smallDangerBtn,
  smallGhostBtn,
  TableShell,
  usePagedSearch,
} from "@/src/components/academic/ui";
import { trpc } from "@/src/trpc/react";

const CONTACTS: readonly PreferredContactKey[] = ["PHONE", "EMAIL", "WHATSAPP"];

const CONTACT_LABEL: Record<PreferredContactKey, string> = {
  PHONE: "Phone",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

/**
 * Parent/guardian records CRUD. Linking a parent to a student happens on the
 * student detail page (the StudentParent junction). Deleting is blocked by the
 * service/DB while links exist. The PARENT role sees only their own record
 * (service row scope) with no actions.
 */
export default function ParentsPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.PARENT_MANAGE);

  const parents = trpc.parent.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.parent.list.invalidate();

  const create = trpc.parent.create.useMutation({ onSuccess: invalidate });
  const update = trpc.parent.update.useMutation({ onSuccess: invalidate });
  const remove = trpc.parent.delete.useMutation({ onSuccess: invalidate });

  const [editing, setEditing] = useState<ParentDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<ParentDto | null>(null);

  const paged = usePagedSearch(
    parents.data,
    useCallback(
      (parent: ParentDto, q: string) =>
        parent.name.toLowerCase().includes(q) ||
        parent.phone.toLowerCase().includes(q) ||
        (parent.email ?? "").toLowerCase().includes(q),
      [],
    ),
  );

  return (
    <section className="flex flex-col gap-4">
      <ListToolbar
        searchValue={paged.query}
        onSearch={paged.setQuery}
        searchLabel="Search parents"
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                create.reset();
                update.reset();
                setEditing("new");
              }}
              className={primaryBtn}
            >
              New parent
            </button>
          ) : undefined
        }
      />

      <TableShell
        head={["Name", "Phone", "Email", "Occupation", "Preferred contact", "Actions"]}
        isLoading={parents.isLoading}
        isError={parents.isError}
        isEmpty={paged.total === 0}
        emptyText="No parents yet."
      >
        {paged.pageItems.map((parent) => (
          <tr key={parent.id} className="border-b border-border last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{parent.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{parent.phone}</td>
            <td className="px-4 py-3 text-muted-foreground">{parent.email ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{parent.occupation ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {CONTACT_LABEL[parent.preferredContact]}
            </td>
            <td className="px-4 py-3">
              {canManage ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      create.reset();
                      update.reset();
                      setEditing(parent);
                    }}
                    className={smallGhostBtn}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove.reset();
                      setDeleting(parent);
                    }}
                    className={smallDangerBtn}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      <Paginator
        page={paged.page}
        pageCount={paged.pageCount}
        total={paged.total}
        onPage={paged.setPage}
      />

      {editing !== null ? (
        <ParentFormModal
          parent={editing === "new" ? null : editing}
          busy={create.isPending || update.isPending}
          error={create.error?.message ?? update.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing === "new") {
              create.mutate(
                {
                  name: values.name,
                  phone: values.phone,
                  ...(values.email ? { email: values.email } : {}),
                  ...(values.occupation ? { occupation: values.occupation } : {}),
                  ...(values.address ? { address: values.address } : {}),
                  preferredContact: values.preferredContact,
                },
                done,
              );
            } else {
              update.mutate(
                {
                  id: editing.id,
                  name: values.name,
                  phone: values.phone,
                  email: values.email || null,
                  occupation: values.occupation || null,
                  address: values.address || null,
                  preferredContact: values.preferredContact,
                },
                done,
              );
            }
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDelete
          title="Delete parent"
          message={`Permanently delete “${deleting.name}”? Parents still linked to a student cannot be deleted — unlink them first.`}
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </section>
  );
}

interface ParentFormValues {
  name: string;
  phone: string;
  email: string;
  occupation: string;
  address: string;
  preferredContact: PreferredContactKey;
}

function ParentFormModal({
  parent,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  parent: ParentDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ParentFormValues) => void;
}) {
  const [name, setName] = useState(parent?.name ?? "");
  const [phone, setPhone] = useState(parent?.phone ?? "");
  const [email, setEmail] = useState(parent?.email ?? "");
  const [occupation, setOccupation] = useState(parent?.occupation ?? "");
  const [address, setAddress] = useState(parent?.address ?? "");
  const [preferredContact, setPreferredContact] = useState<PreferredContactKey>(
    parent?.preferredContact ?? "PHONE",
  );

  return (
    <Modal title={parent ? "Edit parent" : "New parent"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            occupation: occupation.trim(),
            address: address.trim(),
            preferredContact,
          });
        }}
        className="flex flex-col gap-3"
      >
        <label className={labelClass}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              inputMode="tel"
              required
            />
          </label>
          <label className={labelClass}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className={labelClass}>
          Occupation
          <input
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Address
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`${inputClass} min-h-20`}
            rows={3}
          />
        </label>
        <label className={labelClass}>
          Preferred contact
          <select
            value={preferredContact}
            onChange={(e) => setPreferredContact(e.target.value as PreferredContactKey)}
            className={inputClass}
          >
            {CONTACTS.map((c) => (
              <option key={c} value={c}>
                {CONTACT_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={outlineBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
