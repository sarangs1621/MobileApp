import { useTranslation } from "@repo/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { Field, Header, Loading } from "../../../../components/behaviour-ui";
import { formatPaise, METHOD_LABEL } from "../../../../components/fees-ui";
import { trpc } from "../../../../lib/trpc";

/**
 * Payment receipt (M13 Step 6) — the "download receipt" surface. Rendered on demand from
 * the payment + invoice (no stored PDF — ADR-021 §8). Scope-gated by the invoice read gate
 * (admin all; parent own-child).
 */
export default function ReceiptScreen() {
  const { dict } = useTranslation();
  const t = dict.fees;
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const enabled = !!paymentId;

  const receipt = trpc.payment.receipt.useQuery({ id: paymentId ?? "" }, { enabled });
  const data = receipt.data;

  return (
    <View className="flex-1 bg-background">
      <Header title={t.receipt} onBack={() => router.back()} />
      {receipt.isLoading || !data ? (
        <Loading />
      ) : (
        <ScrollView contentContainerClassName="p-4 gap-4">
          <View className="items-center gap-1 rounded-md border border-border bg-card p-6">
            <Text className="text-sm text-muted-foreground">{t.receipt}</Text>
            <Text className="text-xl font-semibold text-foreground">
              {data.payment.receiptNumber}
            </Text>
            <Text className="mt-2 text-3xl font-bold text-foreground">
              {formatPaise(data.payment.amount)}
            </Text>
            <Text className="text-sm text-success">{t.paid}</Text>
          </View>

          <View className="gap-3 rounded-md border border-border bg-card p-4">
            <Row label={t.date} value={data.payment.paymentDate} />
            <Row label={t.method} value={METHOD_LABEL[data.payment.method]} />
            {data.payment.referenceNo ? (
              <Row label={t.reference} value={data.payment.referenceNo} />
            ) : null}
            <Row label={t.invoice} value={data.invoice.invoiceNumber} />
            <Row label={t.invoiceTotal} value={formatPaise(data.invoice.totalAmount)} />
            <Row label={t.invoiceBalance} value={formatPaise(data.invoice.balanceAmount)} />
          </View>

          {data.payment.remarks ? (
            <Field label={t.remarks}>
              <Text className="text-foreground">{data.payment.remarks}</Text>
            </Field>
          ) : null}

          <Text className="px-1 text-xs text-muted-foreground">{t.keepCopy}</Text>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-foreground">{value}</Text>
    </View>
  );
}
