"use client";

import {
  Buildings,
  ClockCounterClockwise,
  CloudArrowUp,
  DownloadSimple,
  GlobeHemisphereEast,
  Image as ImageIcon,
  PaintBrushBroad,
} from "@phosphor-icons/react";
import { PERMISSIONS, STORAGE_BUCKETS } from "@repo/constants";
import { can } from "@repo/core";
import type { BrandingDto, SchoolSettingsDto, SystemSettingsDto } from "@repo/types";
import { cn } from "@repo/ui";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { downloadCsv } from "@/src/components/analytics/csv";
import { Button, Input, PageHeader, Select, useToast } from "@/src/components/ui";
import { getSupabaseClient } from "@/src/lib/supabase/client";
import { trpc } from "@/src/trpc/react";

/**
 * School Administration & Configuration console (M16, ADR-024 Step 7; design
 * handoff §Administration). Admins (settings:manage) edit branding (+ logo
 * upload), school profile, numbering, academic + system defaults (timezone/
 * language/theme/working week), and export the current configuration as CSV.
 * Non-admins get a read-only view of the public settings. Thin client over the
 * tRPC surface; the service is the authority.
 *
 * Configuration influences only FUTURE actions and is read by no frozen engine in v1
 * (ADR-024 §5) — numbering/timezone/academic values are stored, not yet wired.
 */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
// Heritage-friendly presets; a native colour input keeps arbitrary hex possible.
const PRIMARY_SWATCHES = ["#7A3414", "#5C2810", "#1F4B3F", "#27364B"];
const ACCENT_SWATCHES = ["#C29A45", "#8A6A2F", "#A65E2E", "#4E7A6A"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "UTC"];
const tzLabel = (tz: string) => (tz === "Asia/Kolkata" ? "Asia/Kolkata (IST)" : tz);

export default function SettingsPage() {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  if (role === undefined) {
    return <p className="p-6 text-ink-500">Loading…</p>;
  }
  return can(role, PERMISSIONS.SETTINGS_MANAGE) ? <AdminConsole /> : <ReadOnlySettings />;
}

/** Section card with a tinted icon header (design handoff). */
function SectionCard({
  icon: Icon,
  tint,
  title,
  subtitle,
  children,
}: {
  icon: ComponentType<{ className?: string; size?: number; weight?: "bold" }>;
  tint: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-subtle bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-cream-100 px-6 py-[18px]">
        <span className={cn("flex size-[38px] items-center justify-center rounded-xl", tint)}>
          <Icon aria-hidden size={19} weight="bold" />
        </span>
        <span className="flex flex-col gap-px">
          <span className="font-display text-lg font-semibold text-ink-900">{title}</span>
          <span className="text-[12.5px] text-ink-500">{subtitle}</span>
        </span>
      </div>
      <div className="flex flex-col gap-[18px] px-6 py-5">{children}</div>
    </section>
  );
}

function AdminConsole() {
  const utils = trpc.useUtils();
  const branding = trpc.branding.get.useQuery();
  const school = trpc.settings.get.useQuery();
  const system = trpc.configuration.get.useQuery();

  return (
    <main className="mx-auto flex min-h-screen max-w-[900px] flex-col gap-5 px-9 py-7">
      <PageHeader
        eyebrow="School configuration"
        title="Administration"
        subtitle="Branding, school profile and system defaults. Every change is written to the audit log."
        action={
          branding.data && school.data && system.data ? (
            <ExportButton branding={branding.data} school={school.data} system={system.data} />
          ) : undefined
        }
      />

      {branding.data ? <BrandingForm current={branding.data} utils={utils} /> : null}
      {school.data ? <SchoolForm current={school.data} utils={utils} /> : null}
      {system.data ? <SystemForm current={system.data} utils={utils} /> : null}

      {/* Audit note */}
      <section className="flex items-start gap-3.5 rounded-card border border-subtle bg-cream-100 px-6 py-[18px]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-white text-maroon-700">
          <ClockCounterClockwise aria-hidden size={18} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-base font-semibold text-ink-900">
            Configuration history &amp; audit
          </span>
          <span className="text-[13px] leading-relaxed text-ink-500">
            Every change on this page is written to the audit log with who changed what, and when. A
            browsable audit viewer is planned — no audit-read surface exists yet (deferred,
            ADR-024).
          </span>
        </span>
      </section>
    </main>
  );
}

