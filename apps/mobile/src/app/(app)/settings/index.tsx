import { PERMISSIONS } from "@repo/constants";
import type { LocaleCode } from "@repo/constants";
import { can } from "@repo/core";
import { Buildings, GlobeHemisphereEast, Storefront } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import {
  Banner,
  Button,
  SectionCard,
  SegmentedControl,
  ScreenScaffold,
  Skeleton,
  useToast,
} from "../../../components/ui";
import { trpc } from "../../../lib/trpc";
import { useAuthStore, type PushRegistrationStatus } from "../../../stores/auth-store";

/**
 * School configuration (M16 Step 6, ADR-024; design handoff §Administration).
 * Everyone sees the branding + current app preferences (read-only). Admins
 * (settings:manage) edit the two phone-relevant defaults — theme + language —
 * inline. School profile / academic / numbering are shown READ-ONLY with a
 * pointer to the web admin console (the mobile-is-lighter precedent — no heavy
 * admin forms on the phone).
 */
type ThemeValue = "light" | "dark" | "system";
const THEMES: { key: ThemeValue; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
];
const LANGUAGES: { key: LocaleCode; label: string }[] = [
  { key: "en", label: "English" },
  { key: "ml", label: "Malayalam" },
];

export default function SettingsScreen() {
  const { show } = useToast();
  const role = trpc.auth.me.useQuery().data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.SETTINGS_MANAGE);

  const pub = trpc.settings.getPublic.useQuery();
  const school = trpc.settings.get.useQuery(undefined, { enabled: canManage });
  const utils = trpc.useUtils();
  const save = trpc.configuration.update.useMutation({
    onSuccess: () => {
      show("success", "Preferences saved");
      return utils.settings.getPublic.invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const [theme, setTheme] = useState<ThemeValue | null>(null);
  const [language, setLanguage] = useState<LocaleCode | null>(null);

  // Prefill the editors once the current values load (theme is a known enum in the DB).
  useEffect(() => {
    if (pub.data) {
      setTheme((t) => t ?? (pub.data.theme as ThemeValue));
      setLanguage((l) => l ?? pub.data.language);
    }
  }, [pub.data]);

  if (pub.isLoading || !pub.data) {
    return (
      <ScreenScaffold
        title={canManage ? "Administration" : "Settings"}
        subtitle="School configuration"
      >
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </ScreenScaffold>
    );
  }

  const dirty = theme !== pub.data.theme || language !== pub.data.language;
  const themeValue = theme ?? (pub.data.theme as ThemeValue);
  const languageValue = language ?? pub.data.language;

  return (
    <ScreenScaffold
      title={canManage ? "Administration" : "Settings"}
      subtitle="School configuration"
    >
      <SectionCard Icon={Buildings} tint="gold" title="School">
        <ReadRow label="Name" value={pub.data.branding.displayName ?? "—"} />
      </SectionCard>

      <PushStatusNote />

      <SectionCard
        Icon={GlobeHemisphereEast}
        tint="cream"
        title="App preferences"
        subtitle="Theme and language"
      >
        <View className="gap-1.5">
          <Text className="font-sans text-sm font-semibold text-neutral-900">Theme</Text>
          {canManage ? (
            <SegmentedControl options={THEMES} value={themeValue} onChange={setTheme} />
          ) : (
            <Text className="font-sans text-body text-neutral-800">
              {label(THEMES, themeValue)}
            </Text>
          )}
        </View>
        <View className="gap-1.5">
          <Text className="font-sans text-sm font-semibold text-neutral-900">Language</Text>
          {canManage ? (
            <SegmentedControl options={LANGUAGES} value={languageValue} onChange={setLanguage} />
          ) : (
            <Text className="font-sans text-body text-neutral-800">
              {label(LANGUAGES, languageValue)}
            </Text>
          )}
        </View>
        {canManage ? (
          <Button
            label={save.isPending ? "Saving…" : "Save preferences"}
            loading={save.isPending}
            disabled={!dirty}
            onPress={() => {
              if (theme !== null && language !== null) save.mutate({ theme, language });
            }}
          />
        ) : null}
      </SectionCard>

      {canManage ? (
        <SectionCard Icon={Storefront} tint="maroon" title="School profile">
          <ReadRow label="Principal" value={school.data?.principalName ?? "—"} />
          <ReadRow label="Contact email" value={school.data?.contactEmail ?? "—"} />
          <ReadRow label="Contact phone" value={school.data?.contactPhone ?? "—"} />
          <ReadRow
            label="Invoice / certificate prefix"
            value={`${school.data?.invoicePrefix ?? "—"} / ${school.data?.certificatePrefix ?? "—"}`}
          />
          <Text className="font-sans text-caption text-neutral-400">
            Edit the school profile, academic defaults and numbering on the web admin console.
          </Text>
        </SectionCard>
      ) : null}
    </ScreenScaffold>
  );
}

const PUSH_STATUS_WARNINGS: Partial<Record<PushRegistrationStatus, string>> = {
  "no-project-id":
    "Push notifications are NOT active: this build has no EAS projectId (app.json → extra.eas.projectId). In-app notifications still work; see docs/DEPLOYMENT.md go-live steps.",
  "permission-denied":
    "Push notifications are off: notification permission was denied for this app. Enable it in system settings to receive alerts.",
  "token-error":
    "Push notifications are NOT active: this device could not get a push token (see app logs).",
  "expo-go":
    "Push notifications are NOT active in Expo Go (removed in SDK 53). Use a development build to test push.",
};

/** Visible diagnostic when push registration was skipped — otherwise a half-configured
 *  deployment looks "done" while delivering nothing (Phase 1 go-live check). */
function PushStatusNote() {
  const pushStatus = useAuthStore((s) => s.pushStatus);
  const warning = PUSH_STATUS_WARNINGS[pushStatus];
  if (!warning) {
    return null;
  }
  return <Banner tone="warning">{warning}</Banner>;
}

function label<T extends string>(options: { key: T; label: string }[], value: T): string {
  return options.find((o) => o.key === value)?.label ?? value;
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-sans text-caption text-neutral-500">{label}</Text>
      <Text className="font-sans text-body text-neutral-900">{value}</Text>
    </View>
  );
}
