"use client";

import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { InvoiceDto, PaymentMethodKey } from "@repo/types";
import Link from "next/link";
import { useMemo, useState } from "react";

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
import { downloadCsv } from "@/src/components/attendance/ui";
import {
  formatPaise,
  INVOICE_STATUS_FILTERS,
  INVOICE_STATUS_LABEL,
  METHOD_LABEL,
  PAYMENT_METHODS,
  type StoredInvoiceStatusKey,
} from "@/src/components/fees/ui";
import { trpc } from "@/src/trpc/react";

const fmtDate = (s: string) => new Date(s).toLocaleDateString();

/**
 * Fees console (M13, ADR-021 Step 7) — admin. Filter invoices by year / class / section /
 * structure / status; generate a section's invoices from a structure; issue, record
 * payments, cancel, print receipts; export the current view (student ledger / outstanding
 * report) to CSV. Thin client over the tRPC surface; the service is the authority.
 */
export default function FeesConsolePage() {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.FEE_MANAGE);
  const canRecord = role !== undefined && can(role, PERMISSIONS.PAYMENT_RECORD);

  const [academicYearId, setYear] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [feeStructureId, setStructure] = useState("");
  const [status, setStatus] = useState<StoredInvoiceStatusKey | "">("");

  const years = trpc.academicYear.list.useQuery(undefined, { enabled: canManage });
  const classes = trpc.class.list.useQuery(undefined, { enabled: canManage });
  const sections = trpc.section.list.useQuery({ classId }, { enabled: canManage && !!classId });
  const structures = trpc.fee.listStructures.useQuery(academicYearId ? { academicYearId } : {}, {
    enabled: canManage,
  });
  const students = trpc.student.list.useQuery(undefined, { enabled: canManage });
  const studentName = useMemo(
    () => new Map((students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [students.data],
  );

  const utils = trpc.useUtils();
  const list = trpc.fee.listInvoices.useQuery(
    {
      ...(academicYearId ? { academicYearId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(feeStructureId ? { feeStructureId } : {}),
      ...(status ? { status } : {}),
    },
    { enabled: canManage },
  );
  const rows = list.data ?? [];
  const outstanding = rows
    .filter((i) => i.status !== "CANCELLED")
    .reduce((sum, i) => sum + i.balanceAmount, 0);

  const refresh = () => void utils.fee.listInvoices.invalidate();
  const issue = trpc.fee.issueInvoice.useMutation({ onSuccess: refresh });
  const cancel = trpc.fee.cancelInvoice.useMutation({ onSuccess: refresh });
  const generate = trpc.fee.generateInvoices.useMutation({ onSuccess: refresh });

  const [payFor, setPayFor] = useState<InvoiceDto | null>(null);
  const [receiptsFor, setReceiptsFor] = useState<InvoiceDto | null>(null);
  const busy = issue.isPending || cancel.isPending;

  const [dueDate, setDueDate] = useState("");

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

  if (!me.isLoading && !canManage) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-destructive">You don’t have access to the fees console.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-primary">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Fees &amp; payments</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/fees/structures" className={outlineBtn}>
            Fee structures
          </Link>
          <button
            type="button"
            className={outlineBtn}
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export CSV
          </button>
        </div>
      </header>

      {/* Generate */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Generate invoices</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className={labelClass}>
            Structure
            <select
              className={inputClass}
              value={feeStructureId}
              onChange={(e) => setStructure(e.target.value)}
            >
              <option value="">Select…</option>
              {(structures.data ?? [])
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label className={labelClass}>
            Class
            <select
              className={inputClass}
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId("");
              }}
            >
              <option value="">Select…</option>
              {(classes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Section
            <select
              className={inputClass}
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={!classId}
            >
              <option value="">Select…</option>
              {(sections.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Due date
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={primaryBtn}
            disabled={!feeStructureId || !sectionId || !dueDate || generate.isPending}
            onClick={() => generate.mutate({ feeStructureId, sectionId, dueDate })}
          >
            {generate.isPending ? "Generating…" : "Generate"}
          </button>
          {generate.data ? (
            <span className="text-sm text-muted-foreground">
              {generate.data.created} created, {generate.data.skipped} skipped (already billed).
            </span>
          ) : null}
          {generate.error ? (
            <span className="text-sm text-destructive">{generate.error.message}</span>
          ) : null}
        </div>
      </section>

      {/* Filters */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className={labelClass}>
          Academic year
          <select
            className={inputClass}
            value={academicYearId}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">All years</option>
            {(years.data ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Class
          <select
            className={inputClass}
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
          </select>
        </label>
        <label className={labelClass}>
          Section
          <select
            className={inputClass}
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
          </select>
        </label>
        <label className={labelClass}>
          Status
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as StoredInvoiceStatusKey | "")}
          >
            <option value="">Any status</option>
            {INVOICE_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {INVOICE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <p className="text-sm text-muted-foreground">
        {rows.length} invoice{rows.length === 1 ? "" : "s"} · Outstanding{" "}
        <span className="font-semibold text-foreground">{formatPaise(outstanding)}</span>
      </p>

      <TableShell
        head={["Invoice", "Student", "Status", "Total", "Balance", "Due", "Actions"]}
        isLoading={list.isLoading}
        isError={list.isError}
        isEmpty={rows.length === 0}
        emptyText="No invoices match these filters."
      >
        {rows.map((i) => (
          <tr key={i.id} className="border-b border-border align-top last:border-b-0">
            <td className="px-4 py-3 font-medium text-foreground">{i.invoiceNumber}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {studentName.get(i.studentId) ?? "—"}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{INVOICE_STATUS_LABEL[i.status]}</td>
            <td className="px-4 py-3 text-muted-foreground">{formatPaise(i.totalAmount)}</td>
            <td className="px-4 py-3 font-medium text-foreground">
              {formatPaise(i.balanceAmount)}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{fmtDate(i.dueDate)}</td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1">
                {i.status === "DRAFT" ? (
                  <button
                    type="button"
                    className={smallGhostBtn}
                    disabled={busy}
                    onClick={() => issue.mutate({ id: i.id })}
                  >
                    Issue
                  </button>
                ) : null}
                {canRecord &&
                (i.status === "ISSUED" || i.status === "PARTIAL" || i.status === "OVERDUE") ? (
                  <button type="button" className={smallGhostBtn} onClick={() => setPayFor(i)}>
                    Record payment
                  </button>
                ) : null}
                <button type="button" className={smallGhostBtn} onClick={() => setReceiptsFor(i)}>
                  Receipts
                </button>
                {i.paidAmount === 0 && (i.status === "DRAFT" || i.status === "ISSUED") ? (
                  <button
                    type="button"
                    className={smallDangerBtn}
                    disabled={busy}
                    onClick={() => cancel.mutate({ id: i.id })}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {payFor ? (
        <PaymentModal
          invoice={payFor}
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
    </main>
  );
}

function PaymentModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: InvoiceDto;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState((invoice.balanceAmount / 100).toString());
  const [method, setMethod] = useState<PaymentMethodKey>("CASH");
  const [referenceNo, setRef] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const record = trpc.payment.record.useMutation({ onSuccess: onDone });

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
    <Modal title={`Record payment · ${invoice.invoiceNumber}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Balance {formatPaise(invoice.balanceAmount)}
        </p>
        <label className={labelClass}>
          Amount (₹)
          <input
            className={inputClass}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Method
          <select
            className={inputClass}
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethodKey)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Reference no. (optional)
          <input
            className={inputClass}
            value={referenceNo}
            onChange={(e) => setRef(e.target.value)}
          />
        </label>
        {(localError ?? record.error?.message) ? (
          <p className="text-sm text-destructive">{localError ?? record.error?.message}</p>
        ) : null}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className={outlineBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryBtn} disabled={record.isPending} onClick={submit}>
            {record.isPending ? "Recording…" : "Record"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptsModal({ invoice, onClose }: { invoice: InvoiceDto; onClose: () => void }) {
  const payments = trpc.payment.listByInvoice.useQuery({ id: invoice.id });
  const rows = payments.data ?? [];
  return (
    <Modal title={`Receipts · ${invoice.invoiceNumber}`} onClose={onClose}>
      {payments.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
            >
              <div>
                <div className="font-medium text-foreground">{p.receiptNumber}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(p.paymentDate)} · {METHOD_LABEL[p.method]}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{formatPaise(p.amount)}</span>
                <Link href={`/fees/receipt/${p.id}`} className={smallGhostBtn} target="_blank">
                  Print
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
