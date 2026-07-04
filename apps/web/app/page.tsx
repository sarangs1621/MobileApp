import { getAuthUser } from "@repo/auth";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/** Entry: route to the dashboard or the login flow based on the cookie session. */
export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const user = await getAuthUser(supabase);
  redirect(user ? "/dashboard" : "/login");
}
