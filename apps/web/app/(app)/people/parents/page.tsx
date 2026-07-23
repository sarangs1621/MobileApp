"use client";

import {
  EnvelopeSimple,
  Info,
  PencilSimple,
  Phone,
  Plus,
  Trash,
  Users,
  WhatsappLogo,
  type Icon,
} from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { ParentDto, PreferredContactKey } from "@repo/types";
import { cn } from "@repo/ui";
import { useCallback, useState } from "react";

import { Paginator, usePagedSearch } from "@/src/components/academic/ui";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  SearchInput,
  Skeleton,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const CONTACTS: readonly PreferredContactKey[] = ["PHONE", "EMAIL", "WHATSAPP"];
const CONTACT_LABEL: Record<PreferredContactKey, string> = {
  PHONE: "Phone",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};
const CONTACT_ICON: Record<PreferredContactKey, Icon> = {
  PHONE: Phone,
  EMAIL: EnvelopeSimple,
  WHATSAPP: WhatsappLogo,
};

/**
 * Parent/guardian records (M3; design handoff §6 — Parents tab). Linking a parent
 * to a student happens on the student detail page (the StudentParent junction);
 * deleting is blocked by the service while links exist (surfaced on confirm). The
 * PARENT role sees only their own record (service row scope) with no actions.
 */
export default function ParentsPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.PARENT_MANAGE);
  const { show } = useToast();

  const parents = trpc.parent.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.parent.list.invalidate();

  const create = trpc.parent.create.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Parent saved");
    },
    onError: (e) => show("error", e.message),
  });
  const update = trpc.parent.update.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Parent saved");
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.parent.delete.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Parent deleted");
    },
    onError: (e) => show("error", e.message),
  });

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
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          placeholder="Search name or phone…"
          value={paged.query}
          onChange={(e) => paged.setQuery(e.target.value)}
          aria-label="Search parents"
          className="min-w-[260px]"
        />
        <div className="flex-1" />
        {canManage ? (
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              create.reset();
              update.reset();
              setEditing("new");
            }}
          >
            New parent
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1.4fr_1.6fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Parent</span>
          <span>Contact</span>
          <span>Prefers</span>
          <span className="w-[76px] text-right">Actions</span>
        </div>

        {parents.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : parents.isError ? (
          <ErrorState onRetry={() => void parents.refetch()} />
        ) : paged.pageItems.length === 0 ? (
          <EmptyState
            icon={Users}
            title={paged.total === 0 ? "No parents yet." : "No parents match."}
            message={
              paged.total === 0 && canManage
                ? "Add a parent, or import them alongside students from CSV."
                : undefined
            }
            action={
              paged.total === 0 && canManage ? (
                <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                  New parent
                </Button>
              ) : undefined
            }
          />
        ) : (
          paged.pageItems.map((p) => {
            const PrefIcon = CONTACT_ICON[p.preferredContact];
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1.4fr_1.6fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3 transition-colors duration-fast last:border-0 hover:bg-cream-50"
              >
                <span className="flex items-center gap-3">
                  <Avatar name={p.name} size="sm" />
                  <span className="truncate text-sm font-semibold text-ink-900">{p.name}</span>
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="truncate text-[13px] text-ink-900">{p.phone}</span>
                  <span className="truncate text-xs text-ink-400">{p.email ?? "No email"}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[13px] text-ink-500">
                  <PrefIcon aria-hidden size={16} className="text-maroon-700" />
                  {CONTACT_LABEL[p.preferredContact]}
                </span>
                <span className="flex w-[76px] justify-end gap-1.5">
                  {canManage ? (
                    <>
                      <IconButton
                        label="Edit"
                        icon={PencilSimple}
                        onClick={() => {
                          create.reset();
                          update.reset();
                          setEditing(p);
                        }}
                      />
                      <IconButton
                        label="Delete"
                        tone="danger"
                        icon={Trash}
                        onClick={() => {
                          remove.reset();
                          setDeleting(p);
                        }}
                      />
                    </>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </span>
              </div>
            );
          })
        )}

        <Paginator
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          onPage={paged.setPage}
        />
      </div>

      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
        <Info aria-hidden size={15} />
        Parents linked to a student can’t be deleted — unlink them from the student record first.
      </p>

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
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message="Permanently delete this parent? Parents still linked to a student cannot be deleted — unlink them first."
          confirmLabel="Delete parent"
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
  // Address isn't in the design's parent modal; preserve the existing value on edit.
  const address = parent?.address ?? "";
  const [preferredContact, setPreferredContact] = useState<PreferredContactKey>(
    parent?.preferredContact ?? "PHONE",
  );

  return (
    <Dialog title="Parent record" onClose={onClose}>
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
        className="flex flex-col gap-[18px]"
      >
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3.5">
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="+91"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Input
          label="Occupation"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
        />

        {/* Preferred contact choice tiles (design handoff §Choice pills) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Preferred contact</span>
          <div className="flex gap-2">
            {CONTACTS.map((c) => {
              const selected = preferredContact === c;
              const TileIcon = CONTACT_ICON[c];
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPreferredContact(c)}
                  className={cn(
                    "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-[11px] text-[13px] font-semibold transition-colors duration-fast",
                    selected
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  <TileIcon aria-hidden size={18} />
                  {CONTACT_LABEL[c]}
                </button>
              );
            })}
          </div>
          <span className="text-caption text-ink-400">
            Announcements and fee reminders go to this channel first.
          </span>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save parent
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
