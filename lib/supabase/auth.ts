import { createClient } from "@/lib/supabase/server";

/** Authenticate each action; only public verification keys are cached by the SDK. */
export async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims().catch(() => ({
    data: null,
    error: true,
  }));
  if (error || !data?.claims.sub) {
    throw new Error("Unauthorized");
  }

  return { supabase, userId: data.claims.sub };
}
