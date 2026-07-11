import type { BehaviourIncident } from "@repo/db";
import type { BehaviourIncidentDto, IsoUtcString } from "@repo/types";

const iso = (d: Date): IsoUtcString => d.toISOString() as IsoUtcString;
const isoOrNull = (d: Date | null): IsoUtcString | null => (d ? iso(d) : null);

export function mapBehaviourIncident(b: BehaviourIncident): BehaviourIncidentDto {
  return {
    id: b.id,
    schoolId: b.schoolId,
    academicYearId: b.academicYearId,
    studentId: b.studentId,
    enrollmentId: b.enrollmentId,
    teacherId: b.teacherId,
    category: b.category,
    severity: b.severity,
    title: b.title,
    description: b.description,
    actionTaken: b.actionTaken,
    status: b.status,
    parentNotified: b.parentNotified,
    createdByStaffId: b.createdByStaffId,
    resolvedByStaffId: b.resolvedByStaffId,
    resolvedAt: isoOrNull(b.resolvedAt),
    createdAt: iso(b.createdAt),
    updatedAt: iso(b.updatedAt),
  };
}
