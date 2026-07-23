import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import type { PaymentMethodKey } from "@repo/types";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Chip, Field, Header, Loading } from "../../../../components/behaviour-ui";
import {
  formatPaise,
  InvoiceStatusText,
  METHOD_LABEL,
  PAYMENT_METHODS,
} from "../../../../components/fees-ui";
import { Button } from "../../../../components/ui";
import { trpc } from "../../../../lib/trpc";

const inputClass =
  "rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900";

/**
 * Invoice detail (M13 Step 6) — the deep-link target for INVOICE_ISSUED / PAYMENT_RECEIVED
 * notifications (actionUrl=/fees/invoices/:id). Shows the invoice, its payment history
 * (each a receipt), and — for an admin (payment:record) — a quick payment-entry form.
 * Parents view only (no online gateway in v1 — ADR-021 deviation #3).
 */
export default function InvoiceDetailScreen() {
  const { dict } = useTranslation();
  const t = dict.fees;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const enabled = !!id;
  const utils = trpc.useUtils();

  const role = trpc.auth.me.useQuery().data?.role;
  const canRecord = role !== undefined && can(role, PERMISSIONS.PAYMENT_RECORD);

  const invoiceQ = trpc.fee.getInvoice.useQuery({ id: id ?? "" }, { enabled });
  const paymentsQ = trpc.payment.listByInvoice.useQuery({ id: id ?? "" }, { enabled });
  const inv = invoiceQ.data;

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodKey>("CASH");
  const [error, setError] = useState<string | null>(null);

  const record = trpc.payment.record.useMutation({
    onSuccess: () => {
      setAmount("");
      setError(null);
      void utils.fee.getInvoice.invalidate({ id });
      void utils.payment.listByInvoice.invalidate({ id });
      if (inv) void utils.fee.listInvoicesByStudent.invalidate({ studentId: inv.studentId });
    },
    onError: (e) => setError(e.message),
  });

  const submit = () => {
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError(t.enterValidAmount);
      return;
    }
    const paise = Math.round(rupees * 100);
    if (inv && paise > inv.balanceAmount) {
      setError(t.amountExceedsBalance);
      return;
    }
    record.mutate({ invoiceId: id ?? "", amount: paise, method });
  };

  const canPay = !!inv && (inv.status === "ISSUED" || inv.status === "PARTIAL");

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title={t.invoice} onBack={() => router.back()} />
      {invoiceQ.isLoading || !inv ? (
        <Loading />
      ) : (
        <ScrollView contentContainerClassName="p-4 gap-4">
          <View className="gap-2 rounded-card border border-subtle bg-card p-4 shadow-sm">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-display text-title text-neutral-900">
                {inv.invoiceNumber}
              </Text>
              <InvoiceStatusText status={inv.status} />
            </View>
            <Row label={t.total} value={formatPaise(inv.totalAmount)} />
            <Row label={t.paid} value={formatPaise(inv.paidAmount)} />
            <Row label={t.balance} value={formatPaise(inv.balanceAmount)} strong />
            <Row label={t.dueDate} value={inv.dueDate} />
            {inv.remarks ? <Row label={t.remarks} value={inv.remarks} /> : null}
          </View>

          {canRecord && canPay ? (
            <View className="gap-3 rounded-card border border-subtle bg-card p-4 shadow-sm">
              <Text className="font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
                {t.recordPaymentHeading}
              </Text>
              <Field label={t.amountLabel}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#948676"
                  className={inputClass}
                />
              </Field>
              <Field label={t.method}>
                <View className="flex-row flex-wrap gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <Chip
                      key={m}
                      label={METHOD_LABEL[m]}
                      active={method === m}
                      onPress={() => setMethod(m)}
                    />
                  ))}
                </View>
              </Field>
              {error ? <Text className="font-sans text-sm text-danger-600">{error}</Text> : null}
              <Button
                label={record.isPending ? t.recording : t.recordPayment}
                loading={record.isPending}
                onPress={submit}
              />
            </View>
          ) : null}

          <Field label={t.payments}>
            {(paymentsQ.data ?? []).length === 0 ? (
              <Text className="font-sans text-neutral-500">{t.noPayments}</Text>
            ) : (
              (paymentsQ.data ?? []).map((p) => (
                <Link
                  key={p.id}
                  href={{ pathname: "/fees/receipt/[paymentId]", params: { paymentId: p.id } }}
                  asChild
                >
                  <Pressable
                    accessibilityRole="button"
                    className="flex-row items-center justify-between gap-2 rounded-xl border border-subtle bg-neutral-50 p-3 active:bg-primary-50"
                  >
                    <View>
                      <Text className="font-sans text-body font-semibold text-neutral-900">
                        {p.receiptNumber}
                      </Text>
                      <Text className="font-sans text-caption text-neutral-400">
                        {p.paymentDate} · {METHOD_LABEL[p.method]}
                      </Text>
                    </View>
                    <Text className="font-sans text-body font-semibold text-neutral-900">
                      {formatPaise(p.amount)}
                    </Text>
                  </Pressable>
                </Link>
              ))
            )}
          </Field>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="font-sans text-sm text-neutral-500">{label}</Text>
      <Text
        className={
          strong
            ? "font-sans text-body font-semibold text-neutral-900"
            : "font-sans text-body text-neutral-800"
        }
      >
        {value}
      </Text>
    </View>
  );
}
