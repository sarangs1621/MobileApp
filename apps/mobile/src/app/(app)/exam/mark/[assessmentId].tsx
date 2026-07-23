import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ScreenScaffold } from "../../../../components/attendance-ui";
import { trpc } from "../../../../lib/trpc";

type Entry = { theory: string; practical: string; isAbsent: boolean };
const blank: Entry = { theory: "", practical: "", isAbsent: false };
const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Teacher mark entry for one (assessment × section) register (M5). Draft-only:
 * per-student theory/practical inputs + an Absent toggle; Save upserts (creating
 * the register on first save), then Submit hands it to admin review. A SUBMITTED/
 * LOCKED register is read-only (corrections are an admin unlock on web).
 */
export default function MarkEntryScreen() {
  const params = useLocalSearchParams<{ assessmentId: string; sectionId: string }>();
  const assessmentId = params.assessmentId ?? "";
  const sectionId = params.sectionId ?? "";
  const utils = trpc.useUtils();

  const years = trpc.academicYear.list.useQuery();
  const activeYearId = (years.data ?? []).find((y) => y.status === "ACTIVE")?.id;

  const markable = trpc.mark.markable.useQuery();
  const target = (markable.data ?? []).find(
    (m) => m.assessmentId === assessmentId && m.sectionId === sectionId,
  );

  const roster = trpc.enrollment.sectionRoster.useQuery(
    { academicYearId: activeYearId ?? "", sectionId },
    { enabled: activeYearId !== undefined && sectionId !== "" },
  );
  const students = trpc.student.list.useQuery();
  const studentName = new Map(
    (students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
  );

  const existing = trpc.mark.listByRegister.useQuery(
    { examSectionId: target?.examSectionId ?? "" },
    { enabled: target?.examSectionId != null },
  );
  const existingByEnrollment = new Map((existing.data ?? []).map((m) => [m.enrollmentId, m]));

  const [edits, setEdits] = useState<Record<string, Entry>>({});

  const save = trpc.mark.save.useMutation({
    onSuccess: () => {
      setEdits({});
      void utils.mark.markable.invalidate();
      void utils.mark.listByRegister.invalidate();
    },
  });
  const submit = trpc.mark.submit.useMutation({
    onSuccess: () => {
      void utils.mark.markable.invalidate();
    },
  });

  if (years.isLoading || roster.isLoading || markable.isLoading) {
    return (
      <ScreenScaffold title="Enter marks">
        <ActivityIndicator color="#7A3414" />
      </ScreenScaffold>
    );
  }
  if (activeYearId === undefined || target === undefined) {
    return (
      <ScreenScaffold title="Enter marks">
        <Text className="font-sans text-neutral-500">
          This assessment is not available for marking.
        </Text>
      </ScreenScaffold>
    );
  }

  const status = target.registerStatus;
  const editable = status === "NONE" || status === "DRAFT";
  const hasPractical = target.maxPractical != null;
  const rows = roster.data ?? [];

  const current = (enrollmentId: string): Entry => {
    if (edits[enrollmentId]) return edits[enrollmentId];
    const m = existingByEnrollment.get(enrollmentId);
    if (!m) return blank;
    return {
      theory: m.theoryObtained != null ? String(m.theoryObtained) : "",
      practical: m.practicalObtained != null ? String(m.practicalObtained) : "",
      isAbsent: m.isAbsent,
    };
  };
  const setEntry = (enrollmentId: string, patch: Partial<Entry>) => {
    setEdits((prev) => ({ ...prev, [enrollmentId]: { ...current(enrollmentId), ...patch } }));
  };

  return (
    <ScreenScaffold title="Enter marks">
      <Text className="font-sans text-sm text-neutral-700">
        {target.examName} · {target.subjectName} · Sec {target.sectionName} ·{" "}
        {status === "NONE" ? "Not started" : status}
      </Text>
      <Text className="font-sans text-caption text-neutral-400">
        Max theory {target.maxTheory}
        {hasPractical ? ` · practical ${target.maxPractical}` : " · theory only"}
      </Text>

      {rows.length === 0 ? (
        <Text className="font-sans text-neutral-500">No active students in this section.</Text>
      ) : (
        rows.map((e) => {
          const v = current(e.id);
          return (
            <View
              key={e.id}
              className="gap-2 rounded-card border border-subtle bg-card p-4 shadow-sm"
            >
              <Text className="font-sans text-body font-semibold text-neutral-900">
                {studentName.get(e.studentId) ?? e.studentId}
                {e.rollNo != null ? ` · Roll ${e.rollNo}` : ""}
              </Text>
              {editable ? (
                <View className="flex-row items-center gap-2.5">
                  <TextInput
                    editable={!v.isAbsent}
                    keyboardType="numeric"
                    value={v.theory}
                    placeholder="Theory"
                    placeholderTextColor="#948676"
                    onChangeText={(t) => setEntry(e.id, { theory: t })}
                    className="min-h-11 flex-1 rounded-[10px] border border-subtle bg-white px-3 font-sans text-body text-neutral-900"
                  />
                  {hasPractical ? (
                    <TextInput
                      editable={!v.isAbsent}
                      keyboardType="numeric"
                      value={v.practical}
                      placeholder="Practical"
                      placeholderTextColor="#948676"
                      onChangeText={(t) => setEntry(e.id, { practical: t })}
                      className="min-h-11 flex-1 rounded-[10px] border border-subtle bg-white px-3 font-sans text-body text-neutral-900"
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEntry(e.id, { isAbsent: !v.isAbsent })}
                    className={`min-h-11 justify-center rounded-pill border px-3.5 ${
                      v.isAbsent ? "border-danger-600 bg-danger-100" : "border-subtle bg-white"
                    }`}
                  >
                    <Text
                      className={`font-sans text-sm font-semibold ${
                        v.isAbsent ? "text-danger-700" : "text-neutral-500"
                      }`}
                    >
                      Absent
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text className="font-sans text-sm text-neutral-500">
                  {v.isAbsent
                    ? "Absent"
                    : `Theory ${v.theory || "—"}${hasPractical ? ` · Practical ${v.practical || "—"}` : ""}`}
                </Text>
              )}
            </View>
          );
        })
      )}

      {editable && rows.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={save.isPending}
            onPress={() => {
              save.mutate({
                assessmentId,
                sectionId,
                marks: rows.map((e) => {
                  const v = current(e.id);
                  return {
                    enrollmentId: e.id,
                    isAbsent: v.isAbsent,
                    theoryObtained: v.isAbsent ? null : parseNum(v.theory),
                    practicalObtained: v.isAbsent || !hasPractical ? null : parseNum(v.practical),
                  };
                }),
              });
            }}
            className="min-h-12 items-center justify-center rounded-pill bg-primary-600 px-4 active:bg-primary-700"
          >
            <Text className="font-sans font-semibold text-neutral-50">Save draft</Text>
          </Pressable>
          {target.examSectionId != null && status === "DRAFT" ? (
            <Pressable
              accessibilityRole="button"
              disabled={submit.isPending}
              onPress={() => {
                if (target.examSectionId != null) {
                  submit.mutate({ examSectionId: target.examSectionId });
                }
              }}
              className="min-h-12 items-center justify-center rounded-pill border border-strong bg-white px-4 active:bg-primary-50"
            >
              <Text className="font-sans font-semibold text-primary-700">Submit for review</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {save.isError ? (
        <Text className="font-sans text-sm text-danger-600">{save.error.message}</Text>
      ) : null}
      {submit.isError ? (
        <Text className="font-sans text-sm text-danger-600">{submit.error.message}</Text>
      ) : null}
    </ScreenScaffold>
  );
}
