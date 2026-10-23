"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedClient } from "@/lib/supabase/auth";
import {
  checkTeamAllocation,
  checkTeamLimits,
  clearPlayerBlock,
  completePlayerSale,
  completeUnsoldPlayer,
  selectAuctionPlayer,
  recallAuctionPlayer,
  type AuctionMutationResult,
} from "@/lib/auction/mutations";
import { adjustedPurse, adminPlayerSchema, auctionSettingsSchema, nonnegativeInteger, positiveInteger, teamSchema } from "@/lib/validations/admin";
import { drawTeamPools } from "@/lib/team-pools";
import type {
  AuctionStatus,
  TeamInsert,
  TeamUpdate,
} from "@/lib/types/database";

async function authenticatedClient() {
  try {
    return (await requireAuthenticatedClient()).supabase;
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return null;
    throw error;
  }
}

async function requireAuth() {
  return (await authenticatedClient()) !== null;
}

function revalidateAuction() {
  revalidatePath("/admin/auction");
  revalidatePath("/admin/teams");
  revalidatePath("/admin/squads");
  revalidatePath("/auction");
  revalidatePath("/teams");
  revalidatePath("/players");
}

// ─────────────────────────────────────────────────────────────────────────────
// Teams
// ─────────────────────────────────────────────────────────────────────────────
export async function createTeam(input: TeamInsert) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = await createClient();
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.from("teams").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function updateTeam(id: string, input: TeamUpdate) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = await createClient();
  const parsed = teamSchema.partial().safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!Object.keys(parsed.data).length) return { error: "No team changes supplied" };
  const limits = await checkTeamLimits(supabase, id, parsed.data);
  if (limits.error) return limits;
  const { error } = await supabase.from("teams").update(parsed.data).eq("id", id).select("id").single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function deleteTeam(id: string) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  // Use admin client because deleting a team also nulls out players.team_id
  // via the foreign-key cascade; service role bypasses any RLS edge cases.
  const admin = createAdminClient();
  // Deleting an assigned team would leave players with a sold price but no
  // team. Require explicitly removing/transferring its players first.
  const { count, error: countError } = await admin
    .from("players").select("id", { count: "exact", head: true }).eq("team_id", id);
  if (countError) return { error: countError.message };
  if (count) return { error: "Remove or transfer this team's players before deleting the team" };
  const { error } = await admin.from("teams").delete().eq("id", id).select("id").single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auction state
// ─────────────────────────────────────────────────────────────────────────────
export async function putPlayerOnBlock(playerId: string): Promise<AuctionMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };
  return selectAuctionPlayer(supabase, playerId);
}

export async function raiseBid(teamId: string) {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };

  const { data: state, error: stateErr } = await supabase
    .from("auction_state")
    .select("*")
    .eq("id", "current")
    .single();
  if (stateErr) return { error: stateErr.message };
  if (!state.current_player_id) return { error: "No player on the block" };

  const nextBid = state.current_bidder_team_id === null
    ? state.current_bid
    : state.current_bid + state.bid_increment;
  if (!positiveInteger.safeParse(nextBid).success) return { error: "Invalid bid amount" };
  const allocation = await checkTeamAllocation(supabase, teamId, nextBid);
  if (allocation.error) return allocation;
  const { data, error } = await supabase
    .from("auction_state")
    .update({ current_bid: nextBid, current_bidder_team_id: teamId })
    .eq("id", "current")
    .eq("updated_at", state.updated_at)
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "The auction changed before this bid was saved. Please try again." };
  return { error: null, bid: data.current_bid, state: data };
}

export async function setCustomBid(teamId: string, amount: number) {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };
  if (!positiveInteger.safeParse(amount).success) return { error: "Invalid amount" };
  const { data: state, error: stateErr } = await supabase
    .from("auction_state")
    .select("current_player_id, updated_at")
    .eq("id", "current")
    .single();
  if (stateErr) return { error: stateErr.message };
  if (!state.current_player_id) return { error: "No player on the block" };
  const allocation = await checkTeamAllocation(supabase, teamId, amount);
  if (allocation.error) return allocation;
  const { data, error } = await supabase
    .from("auction_state")
    .update({ current_bid: Math.floor(amount), current_bidder_team_id: teamId })
    .eq("id", "current")
    .eq("updated_at", state.updated_at)
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "The auction changed before this bid was saved. Please try again." };
  return { error: null, state: data };
}

// Hot-path mutations return rows from the write itself, including DB timestamps.
// No route revalidation: the cockpit reconciles these results and Realtime keeps
// other displays current without rerendering three pages after every click.
export async function sellPlayer(
  playerId: string,
  teamId: string,
  price: number,
): Promise<AuctionMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };
  return completePlayerSale(supabase, playerId, teamId, price);
}

