"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AuctionStatus,
  TeamInsert,
  TeamUpdate,
} from "@/lib/types/database";

async function requireAuth() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function revalidateAuction() {
  revalidatePath("/admin/auction");
  revalidatePath("/admin/teams");
  revalidatePath("/auction");
}

// ─────────────────────────────────────────────────────────────────────────────
// Teams
// ─────────────────────────────────────────────────────────────────────────────
export async function createTeam(input: TeamInsert) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { error } = await supabase.from("teams").insert(input);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function updateTeam(id: string, input: TeamUpdate) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { error } = await supabase.from("teams").update(input).eq("id", id);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function deleteTeam(id: string) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  // Use admin client because deleting a team also nulls out players.team_id
  // via the foreign-key cascade; service role bypasses any RLS edge cases.
  const admin = createAdminClient();
  const { error } = await admin.from("teams").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auction state
// ─────────────────────────────────────────────────────────────────────────────
export async function putPlayerOnBlock(playerId: string) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();

  // Read current base_price from state
  const { data: state } = await supabase
    .from("auction_state")
    .select("base_price")
    .eq("id", "current")
    .single();

  const basePrice = state?.base_price ?? 100;

  const { error } = await supabase
    .from("auction_state")
    .update({
      current_player_id: playerId,
      current_bid: basePrice,
      current_bidder_team_id: null,
    })
    .eq("id", "current");
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function raiseBid(teamId: string) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();

  const { data: state, error: stateErr } = await supabase
    .from("auction_state")
    .select("current_bid, bid_increment, current_bidder_team_id, current_player_id")
    .eq("id", "current")
    .single();
  if (stateErr) return { error: stateErr.message };
  if (!state?.current_player_id)
    return { error: "No player on the block" };

  // If no one's bid yet, the first bid is AT the current base_price (we don't
  // bump). Otherwise increment by bid_increment.
  const nextBid =
    state.current_bidder_team_id === null
      ? state.current_bid
      : state.current_bid + state.bid_increment;

  const { error } = await supabase
    .from("auction_state")
    .update({
      current_bid: nextBid,
      current_bidder_team_id: teamId,
    })
    .eq("id", "current");
  if (error) return { error: error.message };
  // No revalidate here: bids are high-frequency and the cockpit's optimistic
  // state + the public board's broadcast already reflect the change instantly.
  // The DB write above persists it for page reloads. Skipping revalidate
  // avoids re-render churn that made rapid bidding feel laggy.
  return { error: null, bid: nextBid };
}

export async function setCustomBid(teamId: string, amount: number) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Invalid amount" };
  const supabase = createClient();
  const { error } = await supabase
    .from("auction_state")
    .update({
      current_bid: Math.floor(amount),
      current_bidder_team_id: teamId,
    })
    .eq("id", "current");
  if (error) return { error: error.message };
  return { error: null };
}

// Direct sale: admin types the final price + picks the winning team + hits SOLD.
// Single deterministic write — no incremental bid race, no stale state.
export async function sellPlayer(
  playerId: string,
  teamId: string,
  price: number,
) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (!playerId || !teamId)
    return { error: "Player and team are required" };
  if (!Number.isFinite(price) || price < 0)
    return { error: "Invalid price" };

  const supabase = createClient();
  const finalPrice = Math.floor(price);

  const { error: playerErr } = await supabase
    .from("players")
    .update({
      team_id: teamId,
      sold_price: finalPrice,
      sold_at: new Date().toISOString(),
    })
    .eq("id", playerId);
  if (playerErr) return { error: playerErr.message };

  const { error: stateErr } = await supabase
    .from("auction_state")
    .update({
      current_player_id: null,
      current_bid: 0,
      current_bidder_team_id: null,
    })
    .eq("id", "current");
  if (stateErr) return { error: stateErr.message };

  revalidateAuction();
  return { error: null };
}

