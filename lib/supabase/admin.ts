import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// SERVER-ONLY. Uses the service role key — bypasses RLS.
// Never import this from a "use client" file or expose to the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createServiceClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
