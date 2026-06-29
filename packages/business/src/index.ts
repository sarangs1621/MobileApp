/**
 * @repo/business — application use-cases & orchestration. The ONLY layer that
 * contains feature logic; it composes repositories (@repo/db) + pure rules
 * (@repo/core) + notifications, and never imports a UI framework (CODING_STANDARDS §4).
 * Feature services register here per milestone; none exist in M0.
 */
import type { ServiceContext } from "./context";

export type { ServiceContext } from "./context";
export { checkReadiness, type ReadinessReport } from "./system";

export interface Services {
  // students: StudentService;     // M1
  // attendance: AttendanceService; // M2
  readonly _placeholder?: never;
}

/** Build the use-case services bound to a request's {@link ServiceContext}. */
export function createServices(_ctx: ServiceContext): Services {
  return {};
}
