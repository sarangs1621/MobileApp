import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import type { AnnouncementDto, AnnouncementStatusKey } from "@repo/types";
import { useRouter } from "expo-router";
import { Megaphone, Paperclip, Plus } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import {
  formatDate,
  Loading,
  SCOPE_LABEL,
  STATUS_LABEL,
} from "../../../components/announcements-ui";
import { Header } from "../../../components/behaviour-ui";
import { Button, SegmentedControl, StatusChip } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/**
 * Announcements feed (M11, ADR-019 Step 6). Everyone sees the PUBLISHED feed
 * (targeting resolved server-side). Authors (admin manage / teacher draft) get a
 * Drafts tab + a New button. Tapping a row opens its detail. Pull to refresh.
 */
export default function AnnouncementsScreen() {
  const { dict } = useTranslation();
  const t = dict.announcements;
  const router = useRouter();
  const role = trpc.auth.me.useQuery().data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.ANNOUNCEMENT_MANAGE);
  const canDraft = role !== undefined && can(role, PERMISSIONS.ANNOUNCEMENT_DRAFT);
  const isAuthor = canManage || canDraft;

  const [tab, setTab] = useState<AnnouncementStatusKey>("PUBLISHED");
  const list = trpc.announcement.list.useQuery({ status: tab });
  const rows = list.data ?? [];

  return (
    <View className="flex-1 bg-neutral-50">
      <Header
        title={t.title}
        onBack={() => router.back()}
        action={
          isAuthor ? (
            <Button
              size="sm"
              Icon={Plus}
              label={t.new}
              onPress={() => router.push("/announcements/new")}
            />
          ) : undefined
        }
      />

      {isAuthor ? (
        <View className="px-4 pt-3">
          <SegmentedControl
            options={[
              { key: "PUBLISHED", label: STATUS_LABEL.PUBLISHED },
              { key: "DRAFT", label: STATUS_LABEL.DRAFT },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      ) : null}

      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(a) => a.id}
          contentContainerClassName="p-4 gap-3"
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
          }
          ListEmptyComponent={
            <Text className="font-sans text-neutral-500">
              {tab === "DRAFT" ? t.noDrafts : t.noAnnouncements}
            </Text>
          }
          renderItem={({ item }) => (
            <Row
              item={item}
              showStatus={isAuthor}
              onOpen={() => router.push(`/announcements/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function Row({
  item,
  showStatus,
  onOpen,
}: {
  item: AnnouncementDto;
  showStatus: boolean;
  onOpen: () => void;
}) {
  const when = item.publishedAt ?? item.createdAt;
  const published = item.status === "PUBLISHED";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      className="flex-row items-start gap-3 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50"
    >
      <View
        className={`size-10 items-center justify-center rounded-xl ${
          published ? "bg-primary-50" : "bg-neutral-100"
        }`}
      >
        <Megaphone
          size={19}
          color={published ? "#7A3414" : "#6E6052"}
          weight={published ? "bold" : "regular"}
        />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
            {item.title}
          </Text>
          {item.attachments.length > 0 ? (
            <Paperclip size={14} color="#948676" weight="bold" />
          ) : null}
          {showStatus ? (
            <StatusChip status={item.status} label={STATUS_LABEL[item.status]} dot />
          ) : null}
        </View>
        <Text className="font-sans text-sm text-neutral-700" numberOfLines={2}>
          {item.body}
        </Text>
        <Text className="font-sans text-caption text-neutral-500">
          {SCOPE_LABEL[item.scope]} · {formatDate(when)}
        </Text>
      </View>
    </Pressable>
  );
}
