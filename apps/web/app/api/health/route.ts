import { APP_TIMEZONE } from "@repo/constants";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * LIVENESS probe — is the web process up and serving?
 * Intentionally dependency-free: a DB/Supabase outage must NOT fail liveness
 * (that's readiness's job — see /api/ready). Always 200 if the process responds.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "web",
    probe: "live",
    timezone: APP_TIMEZONE,
    time: new Date().toISOString(),
  });
}
