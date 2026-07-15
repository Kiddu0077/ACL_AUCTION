"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlayerStatus } from "@/lib/types/database";

async function requireAuth() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function updatePlayerStatus(id: string, status: PlayerStatus) {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const supabase = createClient();
  const { error } = await supabase
    .from("players")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/dashboard");
  return { error: null };
}

// Manually add a player from the admin dashboard — bypasses the public
// /register form (which is closed). Uses the service-role client so the
// row can be inserted with the "Verified" status directly, skipping the
// anon RLS policy that limits inserts to status='Pending'.
export async function adminAddPlayer(input: {
  full_name: string;
  role: "Batsman" | "Bowler" | "All-rounder";
  phone?: string | null;
  city: string;
  profile_picture_url?: string | null;
}) {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const name = input.full_name.trim();
  const city = input.city.trim();
  if (!name || !city) return { error: "Name and city are required" };

  const admin = createAdminClient();
  const { error } = await admin.from("players").insert({
    full_name: name,
    role: input.role,
    city,
    phone: input.phone?.trim() || null,
    profile_picture_url: input.profile_picture_url ?? null,
    is_icon: false,
    status: "Verified",
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

  const supabase = createClient();
  const { error } = await supabase.from("players").update(fields).eq("id", id);
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

export async function togglePaid(id: string, paid: boolean) {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const supabase = createClient();
  const { error } = await supabase
    .from("players")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };
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
    .select("profile_picture_url, payment_screenshot_url")
    .eq("id", id)
    .single();

  if (fetchErr) return { error: fetchErr.message };

  // Storage cleanup. We stored:
  //  - profile_picture_url as a full public URL → extract the path after the bucket name
  //  - payment_screenshot_url as the storage path directly (since the bucket is private)
  const profilePath = (() => {
    if (!player?.profile_picture_url) return null;
    const marker = "/profile-pictures/";
    const idx = player.profile_picture_url.indexOf(marker);
    return idx >= 0
      ? player.profile_picture_url.slice(idx + marker.length)
      : null;
  })();

  if (profilePath) {
    await admin.storage.from("profile-pictures").remove([profilePath]);
  }
  if (player?.payment_screenshot_url) {
    await admin.storage
      .from("payment-screenshots")
      .remove([player.payment_screenshot_url]);
  }

  const { error: deleteErr } = await admin.from("players").delete().eq("id", id);
  if (deleteErr) return { error: deleteErr.message };

  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function getPaymentSignedUrl(path: string) {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated", url: null };

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("payment-screenshots")
    .createSignedUrl(path, 60 * 5); // 5-minute signed URL
  if (error) return { error: error.message, url: null };
  return { error: null, url: data.signedUrl };
}