export async function markSold(): Promise<AuctionMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };
  const { data: state, error } = await supabase
    .from("auction_state")
    .select("current_player_id, current_bid, current_bidder_team_id")
    .eq("id", "current")
    .single();
  if (error) return { error: error.message };
  if (!state.current_player_id) return { error: "No player on the block" };
  if (!state.current_bidder_team_id) return { error: "No team has bid yet — use Unsold instead" };
  return completePlayerSale(supabase, state.current_player_id, state.current_bidder_team_id, state.current_bid);
}

export async function markUnsold(expectedPlayerId?: string): Promise<AuctionMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };
  return completeUnsoldPlayer(supabase, expectedPlayerId);
}

export async function clearBlock(expectedPlayerId?: string): Promise<AuctionMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };
  let playerId = expectedPlayerId;
  if (!playerId) {
    const { data, error } = await supabase
      .from("auction_state")
      .select("*")
      .eq("id", "current")
      .single();
    if (error) return { error: error.message };
    if (!data.current_player_id) return { error: null, state: data };
    playerId = data.current_player_id;
  }
  return clearPlayerBlock(supabase, playerId);
}

export async function undoSale(playerId: string): Promise<AuctionMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };
  return recallAuctionPlayer(supabase, playerId);
}

// ── Auction lifecycle ───────────────────────────────────────────────────────
export async function setAuctionStatus(status: AuctionStatus) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (!["idle", "live", "paused", "ended"].includes(status)) return { error: "Invalid auction status" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auction_state")
    .update({ status })
    .eq("id", "current")
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null, state: data };
}

// ── Team locking & purse ────────────────────────────────────────────────────
export async function setTeamLocked(id: string, locked: boolean) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (typeof locked !== "boolean") return { error: "Invalid team lock setting" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ is_locked: locked })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function setSquadSize(id: string, size: number) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (!positiveInteger.safeParse(size).success) return { error: "Squad size must be a positive whole number" };
  const supabase = await createClient();
  const limits = await checkTeamLimits(supabase, id, { squad_size: size });
  if (limits.error) return limits;
  const { error } = await supabase
    .from("teams")
    .update({ squad_size: Math.floor(size) })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Adjust total purse by a delta (positive = bonus, negative = deduction).
export async function adjustPurse(id: string, delta: number) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = await createClient();
  const { data: team, error: fetchErr } = await supabase
    .from("teams")
    .select("budget_total, updated_at")
    .eq("id", id)
    .single();
  if (fetchErr) return { error: fetchErr.message };
  const adjusted = adjustedPurse(team.budget_total, delta);
  if (adjusted.error || adjusted.budget === undefined) return { error: adjusted.error ?? "Invalid purse" };
  const next = adjusted.budget;
  const limits = await checkTeamLimits(supabase, id, { budget_total: next });
  if (limits.error) return limits;
  const { error } = await supabase
    .from("teams")
    .update({ budget_total: next })
    .eq("id", id)
    .eq("updated_at", team.updated_at)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null, budget_total: next };
}

