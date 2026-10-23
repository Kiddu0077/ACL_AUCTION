"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedClient } from "@/lib/supabase/auth";
import { adminPlayerSchema } from "@/lib/validations/admin";

async function requireAuth() {
  try {
    return (await requireAuthenticatedClient()).userId;
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return null;
    throw error;
  }
}

// Manually add a player from the admin dashboard.
export async function adminAddPlayer(input: {
  full_name: string;
  role: "Batsman" | "Bowler" | "All-rounder";
  phone?: string | null;
  city: string;
  profile_picture_url?: string | null;
}) {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const parsed = adminPlayerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { full_name: name, city } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("players").insert({
    full_name: name,
    role: input.role,
    city,
    phone: input.phone?.trim() || null,
    profile_picture_url: input.profile_picture_url ?? null,
    is_icon: false,
  });
  if (error) {
    if (error.code === "23505" || /phone/i.test(error.message)) {
      return { error: "That phone number already belongs to another player." };
    }
    return { error: error.message };
  }
  revalidatePath("/admin/dashboard");
  revalidatePath("/players");
  return { error: null };
}

export async function updatePlayer(
  id: string,
  fields: {
    full_name?: string;
    role?: "Batsman" | "Bowler" | "All-rounder";
    phone?: string | null;
    city?: string;
    profile_picture_url?: string;
  },
) {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const parsed = adminPlayerSchema.partial().safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!Object.keys(parsed.data).length) return { error: "No player changes supplied" };
  const { error } = await supabase.from("players").update(parsed.data).eq("id", id).select("id").single();
  if (error) {
    // Phone uniqueness collision
    if (error.code === "23505" || /phone/i.test(error.message)) {
      return {
        error: "That phone number already belongs to another player.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function deletePlayer(id: string) {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  // Use service-role admin client so we can also clean up storage objects.
  // Storage policies are scoped per bucket; the admin client bypasses RLS
  // and storage policies cleanly for cascading delete.
  const admin = createAdminClient();

  // Fetch the row first so we know what to clean up in storage.
  const { data: player, error: fetchErr } = await admin
    .from("players")
    .select("profile_picture_url")
    .eq("id", id)
    .single();

  if (fetchErr) return { error: fetchErr.message };

  // The profile photo is a public URL; extract its path for storage cleanup.
  const profilePath = (() => {
    if (!player?.profile_picture_url) return null;
    const marker = "/profile-pictures/";
    const idx = player.profile_picture_url.indexOf(marker);
    return idx >= 0
      ? player.profile_picture_url.slice(idx + marker.length)
      : null;
  })();

  if (profilePath) {
    const { error } = await admin.storage.from("profile-pictures").remove([profilePath]);
    if (error) return { error: `Photo cleanup failed: ${error.message}. Please retry deletion.` };
  }

  const { error: deleteErr } = await admin.from("players").delete().eq("id", id)
    .select("id")
    .single();
  if (deleteErr) return { error: deleteErr.message };

  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
