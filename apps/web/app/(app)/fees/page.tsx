"use client";

import {
  Bank,
  CreditCard,
  DeviceMobile,
  DownloadSimple,
  Info,
  Money,
  Printer,
  Prohibit,
  Receipt,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { InvoiceDto, PaymentMethodKey } from "@repo/types";
import { cn } from "@repo/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

import { downloadCsv } from "@/src/components/attendance/ui";
import {
  formatPaise,
  INVOICE_STATUS_FILTERS,
  INVOICE_STATUS_LABEL,
  METHOD_LABEL,
  type StoredInvoiceStatusKey,
} from "@/src/components/fees/ui";
import {
  Avatar,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Select,
  Skeleton,
  StatusChip,
  type Tone,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

const fmtDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  ISSUED: "brand",
  PARTIAL: "gold",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

// Payment-method tiles (design handoff) — the four common methods with icons.
const METHOD_TILES: { key: PaymentMethodKey; label: string; icon: Icon }[] = [
  { key: "CASH", label: "Cash", icon: Money },
  { key: "UPI", label: "UPI", icon: DeviceMobile },
  { key: "CARD", label: "Card", icon: CreditCard },
  { key: "CHEQUE", label: "Cheque", icon: Bank },
];

/**
 * Fees console — Invoices tab (M13, ADR-021; design handoff §9). Live summary
 * cards (Outstanding / Collected / Drafts), generate-invoices row, the invoice
 * state machine (Draft → Issue → Record payment → Paid; Cancel), a payment modal
 * (method tiles + partial-payment hint), and a receipts modal with the printable
 * receipt link. Thin client over the tRPC surface; the service is the authority.
 */
export default function FeesConsolePage() {
  const { show } = useToast();
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canRecord = role !== undefined && can(role, PERMISSIONS.PAYMENT_RECORD);

  const [academicYearId, setYear] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState<StoredInvoiceStatusKey | "">("");

  // Generate row (its own class/section/structure/due).
  const [genStructureId, setGenStructure] = useState("");
  const [genClassId, setGenClass] = useState("");
  const [genSectionId, setGenSection] = useState("");
  const [genDue, setGenDue] = useState("");

  const years = trpc.academicYear.list.useQuery();
  const classes = trpc.class.list.useQuery();
  const sections = trpc.section.list.useQuery({ classId }, { enabled: !!classId });
  const genSections = trpc.section.list.useQuery(
    { classId: genClassId },
    { enabled: !!genClassId },
  );
  const structures = trpc.fee.listStructures.useQuery(academicYearId ? { academicYearId } : {});
  const students = trpc.student.list.useQuery();
  const studentName = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [students.data],
  );

  const utils = trpc.useUtils();
  const list = trpc.fee.listInvoices.useQuery({
    ...(academicYearId ? { academicYearId } : {}),
    ...(sectionId ? { sectionId } : {}),
    ...(status ? { status } : {}),
  });
  const rows = list.data ?? [];
  const active = rows.filter((i) => i.status !== "CANCELLED");
  const outstanding = active.reduce((sum, i) => sum + i.balanceAmount, 0);
  const collected = rows.reduce((sum, i) => sum + i.paidAmount, 0);
  const openCount = active.filter((i) => i.balanceAmount > 0).length;
  const draftCount = rows.filter((i) => i.status === "DRAFT").length;
  const paidCount = rows.filter((i) => i.status === "PAID").length;

  const refresh = () => void utils.fee.listInvoices.invalidate();
  const issue = trpc.fee.issueInvoice.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Invoice issued — visible to parents");
    },
    onError: (e) => show("error", e.message),
  });
  const cancel = trpc.fee.cancelInvoice.useMutation({
    onSuccess: () => {
      refresh();
      show("success", "Invoice cancelled");
    },
    onError: (e) => show("error", e.message),
  });
  const generate = trpc.fee.generateInvoices.useMutation({
    onSuccess: (r) => {
      refresh();
      show("success", `${r.created} draft invoice${r.created === 1 ? "" : "s"} generated`);
    },
    onError: (e) => show("error", e.message),
  });

  const [payFor, setPayFor] = useState<InvoiceDto | null>(null);
  const [receiptsFor, setReceiptsFor] = useState<InvoiceDto | null>(null);
  const busy = issue.isPending || cancel.isPending;

  const exportCsv = () => {
    const header = ["Invoice", "Student", "Status", "Total", "Paid", "Balance", "Issue", "Due"];
    const body = rows.map((i) => [
      i.invoiceNumber,
      studentName.get(i.studentId) ?? i.studentId,
      INVOICE_STATUS_LABEL[i.status],
      (i.totalAmount / 100).toFixed(2),
      (i.paidAmount / 100).toFixed(2),
      (i.balanceAmount / 100).toFixed(2),
      i.issueDate,
      i.dueDate,
    ]);
    downloadCsv("invoices.csv", [header, ...body]);
  };

  return (
    <section className="flex flex-col gap-4">
      {/* Summary cards */}
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[220px] flex-[1.2] flex-col gap-1 rounded-card bg-maroon-900 px-[22px] py-[18px] text-cream-50">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-gold-400">
            Outstanding
          </span>
          <span className="font-display text-[30px] font-semibold">{formatPaise(outstanding)}</span>
          <span className="text-[12.5px] text-cream-50/65">
            {openCount} open invoice{openCount === 1 ? "" : "s"}
          </span>
        </div>
        <SummaryCard
          label="Collected"
          value={formatPaise(collected)}
          valueClass="text-green-600"
          note={`${paidCount} paid in full`}
        />
        <SummaryCard
          label="Drafts to issue"
          value={String(draftCount)}
          note="Parents can’t see drafts yet"
        />
        <div className="ml-auto flex items-end">
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-white px-[18px] py-2.5 text-[13px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50 disabled:opacity-50"
          >
            <DownloadSimple aria-hidden size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Generate invoices */}
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-subtle bg-white px-5 py-[18px] shadow-sm">
        <span className="mr-1.5 flex flex-col gap-0.5">
          <span className="font-display text-base font-semibold text-ink-900">
            Generate invoices
          </span>
          <span className="text-xs text-ink-500">One draft per student in the section</span>
        </span>
        <div className="min-w-[180px]">
          <Select
            label="Structure"
            value={genStructureId}
            onChange={(e) => setGenStructure(e.target.value)}
          >
            <option value="">Select…</option>
            {(structures.data ?? [])
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </div>
        <div className="min-w-[110px]">
          <Select
            label="Class"
            value={genClassId}
            onChange={(e) => {
              setGenClass(e.target.value);
              setGenSection("");
            }}
          >
            <option value="">Select…</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[80px]">
          <Select
            label="Section"
            value={genSectionId}
            onChange={(e) => setGenSection(e.target.value)}
            disabled={!genClassId}
          >
            <option value="">Select…</option>
            {(genSections.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <DateField label="Due date" value={genDue} onChange={setGenDue} />
        <Button
          disabled={!genStructureId || !genSectionId || !genDue || generate.isPending}
          loading={generate.isPending}
          onClick={() =>
            generate.mutate({
              feeStructureId: genStructureId,
              sectionId: genSectionId,
              dueDate: genDue,
            })
          }
        >
          Generate
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[140px]">
          <Select
            label="Academic year"
            value={academicYearId}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">All years</option>
            {(years.data ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[110px]">
          <Select
            label="Class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
            }}
          >
            <option value="">All classes</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[80px]">
          <Select
            label="Section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!classId}
          >
            <option value="">All sections</option>
            {(sections.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[120px]">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StoredInvoiceStatusKey | "")}
          >
            <option value="">Any status</option>
            {INVOICE_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {INVOICE_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Invoice table */}
      <div className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
        <div className="grid grid-cols-[1.2fr_1.3fr_1fr_0.9fr_0.9fr_0.8fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
          <span>Invoice</span>
          <span>Student</span>
          <span>Status</span>
          <span className="text-right">Total</span>
          <span className="text-right">Balance</span>
          <span>Due</span>
          <span className="w-[210px] text-right">Actions</span>
        </div>

        {list.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No invoices match these filters."
            message="Generate a section’s invoices from a structure above, or clear the filters."
          />
        ) : (
          rows.map((i) => {
            const cancelled = i.status === "CANCELLED";
            const canCancel = i.paidAmount === 0 && (i.status === "DRAFT" || i.status === "ISSUED");
            const canPay =
              canRecord &&
              (i.status === "ISSUED" || i.status === "PARTIAL" || i.status === "OVERDUE");
            const overdue = i.status === "OVERDUE";
            return (
              <div
                key={i.id}
                className={cn(
                  "grid grid-cols-[1.2fr_1.3fr_1fr_0.9fr_0.9fr_0.8fr_auto] items-center gap-3 border-b border-cream-100 px-5 py-3 transition-colors duration-fast last:border-0 hover:bg-cream-50",
                  cancelled && "opacity-55",
                )}
              >
                <span className="font-mono text-[13px] font-semibold text-maroon-800">
                  {i.invoiceNumber}
                </span>
                <span className="flex items-center gap-2.5">
                  <Avatar name={studentName.get(i.studentId) ?? "?"} size="sm" />
                  <span className="truncate text-[13.5px] font-semibold text-ink-900">
                    {studentName.get(i.studentId) ?? "—"}
                  </span>
                </span>
                <span>
                  <StatusChip
                    tone={STATUS_TONE[i.status] ?? "neutral"}
                    label={INVOICE_STATUS_LABEL[i.status]}
                    dot
                  />
                </span>
                <span className="text-right text-[13.5px] tabular-nums text-ink-700">
                  {formatPaise(i.totalAmount)}
                </span>
                <span
                  className={cn(
                    "text-right text-[13.5px] tabular-nums",
                    i.balanceAmount > 0 ? "font-bold text-ink-900" : "text-ink-400",
                  )}
                >
                  {cancelled ? "—" : formatPaise(i.balanceAmount)}
                </span>
                <span
                  className={cn(
                    "text-[13px]",
                    overdue ? "font-semibold text-red-600" : "text-ink-500",
                  )}
                >
                  {fmtDate(i.dueDate)}
                </span>
                <span className="flex w-[210px] items-center justify-end gap-1.5">
                  {i.status === "DRAFT" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => issue.mutate({ id: i.id })}
                      className="cursor-pointer rounded-full bg-maroon-700 px-3.5 py-[7px] text-[12.5px] font-semibold text-cream-50 transition-colors duration-fast hover:bg-maroon-800 disabled:opacity-50"
                    >
                      Issue
                    </button>
                  ) : null}
                  {canPay ? (
                    <button
                      type="button"
                      onClick={() => setPayFor(i)}
                      className="cursor-pointer whitespace-nowrap rounded-full bg-green-600 px-3.5 py-[7px] text-[12.5px] font-semibold text-white transition-[filter] duration-fast hover:brightness-95"
                    >
                      Record payment
                    </button>
                  ) : null}
                  <IconButton label="Receipts" icon={Receipt} onClick={() => setReceiptsFor(i)} />
                  {canCancel ? (
                    <IconButton
                      label="Cancel invoice"
                      tone="danger"
                      icon={Prohibit}
                      disabled={busy}
                      onClick={() => cancel.mutate({ id: i.id })}
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
        Draft → Issue (parents see it and can pay) → Paid. Cancelling keeps the invoice for the
        record but stops collection.
      </p>

      {payFor ? (
        <PaymentModal
          invoice={payFor}
          studentName={studentName.get(payFor.studentId) ?? ""}
          onClose={() => setPayFor(null)}
          onDone={() => {
            setPayFor(null);
            refresh();
          }}
        />
      ) : null}

      {receiptsFor ? (
        <ReceiptsModal invoice={receiptsFor} onClose={() => setReceiptsFor(null)} />
      ) : null}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  note,
  valueClass,
}: {
  label: string;
  value: string;
  note: string;
  valueClass?: string;
}) {
  return (
    <div className="flex min-w-[180px] flex-1 flex-col gap-1 rounded-card border border-subtle bg-white px-[22px] py-[18px]">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        {label}
      </span>
      <span className={cn("font-display text-[30px] font-semibold text-ink-900", valueClass)}>
        {value}
      </span>
      <span className="text-[12.5px] text-ink-400">{note}</span>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1.5 text-[13px] font-semibold text-ink-900">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-[10px] border border-subtle bg-white px-3 text-sm text-ink-900 outline-none focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100"
      />
    </label>
  );
}

/* ---------------------------------------------------------------- payment modal */

function PaymentModal({
  invoice,
  studentName,
  onClose,
  onDone,
}: {
  invoice: InvoiceDto;
  studentName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { show } = useToast();
  const [amount, setAmount] = useState((invoice.balanceAmount / 100).toString());
  const [method, setMethod] = useState<PaymentMethodKey>("CASH");
  const [referenceNo, setRef] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const record = trpc.payment.record.useMutation({
    onSuccess: () => {
      show("success", "Payment recorded — receipt issued");
      onDone();
    },
    onError: (e) => show("error", e.message),
  });

  const submit = () => {
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setLocalError("Enter a valid amount");
      return;
    }
    const paise = Math.round(rupees * 100);
    if (paise > invoice.balanceAmount) {
      setLocalError("Amount exceeds the outstanding balance");
      return;
    }
    setLocalError(null);
    record.mutate({
      invoiceId: invoice.id,
      amount: paise,
      method,
      ...(referenceNo.trim() ? { referenceNo: referenceNo.trim() } : {}),
    });
  };

  return (
    <Dialog
      title="Record payment"
      description={`${invoice.invoiceNumber}${studentName ? ` · ${studentName}` : ""} · balance ${formatPaise(invoice.balanceAmount)}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helper="Partial payments are fine — the balance stays open."
          required
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Method</span>
          <div className="grid grid-cols-4 gap-2">
            {METHOD_TILES.map((m) => {
              const selected = method === m.key;
              const TileIcon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setMethod(m.key)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-[11px] border px-1.5 py-2.5 text-[12.5px] font-semibold transition-colors duration-fast",
                    selected
                      ? "border-maroon-700 bg-maroon-50 text-maroon-800"
                      : "border-subtle bg-white text-ink-500 hover:border-strong",
                  )}
                >
                  <TileIcon aria-hidden size={17} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Reference (optional)"
          value={referenceNo}
          onChange={(e) => setRef(e.target.value)}
          placeholder="UPI txn id, cheque no…"
        />

        {(localError ?? record.error?.message) ? (
          <p className="text-sm text-red-600">{localError ?? record.error?.message}</p>
        ) : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={record.isPending}>
            Record &amp; issue receipt
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* --------------------------------------------------------------- receipts modal */

function ReceiptsModal({ invoice, onClose }: { invoice: InvoiceDto; onClose: () => void }) {
  const payments = trpc.payment.listByInvoice.useQuery({ id: invoice.id });
  const rows = payments.data ?? [];
  return (
    <Dialog title={`Receipts · ${invoice.invoiceNumber}`} onClose={onClose}>
      {payments.isLoading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 px-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-[15px] bg-cream-100 text-ink-400">
            <Receipt aria-hidden size={24} />
          </span>
          <span className="text-sm font-semibold text-ink-900">No payments recorded yet</span>
          <span className="text-[13px] text-ink-500">
            Receipts appear here as soon as a payment is recorded.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3.5 rounded-[14px] border border-subtle px-[18px] py-3.5 transition-colors duration-fast hover:bg-cream-50"
            >
              <span className="flex size-[38px] items-center justify-center rounded-[11px] bg-green-100 text-green-600">
                <Receipt aria-hidden size={19} weight="bold" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="font-mono text-sm font-semibold text-ink-900">
                  {p.receiptNumber}
                </span>
                <span className="truncate text-[12.5px] text-ink-500">
                  {fmtDate(p.paymentDate)} · {METHOD_LABEL[p.method]}
                  {p.referenceNo ? ` · ref ${p.referenceNo}` : ""}
                </span>
              </span>
              <span className="font-display text-lg font-semibold text-ink-900">
                {formatPaise(p.amount)}
              </span>
              <Link
                href={`/fees/receipt/${p.id}`}
                target="_blank"
                className="flex items-center gap-1.5 rounded-full border border-subtle bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
              >
                <Printer aria-hidden size={14} />
                Print
              </Link>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
