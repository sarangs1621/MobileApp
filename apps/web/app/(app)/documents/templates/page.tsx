"use client";

import { Certificate, Info, Plus } from "@phosphor-icons/react";
import type { DocumentTemplateDto, DocumentTypeKey } from "@repo/types";
import { cn } from "@repo/ui";
import Link from "next/link";
import { useState } from "react";

import { CERT_TYPES, DOCUMENT_TYPE_LABEL } from "@/src/components/documents/ui";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/**
 * Document templates (M15, ADR-023 §4; design handoff §10 — Templates tab). A
 * template labels/enables which certificate types the office may generate. Create,
 * rename, and (de)activate. Only active templates appear in the Generate dialog.
 */
export default function DocumentTemplatesPage() {
  const { show } = useToast();
  const utils = trpc.useUtils();
  const list = trpc.documentTemplate.list.useQuery({});
  const rows = list.data ?? [];
  const invalidate = () => void utils.documentTemplate.list.invalidate();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplateDto | null>(null);
  const update = trpc.documentTemplate.update.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Template updated");
    },
    onError: (e) => show("error", e.message),
  });

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pb-12 pt-7 lg:px-9">
      {/* Header */}
      <section className="flex animate-fade-up flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-eyebrow text-gold-700">
            <span aria-hidden className="h-0.5 w-7 bg-gold-500" />
            Operations
          </div>
          <h1 className="font-display text-[34px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            Documents &amp; certificates
          </h1>
          <p className="text-sm text-ink-500">
            Certificate templates the office can generate from.
          </p>
        </div>
        <nav
          aria-label="Documents sections"
          className="flex max-w-full flex-wrap gap-1.5 self-start rounded-[24px] border border-subtle bg-cream-100 p-[5px]"
        >
          {[
            { href: "/documents", label: "Documents", active: false },
            { href: "/documents/templates", label: "Templates", active: true },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-[18px] py-[9px] text-[13.5px] font-semibold transition-colors duration-fast",
                t.active
                  ? "bg-maroon-700 text-cream-50 shadow-sm"
                  : "text-ink-700 hover:text-maroon-800",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </section>

      <div className="flex items-center">
        <div className="flex-1" />
        <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
          New template
        </Button>
      </div>

      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1.5fr_1.2fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Type</span>
          <span>Name</span>
          <span>Status</span>
          <span className="w-[170px] text-right">Actions</span>
        </div>

        {list.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Certificate}
            title="No templates yet"
            message="Create a template to enable a certificate type in the Generate dialog."
            action={
              <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                New template
              </Button>
            }
          />
        ) : (
          rows.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[1.5fr_1.2fr_1fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3.5 transition-colors duration-fast last:border-0 hover:bg-cream-50"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-gold-100 text-gold-700">
                  <Certificate aria-hidden size={17} />
                </span>
                <span className="text-sm font-semibold text-ink-900">
                  {DOCUMENT_TYPE_LABEL[t.type]}
                </span>
              </span>
              <span className="truncate text-[13.5px] text-ink-700">{t.name}</span>
              <span>
                <StatusChip
                  tone={t.active ? "success" : "neutral"}
                  label={t.active ? "Active" : "Inactive"}
                  dot={t.active}
                />
              </span>
              <span className="flex w-[170px] justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="cursor-pointer rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: t.id, active: !t.active })}
                  className="cursor-pointer rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-ink-700 transition-colors duration-fast hover:border-strong hover:bg-cream-100 disabled:opacity-50"
                >
                  {t.active ? "Deactivate" : "Activate"}
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
        <Info aria-hidden size={15} />
        Only active templates appear in the Generate dialog. One template per certificate type is
        used at a time.
      </p>

      {creating ? (
        <TemplateModal
          template={null}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            invalidate();
          }}
        />
      ) : null}
      {editing ? (
        <TemplateModal
          template={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}
    </main>
  );
}

function TemplateModal({
  template,
  onClose,
  onDone,
}: {
  template: DocumentTemplateDto | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { show } = useToast();
  const [type, setType] = useState<DocumentTypeKey>(template?.type ?? "BONAFIDE_CERTIFICATE");
  const [name, setName] = useState(template?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.documentTemplate.create.useMutation({
    onSuccess: () => {
      show("success", "Template saved");
      onDone();
    },
    onError: (e) => setError(e.message),
  });
  const update = trpc.documentTemplate.update.useMutation({
    onSuccess: () => {
      show("success", "Template saved");
      onDone();
    },
    onError: (e) => setError(e.message),
  });
  const busy = create.isPending || update.isPending;

  return (
    <Dialog title={template ? "Rename template" : "New template"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError("Enter a name");
            return;
          }
          setError(null);
          if (template) update.mutate({ id: template.id, name: name.trim() });
          else create.mutate({ type, name: name.trim() });
        }}
        className="flex flex-col gap-[18px]"
      >
        {template ? null : (
          <Select
            label="Certificate type"
            value={type}
            onChange={(e) => setType(e.target.value as DocumentTypeKey)}
          >
            {CERT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        )}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Standard bonafide 2026"
          helper="A label for your team — parents never see it."
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="mt-1 flex justify-end gap-2.5">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {template ? "Save" : "Create template"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
