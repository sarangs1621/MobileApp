import { createServerClient } from "@repo/auth";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/src/env";

/**
 * Per-request CSP nonce (enforce phase of ADR-025 §2 — supersedes the report-only
 * header that lived in next.config.ts). The policy is set on the REQUEST headers so
 * Next stamps the nonce onto its own inline bootstrap scripts during SSR, and on the
 * RESPONSE so the browser enforces it. Strict-CSP shape: modern browsers use
 * nonce + 'strict-dynamic' (ignoring 'unsafe-inline'/'self' in script-src); legacy
 * browsers fall back to 'self' 'unsafe-inline' — never weaker than the old policy.
 */
function contentSecurityPolicy(nonce: string): string {
  const supabaseOrigin = (() => {
    try {
      return new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
    } catch {
      return "";
    }
  })();
  const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");
  // Next dev/HMR needs eval; production does not.
  const dev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
    "font-src 'self' data:",
    // React/Next inline style attributes; styles are not the session-theft vector.
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  ]
    .join("; ")
    .replace(/\s+/g, " ");
}

/**
 * Refreshes the Supabase session on navigation (SSR pattern): `getUser()` rotates
 * an expiring access token and writes the updated cookies onto the response, so
 * server components and the tRPC route always see a valid session. Auth routing
 * (redirects) is handled by the (app) layout, not here. Also stamps the enforced
 * CSP + nonce (above) on every page request.
 */
export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  // On the request: Next reads this header to nonce its inline scripts (and the
  // app can read x-nonce for any future inline <Script nonce={...}>).
  request.headers.set("Content-Security-Policy", csp);
  request.headers.set("x-nonce", nonce);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  );

  await supabase.auth.getUser();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Run on pages, not on static assets or the API (which authenticates itself).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.).*)"],
};
