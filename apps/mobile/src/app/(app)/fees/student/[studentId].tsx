import { useTranslation } from "@repo/i18n";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { Header, Loading } from "../../../../components/behaviour-ui";
import { formatPaise, InvoiceStatusText } from "../../../../components/fees-ui";
import { trpc } from "../../../../lib/trpc";

/**
 * A student's fee ledger (M13 Step 6) — outstanding dues total + every invoice. The
 * service scopes the rows (admin all; teacher own-section; parent own-child). Tap an
 * invoice for its detail, receipts, and (admin) quick payment entry.
 */
export default function StudentFeesScreen() {
  const { dict } = useTranslation();
  const t = dict.fees;
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const enabled = !!studentId;

  const list = trpc.fee.listInvoicesByStudent.useQuery({ studentId: studentId ?? "" }, { enabled });
  const rows = list.data ?? [];
  // Outstanding = unpaid balance across live (non-cancelled) invoices.
  const outstanding = rows
    .filter((i) => i.status !== "CANCELLED")
    .reduce((sum, i) => sum + i.balanceAmount, 0);

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title={t.title} onBack={() => router.back()} />
      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          contentContainerClassName="p-4 gap-3"
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
          }
          ListHeaderComponent={
            <View className="mb-1 gap-1 rounded-card border border-subtle bg-card p-4 shadow-sm">
              <Text className="font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
                {t.outstandingDues}
              </Text>
              <Text className="font-display text-display text-neutral-900">
                {formatPaise(outstanding)}
              </Text>
            </View>
          }
          ListEmptyComponent={<Text className="font-sans text-neutral-500">{t.noInvoices}</Text>}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/fees/invoices/[id]", params: { id: item.id } }} asChild>
              <Pressable
                accessibilityRole="button"
                className="gap-1.5 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
                    {item.invoiceNumber}
                  </Text>
                  <InvoiceStatusText status={item.status} />
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-sans text-sm text-neutral-500">
                    {t.due} {item.dueDate}
                  </Text>
                  <Text className="font-sans text-sm font-semibold text-neutral-900">
                    {formatPaise(item.balanceAmount)} {t.dueSuffix}
                  </Text>
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