export async function markSold() {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();

  const { data: state, error: stateErr } = await supabase
    .from("auction_state")
    .select("current_player_id, current_bid, current_bidder_team_id")
    .eq("id", "current")
    .single();
  if (stateErr) return { error: stateErr.message };
  if (!state?.current_player_id) return { error: "No player on the block" };
  if (!state.current_bidder_team_id)
    return { error: "No team has bid yet — use Unsold instead" };

  const { error: playerErr } = await supabase
    .from("players")
    .update({
      team_id: state.current_bidder_team_id,
      sold_price: state.current_bid,
      sold_at: new Date().toISOString(),
    })
    .eq("id", state.current_player_id);
  if (playerErr) return { error: playerErr.message };

  // Clear the block.
  const { error: clearErr } = await supabase
    .from("auction_state")
    .update({
      current_player_id: null,
      current_bid: 0,
      current_bidder_team_id: null,
    })
    .eq("id", "current");
  if (clearErr) return { error: clearErr.message };

  revalidateAuction();
  return { error: null };
}

export async function markUnsold() {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();

  const { data: state, error: stateErr } = await supabase
    .from("auction_state")
    .select("current_player_id")
    .eq("id", "current")
    .single();
  if (stateErr) return { error: stateErr.message };
  if (!state?.current_player_id) return { error: "No player on the block" };

  const { error: playerErr } = await supabase
    .from("players")
    .update({
      team_id: null,
      sold_price: null,
      sold_at: new Date().toISOString(),
    })
    .eq("id", state.current_player_id);
  if (playerErr) return { error: playerErr.message };

  const { error: clearErr } = await supabase
    .from("auction_state")
    .update({
      current_player_id: null,
      current_bid: 0,
      current_bidder_team_id: null,
    })
    .eq("id", "current");
  if (clearErr) return { error: clearErr.message };

  revalidateAuction();
  return { error: null };
}

export async function clearBlock() {
  // Cancel the current player without marking sold or unsold.
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { error } = await supabase
    .from("auction_state")
    .update({
      current_player_id: null,
      current_bid: 0,
      current_bidder_team_id: null,
    })
    .eq("id", "current");
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function undoSale(playerId: string) {
  // Returns a sold/unsold player back to the pool — clears team_id/price/sold_at.
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { error } = await supabase
    .from("players")
    .update({ team_id: null, sold_price: null, sold_at: null })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// ── Auction lifecycle ───────────────────────────────────────────────────────
export async function setAuctionStatus(status: AuctionStatus) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { error } = await supabase
    .from("auction_state")
    .update({ status })
    .eq("id", "current");
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// ── Team locking & purse ────────────────────────────────────────────────────
export async function setTeamLocked(id: string, locked: boolean) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { error } = await supabase
    .from("teams")
    .update({ is_locked: locked })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function setSquadSize(id: string, size: number) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (!Number.isFinite(size) || size < 1) return { error: "Invalid size" };
  const supabase = createClient();
  const { error } = await supabase
    .from("teams")
    .update({ squad_size: Math.floor(size) })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Adjust total purse by a delta (positive = bonus, negative = deduction).
export async function adjustPurse(id: string, delta: number) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { data: team, error: fetchErr } = await supabase
    .from("teams")
    .select("budget_total")
    .eq("id", id)
    .single();
  if (fetchErr) return { error: fetchErr.message };
  const next = Math.max(0, (team?.budget_total ?? 0) + Math.floor(delta));
  const { error } = await supabase
    .from("teams")
    .update({ budget_total: next })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null, budget_total: next };
}

// Reset purse back to the auction-wide default budget.
export async function resetPurse(id: string) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { data: state } = await supabase
    .from("auction_state")
    .select("default_team_budget")
    .eq("id", "current")
    .single();
  const budget = state?.default_team_budget ?? 10000;
  const { error } = await supabase
    .from("teams")
    .update({ budget_total: budget })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Create a brand-new ICON player (not from registration) and place them
