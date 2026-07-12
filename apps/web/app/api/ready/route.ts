import { checkReadiness } from "@repo/api";
import { createHeadlessClient } from "@repo/auth";
import { NextResponse } from "next/server";

import { env } from "@/src/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Storage reachability (ADR-025 §4). `listBuckets` is a cheap service-role call
 * that needs no specific bucket to exist. Injected into `checkReadiness` so the
 * business layer never creates the Supabase client (ADR-004). Any error → not
 * reachable; readiness (not liveness) is where a storage outage should show.
 */
async function pingStorage(): Promise<boolean> {
  try {
    const supabase = createHeadlessClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);
    const { error } = await supabase.storage.listBuckets();
    return !error;
  } catch {
    return false;
  }
}

/**
 * READINESS probe — should this instance receive traffic?
 * Checks dependencies (DB + storage) through the API → business → db layers
 * (the app never imports @repo/db directly). Returns 503 when not ready so a
 * load balancer / uptime monitor / deploy smoke check can react.
 */
export async function GET() {
  const report = await checkReadiness(pingStorage);
  return NextResponse.json(
    { service: "web", probe: "ready", ...report },
    { status: report.ready ? 200 : 503 },
  );
}
