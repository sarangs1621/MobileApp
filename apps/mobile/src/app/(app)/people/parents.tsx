import type { PreferredContactKey } from "@repo/types";
import { Text, View } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { Avatar } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

const CONTACT_LABEL: Record<PreferredContactKey, string> = {
  PHONE: "phone",
  EMAIL: "email",
  WHATSAPP: "WhatsApp",
};

/**
 * Read-only parents list (M3 — manage on web). Row scope is applied by the
 * service: admins see all parents; the PARENT role sees only their own record.
 */
export default function ParentsScreen() {
  const parents = trpc.parent.list.useQuery();

  return (
    <AcademicListScreen
      title="Parents"
      isLoading={parents.isLoading}
      isError={parents.isError}
      items={parents.data}
      keyExtractor={(parent) => parent.id}
      emptyText="No parents visible to you."
      renderItem={(parent) => (
        <ListRow>
          <View className="flex-row items-center gap-3">
            <Avatar name={parent.name} />
            <View className="flex-1 gap-0.5">
              <Text className="font-sans text-body font-semibold text-neutral-900">
                {parent.name}
              </Text>
              <Text className="font-sans text-sm text-neutral-500">
                {parent.phone}
                {parent.email ? ` · ${parent.email}` : ""}
              </Text>
              <Text className="font-sans text-caption text-neutral-400">
                {parent.occupation ?? "—"} · Prefers {CONTACT_LABEL[parent.preferredContact]}
              </Text>
            </View>
          </View>
        </ListRow>
      )}
    />
  );
}
