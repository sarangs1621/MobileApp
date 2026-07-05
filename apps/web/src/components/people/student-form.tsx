"use client";

import type { GenderKey, StudentDto } from "@repo/types";
import { useState } from "react";

import {
  inputClass,
  labelClass,
  Modal,
  outlineBtn,
  primaryBtn,
} from "@/src/components/academic/ui";

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

/**
 * Create/edit form for the student IDENTITY (never class/section/year — those
 * live on Enrollment, ADR-010). Admission number is set at admission and
 * immutable afterwards. Cross-field rules (uniqueness) stay in the service.
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
    <Modal title={student ? "Edit student" : "New student"} onClose={onClose}>
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
        className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1"
      >
        <label className={labelClass}>
          Admission number
          <input
            value={admissionNo}
            onChange={(e) => setAdmissionNo(e.target.value)}
            className={inputClass}
            placeholder="ADM-2026-001"
            required
            disabled={student !== null}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            First name
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className={labelClass}>
            Last name
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              required
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Date of birth
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Gender
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as GenderKey | "")}
              className={inputClass}
            >
              <option value="">Not recorded</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Blood group
            <input
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className={inputClass}
              placeholder="O+"
            />
          </label>
          <label className={labelClass}>
            Nationality
            <input
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className={inputClass}
              placeholder="Indian"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Aadhaar (12 digits)
            <input
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value)}
              className={inputClass}
              inputMode="numeric"
              maxLength={12}
            />
          </label>
          <label className={labelClass}>
            Passport
            <input
              value={passport}
              onChange={(e) => setPassport(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className={labelClass}>
          Address
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`${inputClass} min-h-20`}
            rows={3}
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={outlineBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
