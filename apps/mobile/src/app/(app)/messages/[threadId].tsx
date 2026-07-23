import { useTranslation } from "@repo/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, PaperPlaneTilt } from "phosphor-react-native";
import { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "../../../lib/trpc";

/**
 * A conversation (M18). Messages arrive newest-first from the server; the inverted
 * FlatList renders them newest-at-bottom. The other party's unread messages are
 * flipped read on mount. Header labels come from the list row's nav params — a deep
 * link falls back to a generic title.
 */
export default function ConversationScreen() {
  const { dict } = useTranslation();
  const t = dict.messages;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { threadId, name, student } = useLocalSearchParams<{
    threadId: string;
    name?: string;
    student?: string;
  }>();
  const myUserId = trpc.auth.me.useQuery().data?.userId;
  const utils = trpc.useUtils();

  // Modest poll so the counterparty's reply appears while the conversation is open.
  const query = trpc.message.threadMessages.useQuery(
    { threadId },
    { enabled: !!threadId, refetchInterval: 15_000 },
  );
  const messages = query.data?.items ?? []; // newest-first, matches inverted list

  // Flip incoming messages to read whenever a NEW one arrives (poll), not just on
  // mount — keeps the home/list unread badges honest while the thread is open.
  const latestIncomingId = messages.find((m) => m.senderUserId !== myUserId)?.id;
  const markRead = trpc.message.markRead.useMutation({
    onSuccess: () => void utils.message.unreadCount.invalidate(),
  });
  useEffect(() => {
    if (threadId) markRead.mutate({ threadId });
  }, [threadId, latestIncomingId]);

  const [body, setBody] = useState("");
  const send = trpc.message.send.useMutation({
    onSuccess: () => {
      setBody("");
      void utils.message.threadMessages.invalidate({ threadId });
      void utils.message.listThreads.invalidate();
    },
  });

  const submit = () => {
    const trimmed = body.trim();
    if (trimmed.length === 0 || send.isPending) return;
    send.mutate({ threadId, body: trimmed });
  };

  const canSend = body.trim().length > 0 && !send.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-neutral-50"
    >
      <View
        style={{ paddingTop: insets.top + 12 }}
        className="border-b border-subtle bg-white px-3 pb-3"
      >
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.goBack}
            onPress={() => router.back()}
            className="size-11 items-center justify-center rounded-xl active:bg-primary-50"
          >
            <CaretLeft size={22} color="#44382C" weight="bold" />
          </Pressable>
          <Text className="flex-1 font-display text-title text-neutral-900" numberOfLines={1}>
            {name || t.conversation}
          </Text>
        </View>
        {student ? (
          <Text className="ml-[52px] font-sans text-caption text-neutral-500">
            {t.about(student)}
          </Text>
        ) : null}
      </View>

      <FlatList
        inverted
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4 gap-2"
        ListEmptyComponent={
          query.isLoading ? null : (
            <Text className="font-sans text-neutral-500">{t.noMessages}</Text>
          )
        }
        renderItem={({ item }) => {
          const mine = item.senderUserId === myUserId;
          return (
            <View className={mine ? "items-end" : "items-start"}>
              <View
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  mine ? "bg-primary-600" : "border border-subtle bg-white"
                }`}
              >
                <Text className={`font-sans ${mine ? "text-neutral-50" : "text-neutral-900"}`}>
                  {item.body}
                </Text>
                <Text
                  className={`mt-1 font-sans text-caption ${
                    mine ? "text-neutral-50/70" : "text-neutral-400"
                  }`}
                >
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="flex-row items-end gap-2 border-t border-subtle bg-white px-3 pt-3"
      >
        <TextInput
          className="min-h-11 flex-1 rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900"
          value={body}
          placeholder={t.writeMessage}
          placeholderTextColor="#948676"
          accessibilityLabel={t.writeMessage}
          multiline
          onChangeText={setBody}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.send}
          disabled={!canSend}
          onPress={submit}
          className={`size-11 items-center justify-center rounded-full ${
            canSend ? "bg-primary-600" : "bg-neutral-200"
          }`}
        >
          <PaperPlaneTilt size={18} color={canSend ? "#FCF9F3" : "#948676"} weight="fill" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
