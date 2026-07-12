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
    <View className="flex-1 bg-background">
      <Header title="Fees" onBack={() => router.back()} />
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
            <View className="mb-1 gap-1 rounded-md border border-border bg-card p-4">
              <Text className="text-sm text-muted-foreground">Outstanding dues</Text>
              <Text className="text-2xl font-semibold text-foreground">
                {formatPaise(outstanding)}
              </Text>
            </View>
          }
          ListEmptyComponent={<Text className="text-muted-foreground">No invoices yet.</Text>}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/fees/invoices/[id]", params: { id: item.id } }} asChild>
              <Pressable
                accessibilityRole="button"
                className="gap-1 rounded-md border border-border bg-card p-4"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-medium text-foreground">{item.invoiceNumber}</Text>
                  <InvoiceStatusText status={item.status} />
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-sm text-muted-foreground">Due {item.dueDate}</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {formatPaise(item.balanceAmount)} due
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
