import { StatusBar } from "expo-status-bar";
import { Image, Text, View } from "react-native";

import crest from "../../assets/crest-cream.png";

/**
 * Branded splash / loading screen (design handoff, mobile) — the maroon hero
 * with the cream crest, serif school name, gold "Est. 1869" eyebrow and the
 * Sanskrit motto. Shown while fonts load and the session is being restored,
 * replacing the bare ActivityIndicator gates. (`neutral-50` is the cream tone.)
 */
export function Splash() {
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-primary-950">
      <StatusBar style="light" />
      <Image source={crest} className="size-28" resizeMode="contain" />
      <View className="items-center gap-1.5">
        <Text className="text-center font-display text-display leading-tight text-neutral-50">
          Sri Gujarati{"\n"}Vidyalaya
        </Text>
        <Text className="font-sans text-eyebrow font-semibold uppercase tracking-eyebrow text-gold-400">
          Est. 1869
        </Text>
      </View>
      <Text className="absolute bottom-16 font-display text-sm italic text-neutral-50/60">
        विद्या विनयेन शोभते
      </Text>
    </View>
  );
}
