import { NotFoundError, ValidationError } from "@repo/core";
import type { BehaviourIncident } from "@repo/db";

import type { ServiceContext } from "../../context";
import { assertStudentInScope, isFullAccess, loadStudentInSchool } from "../people/scope";

export { recordAudit, isFullAccess } from "../people/scope";

/** The acting user's Staff row id — the B3 audit actor (ADR-020 §1). */
export async function resolveActingStaffId(ctx: ServiceContext): Promise<string> {
  const staff = await ctx.repositories.staff.findByUserId(ctx.user.userId);
  if (!staff) {
    throw new ValidationError(
      "Acting user has no staff profile (required to record behaviour incidents)",
    );
  }
  return staff.id;
}

/** Load an incident, enforcing tenant ownership (404 if missing / other-school). */
export async function loadIncidentInSchool(
  ctx: ServiceContext,
  id: string,
): Promise<BehaviourIncident> {
  const b = await ctx.repositories.behaviourIncidents.findById(id);
  if (!b || b.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Behaviour incident not found");
  }
  return b;
}

/**
 * Read gate for a single incident (ADR-020 §5/§6): admin ALL; the owning teacher
 * (teacherId = self) always; else the student must be in the reader's scope
 * (teacher own-section / parent own-child) — via the shared people scope helper.
 */
export async function assertCanReadIncident(
  ctx: ServiceContext,
  incident: BehaviourIncident,
): Promise<void> {
  if (isFullAccess(ctx)) {
    return;
  }
  if (incident.teacherId === ctx.user.userId) {
    return;
  }
  const student = await loadStudentInSchool(ctx, incident.studentId);
  await assertStudentInScope(ctx, student); // teacher own-section / parent own-child
}