// Reset purse back to the auction-wide default budget.
export async function resetPurse(id: string) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = await createClient();
  const { data: state, error: stateError } = await supabase
    .from("auction_state")
    .select("default_team_budget")
    .eq("id", "current")
    .single();
  if (stateError) return { error: stateError.message };
  const budget = state.default_team_budget;
  const limits = await checkTeamLimits(supabase, id, { budget_total: budget });
  if (limits.error) return limits;
  const { error } = await supabase
    .from("teams")
    .update({ budget_total: budget })
    .eq("id", id)
    .select("id")
    .single();
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
  const parsed = adminPlayerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!nonnegativeInteger.safeParse(input.sold_price).success) return { error: "Invalid price" };
  const { full_name: name, city } = parsed.data;

  // Icon players are pre-assigned by an admin. Use the service-role client
  // because public registration cannot set team or auction fields.
  const supabase = createAdminClient();
  const allocation = await checkTeamAllocation(supabase, input.team_id, input.sold_price, undefined, true);
  if (allocation.error) return allocation;
  const { error } = await supabase.from("players").insert({
    full_name: name,
    role: input.role,
    city,
    phone: input.phone?.trim() || null,
    profile_picture_url: input.profile_picture_url ?? null,
    is_icon: true,
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
  if (!nonnegativeInteger.safeParse(price).success) return { error: "Price must be a non-negative whole number" };
  const supabase = await createClient();
  const allocation = await checkTeamAllocation(supabase, teamId, price, playerId, true);
  if (allocation.error) return allocation;
  const { error } = await supabase
    .from("players")
    .update({
      team_id: teamId,
      sold_price: Math.floor(price),
      sold_at: new Date().toISOString(),
    })
    .eq("id", playerId)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Remove a player from their team → back to the available pool.
export async function removeFromTeam(playerId: string) {
  const supabase = await authenticatedClient();
  if (!supabase) return { error: "Not authenticated" };
  const result = await recallAuctionPlayer(supabase, playerId);
  if (result.error) return result;
  revalidateAuction();
  return result;
}

// Move a player to a different team, optionally at a new price.
export async function transferPlayer(
  playerId: string,
  toTeamId: string,
  newPrice?: number,
) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const supabase = await createClient();
  const patch: { team_id: string; sold_price?: number } = {
    team_id: toTeamId,
  };
  if (newPrice !== undefined) {
    if (!nonnegativeInteger.safeParse(newPrice).success) return { error: "Invalid price" };
    patch.sold_price = newPrice;
  }
  const { data: player, error: playerError } = await supabase
    .from("players").select("team_id, sold_price, updated_at").eq("id", playerId).single();
  if (playerError) return { error: playerError.message };
  if (!player.team_id) return { error: "Only assigned players can be transferred" };
  const allocation = await checkTeamAllocation(supabase, toTeamId, newPrice ?? player.sold_price ?? 0, playerId, true);
  if (allocation.error) return allocation;
  const { error } = await supabase
    .from("players")
    .update(patch)
    .eq("id", playerId)
    .eq("updated_at", player.updated_at)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

export async function editSoldPrice(playerId: string, price: number) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (!nonnegativeInteger.safeParse(price).success) return { error: "Price must be a non-negative whole number" };
  const supabase = await createClient();
  const { data: player, error: playerError } = await supabase
    .from("players").select("team_id, updated_at").eq("id", playerId).single();
  if (playerError) return { error: playerError.message };
  if (!player.team_id) return { error: "This player is not assigned to a team" };
  const allocation = await checkTeamAllocation(supabase, player.team_id, price, playerId, true);
  if (allocation.error) return allocation;
  const { error } = await supabase
    .from("players")
    .update({ sold_price: Math.floor(price) })
    .eq("id", playerId)
    .eq("updated_at", player.updated_at)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// Bring every unsold player (sold_at set, but no team) back into the pool for
// another bidding round. Sold players (team_id set) are untouched.
export async function repoolUnsold() {
  if (!(await requireAuth())) return { error: "Not authenticated", count: 0 };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .update({ sold_at: null })
    .is("team_id", null)
    .not("sold_at", "is", null)
    .select("id");
  if (error) return { error: error.message, count: 0 };
  return { error: null, count: data?.length ?? 0 };
}

export async function updateAuctionSettings(input: {
  base_price?: number;
  bid_increment?: number;
  default_team_budget?: number;
}) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const parsed = auctionSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Auction amounts must be positive whole numbers" };
  if (!Object.keys(parsed.data).length) return { error: "No setting changes supplied" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("auction_state")
    .update(parsed.data)
    .eq("id", "current")
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAuction();
  return { error: null };
}

// ── Team pools (group-stage draw) ───────────────────────────────────────────
export async function generateRandomPools() {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const admin = createAdminClient();

  const { data: teams, error: fetchErr } = await admin
    .from("teams")
    .select("id");
  if (fetchErr) return { error: fetchErr.message };
  if (!teams || teams.length === 0) return { error: "No teams to draw" };

  const pools = drawTeamPools(teams);
  const aIds = pools.A.map((team) => team.id);
  const bIds = pools.B.map((team) => team.id);

  if (aIds.length > 0) {
    const { error } = await admin
      .from("teams")
      .update({ pool: "A" })
      .in("id", aIds);
    if (error) return { error: error.message };
  }
  if (bIds.length > 0) {
    const { error } = await admin
      .from("teams")
      .update({ pool: "B" })
      .in("id", bIds);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/pools");
  revalidatePath("/pools");
  revalidatePath("/admin/teams");
  return { error: null };
}

// Manual single-team move — admin-only, indistinguishable on the public page.
export async function setTeamPool(teamId: string, pool: "A" | "B" | null) {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  if (pool !== null && pool !== "A" && pool !== "B") return { error: "Invalid pool" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ pool })
    .eq("id", teamId)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/pools");
  revalidatePath("/pools");
  return { error: null };
}

export async function clearPools() {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("teams")
    .update({ pool: null })
    .not("id", "is", null);
  if (error) return { error: error.message };
  revalidatePath("/admin/pools");
  revalidatePath("/pools");
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
