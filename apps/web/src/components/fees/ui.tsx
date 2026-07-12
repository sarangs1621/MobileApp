import type { InvoiceStatusKey, PaymentMethodKey } from "@repo/types";

/** Shared money + labels for the M13 fee console (ADR-021). Amounts are in paise. */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/** Paise → a ₹ amount string (e.g. 150000 → "₹1,500.00"). */
export function formatPaise(paise: number): string {
  return INR.format(paise / 100);
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatusKey, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIAL: "Partly paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

/** A stored invoice status — OVERDUE is compute-on-read and never a filter value (§3). */
export type StoredInvoiceStatusKey = Exclude<InvoiceStatusKey, "OVERDUE">;

/** Statuses a stored invoice can hold (the filter set). */
export const INVOICE_STATUS_FILTERS: StoredInvoiceStatusKey[] = [
  "DRAFT",
  "ISSUED",
  "PARTIAL",
  "PAID",
  "CANCELLED",
];

export const METHOD_LABEL: Record<PaymentMethodKey, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  ONLINE: "Online",
};

export const PAYMENT_METHODS: PaymentMethodKey[] = [
  "CASH",
  "UPI",
  "CARD",
  "BANK_TRANSFER",
  "CHEQUE",
  "ONLINE",
];