type Utils = ReturnType<typeof trpc.useUtils>;

/** Preset swatches + a custom native colour input (keeps arbitrary hex). */
function SwatchRow({
  value,
  presets,
  onChange,
}: {
  value: string;
  presets: string[];
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Use ${c}`}
            aria-pressed={active}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={cn(
              "size-10 cursor-pointer rounded-xl border-2 transition-transform duration-fast hover:scale-105",
              active ? "border-ink-900 ring-2 ring-inset ring-white" : "border-subtle",
            )}
          />
        );
      })}
      <label
        title="Custom colour"
        className="flex size-10 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-strong text-ink-400 transition-colors duration-fast hover:border-maroon-300 hover:text-maroon-700"
      >
        <PaintBrushBroad aria-hidden size={16} />
        <input
          type="color"
          aria-label="Custom colour"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </label>
      <span className="ml-1 font-mono text-[12.5px] uppercase text-ink-500">{value}</span>
    </div>
  );
}

function BrandingForm({ current, utils }: { current: BrandingDto; utils: Utils }) {
  const { show } = useToast();
  const [displayName, setDisplayName] = useState(current.displayName ?? "");
  const [primaryColor, setPrimaryColor] = useState(current.primaryColor ?? "#7A3414");
  const [secondaryColor, setSecondaryColor] = useState(current.secondaryColor ?? "#C29A45");
  const [logoPath, setLogoPath] = useState<string | null>(current.logoPath);
  const [busy, setBusy] = useState(false);
  const logoUrl = trpc.branding.logoUrl.useMutation();

  const mintLogo = trpc.branding.logoUploadUrl.useMutation();
  const save = trpc.branding.update.useMutation({
    onSuccess: () => {
      show("success", "Branding saved");
      return utils.branding.get.invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  // Show the current logo without a click (read-only signed-URL mint).
  const mintPreview = logoUrl.mutate;
  useEffect(() => {
    if (logoPath) mintPreview();
  }, [logoPath, mintPreview]);

  async function onLogo(file: File) {
    setBusy(true);
    try {
      const minted = await mintLogo.mutateAsync({ fileName: file.name });
      const { error } = await getSupabaseClient()
        .storage.from(STORAGE_BUCKETS.BRANDING)
        .uploadToSignedUrl(minted.storagePath, minted.token, file);
      if (error) throw error;
      setLogoPath(minted.storagePath);
      await save.mutateAsync({ logoPath: minted.storagePath });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={PaintBrushBroad}
      tint="bg-maroon-50 text-maroon-700"
      title="Branding"
      subtitle="Shown on the portal, certificates and receipts"
    >
      <Input
        label="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="School name shown in the app"
      />
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink-900">Primary colour</span>
          <SwatchRow value={primaryColor} presets={PRIMARY_SWATCHES} onChange={setPrimaryColor} />
        </div>
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink-900">Accent colour</span>
          <SwatchRow
            value={secondaryColor}
            presets={ACCENT_SWATCHES}
            onChange={setSecondaryColor}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-[240px] flex-1 flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink-900">Logo</span>
          <label
            className={cn(
              "flex items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-strong px-4 py-3.5 transition-colors duration-fast",
              busy
                ? "cursor-wait opacity-60"
                : "cursor-pointer hover:border-maroon-300 hover:bg-cream-50",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-700">
              <CloudArrowUp aria-hidden size={18} />
            </span>
            <span className="flex flex-col gap-px">
              <span className="text-[13px] font-semibold text-maroon-700">
                {busy ? "Uploading…" : "Choose a file or drag it here"}
              </span>
              <span className="text-[11.5px] text-ink-400">PNG or SVG · square works best</span>
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onLogo(f);
              }}
            />
          </label>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Current
          </span>
          <span className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-maroon-950 text-cream-50/60">
            {logoPath && logoUrl.data ? (
              <img src={logoUrl.data.url} alt="School logo" className="size-11 object-contain" />
            ) : (
              <ImageIcon aria-hidden size={22} />
            )}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              displayName: displayName.trim() || null,
              primaryColor,
              secondaryColor,
            })
          }
        >
          Save branding
        </Button>
      </div>
    </SectionCard>
  );
}

function SchoolForm({ current, utils }: { current: SchoolSettingsDto; utils: Utils }) {
  const { show } = useToast();
  const [f, setF] = useState({
    contactEmail: current.contactEmail ?? "",
    contactPhone: current.contactPhone ?? "",
    website: current.website ?? "",
    principalName: current.principalName ?? "",
    invoicePrefix: current.invoicePrefix ?? "",
    certificatePrefix: current.certificatePrefix ?? "",
  });
  // 1–12, or null when unset. Rendered as month pills.
  const [startMonth, setStartMonth] = useState<number | null>(current.academicYearStartMonth);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const save = trpc.settings.update.useMutation({
    onSuccess: () => {
      show("success", "School settings saved");
      return utils.settings.get.invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  return (
    <SectionCard
      icon={Buildings}
      tint="bg-gold-100 text-gold-700"
      title="School profile & numbering"
      subtitle="Used on certificates, receipts and parent communication"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Principal name"
          value={f.principalName}
          onChange={set("principalName")}
          placeholder="Dr. R. Nair"
        />
        <Input
          label="Contact email"
          type="email"
          value={f.contactEmail}
          onChange={set("contactEmail")}
          placeholder="office@school.example"
        />
        <Input
          label="Contact phone"
          value={f.contactPhone}
          onChange={set("contactPhone")}
          placeholder="+91 495 000 0000"
        />
        <Input
          label="Website"
          value={f.website}
          onChange={set("website")}
          placeholder="school.example"
        />
        <Input
          label="Invoice number prefix"
          value={f.invoicePrefix}
          onChange={set("invoicePrefix")}
          placeholder="INV-"
          helper="e.g. INV-2026-000001"
        />
        <Input
          label="Certificate number prefix"
          value={f.certificatePrefix}
          onChange={set("certificatePrefix")}
          placeholder="DOC-"
          helper="e.g. DOC-2026-000001"
        />
      </div>

      <div className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink-900">Academic year starts in</span>
        <div className="flex flex-wrap gap-1.5">
          {MONTHS_SHORT.map((m, i) => {
            const month = i + 1;
            const active = startMonth === month;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setStartMonth(active ? null : month)}
                className={cn(
                  "cursor-pointer rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors duration-fast",
                  active
                    ? "border-maroon-700 bg-maroon-700 text-cream-50"
                    : "border-subtle bg-white text-ink-500 hover:border-strong",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        <span className="text-[12px] text-ink-400">
          Kerala schools typically start in June. Stored but applied to future invoices and
          certificates only (ADR-024 §5).
        </span>
      </div>

      <div className="flex justify-end">
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              contactEmail: f.contactEmail.trim() || null,
              contactPhone: f.contactPhone.trim() || null,
              website: f.website.trim() || null,
              principalName: f.principalName.trim() || null,
              invoicePrefix: f.invoicePrefix.trim() || null,
              certificatePrefix: f.certificatePrefix.trim() || null,
              academicYearStartMonth: startMonth,
            })
          }
        >
          Save school settings
        </Button>
      </div>
    </SectionCard>
  );
}

function SystemForm({ current, utils }: { current: SystemSettingsDto; utils: Utils }) {
  const { show } = useToast();
  const [timezone, setTimezone] = useState(current.timezone);
  const [language, setLanguage] = useState<"en" | "ml">(current.language);
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    (current.theme as "light" | "dark" | "system") ?? "light",
  );
  const [workingDays, setWorkingDays] = useState<number[]>(current.workingDays);
  const save = trpc.configuration.update.useMutation({
    onSuccess: () => {
      show("success", "System settings saved");
      return utils.configuration.get.invalidate();
    },
    onError: (e) => show("error", e.message),
  });

  const toggleDay = (d: number) =>
    setWorkingDays((p) =>
      p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b),
    );

  // Keep the stored timezone selectable even if it's outside the presets.
  const tzOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  return (
    <SectionCard
      icon={GlobeHemisphereEast}
      tint="bg-cream-100 text-ink-700"
      title="System & localization"
      subtitle="Timezone, language and the working week"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {tzOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tzLabel(tz)}
            </option>
          ))}
        </Select>
        <Select
          label="Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as "en" | "ml")}
        >
          <option value="en">English</option>
          <option value="ml">Malayalam</option>
        </Select>
        <Select
          label="Theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">Follow system</option>
        </Select>
      </div>

      <div className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink-900">Working week</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const on = workingDays.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(i)}
                className={cn(
                  "min-w-[52px] cursor-pointer rounded-full border px-0 py-2.5 text-[12.5px] font-bold transition-colors duration-fast",
                  on
                    ? "border-maroon-700 bg-maroon-700 text-cream-50"
                    : "border-subtle bg-white text-ink-500 hover:border-strong",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
        <span className="text-[12px] text-ink-400">
          {workingDays.length}-day week — holidays and attendance percentages follow this.
        </span>
      </div>

      <div className="flex justify-end">
        <Button
          loading={save.isPending}
          onClick={() => save.mutate({ timezone: timezone.trim(), language, theme, workingDays })}
        >
          Save system settings
        </Button>
      </div>
    </SectionCard>
  );
}

function ExportButton({
  branding,
  school,
  system,
}: {
  branding: BrandingDto;
  school: SchoolSettingsDto;
  system: SystemSettingsDto;
}) {
  return (
    <Button
      variant="secondary"
      icon={DownloadSimple}
      onClick={() => {
        const rows: [string, string][] = [
          ["Display name", branding.displayName ?? ""],
          ["Primary colour", branding.primaryColor ?? ""],
          ["Accent colour", branding.secondaryColor ?? ""],
          ["Principal", school.principalName ?? ""],
          ["Contact email", school.contactEmail ?? ""],
          ["Contact phone", school.contactPhone ?? ""],
          ["Website", school.website ?? ""],
          ["Invoice prefix", school.invoicePrefix ?? ""],
          ["Certificate prefix", school.certificatePrefix ?? ""],
          ["Academic year start month", school.academicYearStartMonth?.toString() ?? ""],
          ["Timezone", system.timezone],
          ["Language", system.language],
          ["Theme", system.theme],
          ["Working days", system.workingDays.join(" ")],
        ];
        downloadCsv("school-configuration.csv", ["Setting", "Value"], rows);
      }}
    >
      Export CSV
    </Button>
  );
}

function ReadOnlySettings() {
  const pub = trpc.settings.getPublic.useQuery();
  if (!pub.data) {
    return <p className="p-6 text-ink-500">Loading…</p>;
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-9 py-7">
      <PageHeader eyebrow="School configuration" title="Settings" />
      <SectionCard
        icon={Buildings}
        tint="bg-gold-100 text-gold-700"
        title="School"
        subtitle="Public information for your account"
      >
        <Row label="Name" value={pub.data.branding.displayName ?? "—"} />
        <Row label="Theme" value={pub.data.theme} />
        <Row label="Language" value={pub.data.language} />
      </SectionCard>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-cream-100 py-2.5 text-sm last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  );
}
