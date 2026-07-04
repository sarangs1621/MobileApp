import { createServerClient } from "@repo/auth";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/src/env";

/**
 * Refreshes the Supabase session on navigation (SSR pattern): `getUser()` rotates
 * an expiring access token and writes the updated cookies onto the response, so
 * server components and the tRPC route always see a valid session. Auth routing
 * (redirects) is handled by the (app) layout, not here.
 */
export async function middleware(request: NextRequest) {
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
  return response;
}

export const config = {
  // Run on pages, not on static assets or the API (which authenticates itself).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.).*)"],
};
