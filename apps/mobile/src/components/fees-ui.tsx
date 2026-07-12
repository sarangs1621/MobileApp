import type { InvoiceStatusKey, PaymentMethodKey } from "@repo/types";
import { Text } from "react-native";

/** Shared money + status bits for the M13 fee screens (ADR-021). Amounts are in paise. */

/** Paise → a ₹ amount string (e.g. 150000 → "₹1,500.00"). */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  const [whole, frac] = rupees.toFixed(2).split(".");
  // Indian digit grouping (##,##,###) without Intl (Hermes-safe).
  const grouped = whole!.replace(/\B(?=(\d{2})*(\d{3})(?!\d))/g, ",");
  return `₹${grouped}.${frac}`;
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatusKey, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIAL: "Partly paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

const INVOICE_STATUS_CLASS: Record<InvoiceStatusKey, string> = {
  DRAFT: "text-muted-foreground",
  ISSUED: "text-info",
  PARTIAL: "text-primary",
  PAID: "text-success",
  OVERDUE: "text-destructive",
  CANCELLED: "text-muted-foreground",
};

export function InvoiceStatusText({ status }: { status: InvoiceStatusKey }) {
  return (
    <Text className={`text-xs font-semibold ${INVOICE_STATUS_CLASS[status]}`}>
      {INVOICE_STATUS_LABEL[status]}
    </Text>
  );
}

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
