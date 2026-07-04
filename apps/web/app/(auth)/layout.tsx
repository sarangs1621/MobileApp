import { getAuthUser } from "@repo/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/** Auth flow — if already signed in, bounce to the dashboard. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const user = await getAuthUser(supabase);
  if (user) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
