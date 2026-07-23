"use client";

import type { GenderKey, StudentDto } from "@repo/types";
import { useState } from "react";

import { Button, Dialog, Input, Select } from "@/src/components/ui";

/** Values the form emits; the page maps them onto create vs update inputs. */
export interface StudentFormValues {
  admissionNo: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  gender: GenderKey | null;
  bloodGroup: string | null;
  nationality: string | null;
  aadhaar: string | null;
  passport: string | null;
  address: string | null;
}

/** Gold uppercase section label inside the modal (design handoff §Student record). */
function SectionLabel({ children, note }: { children: string; note?: string }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-700">
      {children}
      {note ? (
        <span className="font-normal normal-case tracking-normal text-ink-400"> — {note}</span>
      ) : null}
    </div>
  );
}

/**
 * Create/edit form for the student IDENTITY (never class/section/year — those
 * live on Enrollment, ADR-010, and are managed on the student detail page).
 * Admission number is set at admission and immutable afterwards. Cross-field
 * rules (uniqueness) stay in the service. Fields are grouped per the design:
 * Identity · Personal · Documents & address.
 */
export function StudentFormModal({
  student,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  student: StudentDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: StudentFormValues) => void;
}) {
  const [admissionNo, setAdmissionNo] = useState(student?.admissionNo ?? "");
  const [firstName, setFirstName] = useState(student?.firstName ?? "");
  const [lastName, setLastName] = useState(student?.lastName ?? "");
  const [dob, setDob] = useState<string>(student?.dob ?? "");
  const [gender, setGender] = useState<GenderKey | "">(student?.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState(student?.bloodGroup ?? "");
  const [nationality, setNationality] = useState(student?.nationality ?? "");
  const [aadhaar, setAadhaar] = useState(student?.aadhaar ?? "");
  const [passport, setPassport] = useState(student?.passport ?? "");
  const [address, setAddress] = useState(student?.address ?? "");

  return (
    <Dialog title="Student record" onClose={onClose} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            admissionNo: admissionNo.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dob: dob || null,
            gender: gender || null,
            bloodGroup: bloodGroup.trim() || null,
            nationality: nationality.trim() || null,
            aadhaar: aadhaar.trim() || null,
            passport: passport.trim() || null,
            address: address.trim() || null,
          });
        }}
        className="flex flex-col gap-[18px]"
      >
        <SectionLabel>Identity</SectionLabel>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Input
            label="Admission number"
            value={admissionNo}
            onChange={(e) => setAdmissionNo(e.target.value)}
            placeholder="SGV-2026-016"
            helper={student ? "Fixed once set." : "Set at admission — cannot be changed later."}
            required
            disabled={student !== null}
          />
          <div className="hidden sm:block" />
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <SectionLabel>Personal</SectionLabel>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Input
            label="Date of birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          <Select
            label="Gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as GenderKey | "")}
          >
            <option value="">Not recorded</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </Select>
          <Input
            label="Blood group"
            value={bloodGroup}
            onChange={(e) => setBloodGroup(e.target.value)}
            placeholder="O+"
          />
          <Input
            label="Nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="Indian"
          />
        </div>

        <SectionLabel note="optional, can be added later">Documents &amp; address</SectionLabel>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Input
            label="Aadhaar (12 digits)"
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value)}
            inputMode="numeric"
            maxLength={12}
          />
          <Input label="Passport" value={passport} onChange={(e) => setPassport(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-900">Address</span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
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
            Save student
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
