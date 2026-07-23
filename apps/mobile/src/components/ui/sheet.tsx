import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { Button } from "./button";

/**
 * BottomSheet (design handoff, mobile) — the modal surface. Ink scrim (dismiss on
 * tap), slides up, 18px top corners, grab handle, serif title.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-neutral-900/55" onPress={onClose}>
        <Pressable
          className="gap-4 rounded-t-[18px] bg-card px-6 pb-8 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="h-1 w-10 self-center rounded-full bg-sand-400" />
          {title ? <Text className="font-display text-title text-neutral-900">{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Destructive confirm — repeats the object's NAME (design handoff). */
export function ConfirmDialog({
  visible,
  title,
  objectName,
  message,
  confirmLabel = "Delete",
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  objectName?: string;
  message?: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onCancel} title={title}>
      <Text className="font-sans text-sm text-neutral-600">
        {message ?? "This action can’t be undone."}
        {objectName ? (
          <Text className="font-sans font-semibold text-neutral-900"> {objectName}</Text>
        ) : null}
      </Text>
      <View className="flex-row justify-end gap-2">
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
        <Button label={confirmLabel} variant="destructive" loading={busy} onPress={onConfirm} />
      </View>
    </BottomSheet>
  );
}
