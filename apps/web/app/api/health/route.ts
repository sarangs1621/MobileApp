import { APP_TIMEZONE } from "@repo/constants";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * LIVENESS probe — is the web process up and serving?
 * Intentionally dependency-free: a DB/Supabase outage must NOT fail liveness
 * (that's readiness's job — see /api/ready). Reads `process.env` directly rather
 * than the validated env module, so the liveness probe pulls in NO app config
 * (it must respond even if config is incomplete). Always 200 if the process
 * responds. Carries deploy metadata (version/uptime/environment) — ADR-025 §4.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "web",
    probe: "live",
    version: process.env.APP_VERSION ?? "unknown",
    uptime: Math.round(process.uptime()),
    environment: process.env.APP_ENV ?? "unknown",
    timezone: APP_TIMEZONE,
    time: new Date().toISOString(),
  });
}
