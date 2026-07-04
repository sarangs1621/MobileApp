import { getAuthUser } from "@repo/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/** Protected group — requires a verified session (cookie); otherwise → /login. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/login");
  }
  return <>{children}</>;
}
