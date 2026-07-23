"use client";

import { GraduationCap, Plus } from "@phosphor-icons/react";
import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { StaffDto } from "@repo/types";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Paginator, usePagedSearch } from "@/src/components/academic/ui";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  SearchInput,
  Skeleton,
  StatusChip,
  useToast,
} from "@/src/components/ui";
import { trpc } from "@/src/trpc/react";

/** "2020-06-01" → "Jun 2020". */
function fmtJoined(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/**
 * Teacher (staff) profiles (M3; design handoff §6 — Teacher profiles tab). A
 * responsive card grid: each card shows the employment profile extending a User
 * (one-to-one; auth stays on User), the class-teacher badge (joined from the
 * active year's class-teacher assignments), and quick links. A TEACHER sees only
 * their own profile (service row scope), with no actions.
 */
export default function TeacherProfilesPage() {
  const me = trpc.auth.me.useQuery();
  const canManage = me.data !== undefined && can(me.data.role, PERMISSIONS.STAFF_MANAGE);
  const canReadSections = me.data !== undefined && can(me.data.role, PERMISSIONS.ACADEMIC_READ);
  const { show } = useToast();

  const profiles = trpc.teacherProfile.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.teacherProfile.list.invalidate();

  // Class-teacher map: active year × sections → userId → section label.
  const years = trpc.academicYear.list.useQuery(undefined, { enabled: canReadSections });
  const activeYearId = years.data?.find((y) => y.status === "ACTIVE")?.id;
  const classes = trpc.class.list.useQuery(undefined, { enabled: canReadSections });
  const sectionLists = trpc.useQueries((t) =>
    canReadSections ? (classes.data ?? []).map((c) => t.section.list({ classId: c.id })) : [],
  );
  const allSections = useMemo(() => {
    const className = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
    return sectionLists.flatMap((q) =>
      (q.data ?? []).map((s) => ({
        id: s.id,
        label: `${className.get(s.classId) ?? ""} ${s.name}`.trim(),
      })),
    );
  }, [classes.data, sectionLists]);
  const classTeacherQueries = trpc.useQueries((t) =>
    activeYearId
      ? allSections.map((s) =>
          t.classTeacher.get({ academicYearId: activeYearId, sectionId: s.id }),
        )
      : [],
  );
  const classTeacherOf = useMemo(() => {
    const map = new Map<string, string>();
    classTeacherQueries.forEach((q, i) => {
      const section = allSections[i];
      const dto = q.data;
      if (section && dto) map.set(dto.teacherId, section.label);
    });
    return map;
  }, [classTeacherQueries, allSections]);

  const create = trpc.teacherProfile.create.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Profile saved");
    },
    onError: (e) => show("error", e.message),
  });
  const update = trpc.teacherProfile.update.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Profile saved");
    },
    onError: (e) => show("error", e.message),
  });
  const remove = trpc.teacherProfile.delete.useMutation({
    onSuccess: () => {
      invalidate();
      show("success", "Profile deleted");
    },
    onError: (e) => show("error", e.message),
  });

  const [editing, setEditing] = useState<StaffDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<StaffDto | null>(null);

  const paged = usePagedSearch(
    profiles.data,
    useCallback(
      (profile: StaffDto, q: string) =>
        profile.name.toLowerCase().includes(q) ||
        profile.employeeId.toLowerCase().includes(q) ||
        (profile.department ?? "").toLowerCase().includes(q),
      [],
    ),
  );

  const openEdit = (p: StaffDto) => {
    create.reset();
    update.reset();
    setEditing(p);
  };

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          placeholder="Search name or employee id…"
          value={paged.query}
          onChange={(e) => paged.setQuery(e.target.value)}
          aria-label="Search teacher profiles"
          className="min-w-[260px]"
        />
        <div className="flex-1" />
        {canManage ? (
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              create.reset();
              update.reset();
              setEditing("new");
            }}
          >
            New profile
          </Button>
        ) : null}
      </div>

      {profiles.isLoading ? (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <Skeleton className="h-52 rounded-card" />
          <Skeleton className="h-52 rounded-card" />
        </div>
      ) : profiles.isError ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <ErrorState onRetry={() => void profiles.refetch()} />
        </div>
      ) : paged.pageItems.length === 0 ? (
        <div className="rounded-card border border-subtle bg-white shadow-sm">
          <EmptyState
            icon={GraduationCap}
            title={paged.total === 0 ? "No teacher profiles yet." : "No profiles match."}
            message={
              paged.total === 0 && canManage
                ? "Create a profile for each teaching account — it powers assignments and timetables."
                : undefined
            }
            action={
              paged.total === 0 && canManage ? (
                <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
                  New profile
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {paged.pageItems.map((p) => {
            const section = classTeacherOf.get(p.userId);
            const hasDetails =
              p.qualification != null || p.experienceYears != null || p.joiningDate != null;
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3.5 rounded-card border border-subtle bg-white p-5 shadow-sm transition-[transform,box-shadow] duration-base hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} size="lg" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-display text-[17px] font-semibold text-ink-900">
                      {p.name}
                    </span>
                    <span className="truncate text-[12.5px] text-ink-500">
                      {p.employeeId}
                      {p.department ? ` · ${p.department}` : ""}
                    </span>
                  </span>
                  {section ? <StatusChip tone="gold" label={`Class teacher · ${section}`} /> : null}
                </div>

                {hasDetails ? (
                  <div className="flex flex-wrap gap-x-[18px] gap-y-2 border-t border-cream-100 pt-3.5">
                    <Stat label="Qualification" value={p.qualification ?? "—"} />
                    <Stat
                      label="Experience"
                      value={p.experienceYears != null ? `${p.experienceYears} years` : "—"}
                    />
                    <Stat label="Joined" value={p.joiningDate ? fmtJoined(p.joiningDate) : "—"} />
                  </div>
                ) : (
                  <div className="border-t border-cream-100 pt-3.5">
                    <span className="text-[13px] text-ink-400">
                      Qualification, experience and joining date not recorded yet
                      {canManage ? (
                        <>
                          {" — "}
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="cursor-pointer font-semibold text-maroon-700 hover:text-maroon-800"
                          >
                            complete the profile
                          </button>
                        </>
                      ) : null}
                      .
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-cream-100 pt-3.5">
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="cursor-pointer rounded-full border border-subtle bg-white px-4 py-2 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
                    >
                      Edit profile
                    </button>
                  ) : null}
                  <Link
                    href="/timetable/teachers"
                    className="rounded-full border border-subtle bg-white px-4 py-2 text-[12.5px] font-semibold text-maroon-700 transition-colors duration-fast hover:border-maroon-200 hover:bg-maroon-50"
                  >
                    View timetable
                  </Link>
                  <span className="flex-1" />
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => {
                        remove.reset();
                        setDeleting(p);
                      }}
                      className="cursor-pointer px-2 py-2 text-[12.5px] font-semibold text-red-600 transition-colors duration-fast hover:text-maroon-900"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Paginator
        page={paged.page}
        pageCount={paged.pageCount}
        total={paged.total}
        onPage={paged.setPage}
      />

      {editing !== null ? (
        <StaffFormModal
          profile={editing === "new" ? null : editing}
          busy={create.isPending || update.isPending}
          error={create.error?.message ?? update.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            const done = { onSuccess: () => setEditing(null) };
            if (editing === "new") {
              create.mutate(
                {
                  userId: values.userId,
                  name: values.name,
                  employeeId: values.employeeId,
                  ...(values.department ? { department: values.department } : {}),
                  ...(values.qualification ? { qualification: values.qualification } : {}),
                  ...(values.experienceYears != null
                    ? { experienceYears: values.experienceYears }
                    : {}),
                  ...(values.joiningDate ? { joiningDate: values.joiningDate } : {}),
                  ...(values.bio ? { bio: values.bio } : {}),
                },
                done,
              );
            } else {
              update.mutate(
                {
                  id: editing.id,
                  name: values.name,
                  employeeId: values.employeeId,
                  department: values.department || null,
                  qualification: values.qualification || null,
                  experienceYears: values.experienceYears,
                  joiningDate: values.joiningDate || null,
                  bio: values.bio || null,
                },
                done,
              );
            }
          }}
        />
      ) : null}

      {deleting !== null ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message="Permanently delete this profile? The user account is NOT deleted — only the employment profile."
          confirmLabel="Delete profile"
          busy={remove.isPending}
          error={remove.error?.message ?? null}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-px">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">{label}</span>
      <span className="text-[13.5px] font-semibold text-ink-900">{value}</span>
    </span>
  );
}

interface StaffFormValues {
  userId: string;
  name: string;
  employeeId: string;
  department: string;
  qualification: string;
  experienceYears: number | null;
  joiningDate: string;
  bio: string;
}

function StaffFormModal({
  profile,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  profile: StaffDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => void;
}) {
  const [userId, setUserId] = useState(profile?.userId ?? "");
  const [name, setName] = useState(profile?.name ?? "");
  const [employeeId, setEmployeeId] = useState(profile?.employeeId ?? "");
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [qualification, setQualification] = useState(profile?.qualification ?? "");
  const [experienceYears, setExperienceYears] = useState(
    profile?.experienceYears != null ? String(profile.experienceYears) : "",
  );
  const [joiningDate, setJoiningDate] = useState<string>(profile?.joiningDate ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");

  return (
    <Dialog title="Teacher profile" onClose={onClose} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            userId: userId.trim(),
            name: name.trim(),
            employeeId: employeeId.trim(),
            department: department.trim(),
            qualification: qualification.trim(),
            experienceYears: experienceYears === "" ? null : Number(experienceYears),
            joiningDate,
            bio: bio.trim(),
          });
        }}
        className="flex flex-col gap-[18px]"
      >
        <Input
          label="User account id"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
          disabled={profile !== null}
          helper="The teacher’s sign-in account id — from the user admin list. Fixed once set."
          placeholder="usr_…"
          className="font-mono"
        />
        <div className="grid grid-cols-2 gap-3.5">
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Employee id"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="T-002"
            required
          />
          <Input
            label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Primary"
          />
          <Input
            label="Qualification"
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            placeholder="B.Ed"
          />
          <Input
            label="Experience (years)"
            type="number"
            min={0}
            max={80}
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
          />
          <Input
            label="Joining date"
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">
            Bio <span className="font-normal text-ink-400">(shown on the school website)</span>
          </span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="resize-y rounded-xl border border-subtle bg-white px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