// directly on a team. Phone is optional for icon players.
export async function createIconPlayer(input: {
  full_name: string;
  role: "Batsman" | "Bowler" | "All-rounder";
  city: string;
  team_id: string;
  sold_price: number;
  profile_picture_url?: string | null;
  phone?: string | null;
}) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const name = input.full_name.trim();
  const city = input.city.trim();
  if (!name || !city) return { error: "Name and city are required" };

  // Service-role client: the public RLS insert policy only allows new rows
  // with status='Pending' (for the registration form). Icon players are
  // created Verified + pre-assigned, so we bypass RLS here (admin-only action).
  const supabase = createAdminClient();
  const { error } = await supabase.from("players").insert({
    full_name: name,
    role: input.role,
    city,
    phone: input.phone?.trim() || null,
    profile_picture_url: input.profile_picture_url ?? null,
    is_icon: true,
    status: "Verified",
    team_id: input.team_id,
    sold_price: Math.max(0, Math.floor(input.sold_price || 0)),
    sold_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505" || /phone/i.test(error.message)) {
      return { error: "That phone number already belongs to another player." };
    }
    return { error: error.message };
  }
  revalidateAuction();
  return { error: null };
}

// ── Squad emergency edits ───────────────────────────────────────────────────
// Force a player onto a team at a given price, regardless of bidding.
export async function forceAssignPlayer(
  playerId: string,
  teamId: string,
  price: number,
) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (!Number.isFinite(price) || price < 0) return { error: "Invalid price" };
  const supabase = createClient();
  const { error } = await supabase
    .from("players")
    .update({
      team_id: teamId,
      sold_price: Math.floor(price),
      sold_at: new Date().toISOString(),
    })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Remove a player from their team → back to the available pool.
export async function removeFromTeam(playerId: string) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const { error } = await supabase
    .from("players")
    .update({ team_id: null, sold_price: null, sold_at: null })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Move a player to a different team, optionally at a new price.
export async function transferPlayer(
  playerId: string,
  toTeamId: string,
  newPrice?: number,
) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const patch: { team_id: string; sold_price?: number } = {
    team_id: toTeamId,
  };
  if (newPrice !== undefined && Number.isFinite(newPrice) && newPrice >= 0) {
    patch.sold_price = Math.floor(newPrice);
  }
  const { error } = await supabase
    .from("players")
    .update(patch)
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function editSoldPrice(playerId: string, price: number) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (!Number.isFinite(price) || price < 0) return { error: "Invalid price" };
  const supabase = createClient();
  const { error } = await supabase
    .from("players")
    .update({ sold_price: Math.floor(price) })
    .eq("id", playerId);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Bring every unsold player (sold_at set, but no team) back into the pool for
// another bidding round. Sold players (team_id set) are untouched.
export async function repoolUnsold() {
  if (!(await requireAuth())) return { error: "Not authenticated", count: 0 };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("players")
    .update({ sold_at: null })
    .is("team_id", null)
    .not("sold_at", "is", null)
    .select("id");
  if (error) return { error: error.message, count: 0 };
  revalidateAuction();
  return { error: null, count: data?.length ?? 0 };
}

export async function updateAuctionSettings(input: {
  base_price?: number;
  bid_increment?: number;
  default_team_budget?: number;
}) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = createClient();
  const patch: {
    base_price?: number;
    bid_increment?: number;
    default_team_budget?: number;
  } = {};
  if (input.base_price !== undefined) patch.base_price = input.base_price;
  if (input.bid_increment !== undefined)
    patch.bid_increment = input.bid_increment;
  if (input.default_team_budget !== undefined)
    patch.default_team_budget = input.default_team_budget;
  const { error } = await supabase
    .from("auction_state")
    .update(patch)
    .eq("id", "current");
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Wipe all sales and clear the block. Players go back to the unsold pool;
// teams keep their budgets. ICON PLAYERS are preserved on their teams —
// they're pre-assigned and shouldn't be wiped by a restart.
// Confirmation guard is enforced in the UI.
export async function restartAuction() {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const admin = createAdminClient();

  // Reset sale fields for every non-icon player. is_icon=true rows stay intact.
  const { error: playersErr } = await admin
    .from("players")
    .update({ team_id: null, sold_price: null, sold_at: null })
    .eq("is_icon", false);
  if (playersErr) return { error: playersErr.message };

  // Clear the auction block.
  const { error: stateErr } = await admin
    .from("auction_state")
    .update({
      current_player_id: null,
      current_bid: 0,
      current_bidder_team_id: null,
    })
    .eq("id", "current");
  if (stateErr) return { error: stateErr.message };

  revalidateAuction();
  return { error: null };
}
