import { checkReadiness } from "@repo/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * READINESS probe — should this instance receive traffic?
 * Checks dependencies (DB connectivity) through the API → business → db layers
 * (the app never imports @repo/db directly). Returns 503 when not ready so a
 * load balancer / uptime monitor / deploy smoke check can react.
 */
export async function GET() {
  const report = await checkReadiness();
  return NextResponse.json(
    { service: "web", probe: "ready", ...report },
    { status: report.ready ? 200 : 503 },
  );
}
