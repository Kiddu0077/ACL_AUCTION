import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuctionState, Database, Player } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export type AuctionMutationResult = {
  error: string | null;
  state?: AuctionState;
  player?: Player;
};

const emptyBlock = {
  current_player_id: null,
  current_bid: 0,
  current_bidder_team_id: null,
};

export async function checkTeamAllocation(
  supabase: Client,
  teamId: string,
  price: number,
  replacingPlayerId?: string,
  allowLocked = false,
): Promise<{ error: string | null }> {
  const [teamResult, squadResult] = await Promise.all([
    supabase.from("teams").select("budget_total, is_locked, squad_size").eq("id", teamId).single(),
    supabase.from("players").select("id, sold_price").eq("team_id", teamId),
  ]);
  if (teamResult.error) return { error: teamResult.error.message };
  if (squadResult.error) return { error: squadResult.error.message };
  const team = teamResult.data;
  const squad = squadResult.data.filter((player) => player.id !== replacingPlayerId);
  if (team.is_locked && !allowLocked) return { error: "This team is locked" };
  if (squad.length >= team.squad_size) return { error: "This team's squad is full" };
  const spent = squad.reduce((sum, player) => sum + (player.sold_price ?? 0), 0);
  if (price > team.budget_total - spent) return { error: "This team does not have enough purse remaining" };
  return { error: null };
}

export async function checkTeamLimits(
  supabase: Client,
  teamId: string,
  limits: { budget_total?: number; squad_size?: number },
): Promise<{ error: string | null }> {
  if (limits.budget_total === undefined && limits.squad_size === undefined) return { error: null };
  const { data, error } = await supabase.from("players").select("sold_price").eq("team_id", teamId);
  if (error) return { error: error.message };
  if (limits.squad_size !== undefined && limits.squad_size < data.length) {
    return { error: "Squad size cannot be smaller than the current team roster" };
  }
  const spent = data.reduce((sum, player) => sum + (player.sold_price ?? 0), 0);
  if (limits.budget_total !== undefined && limits.budget_total < spent) {
    return { error: "Total purse cannot be smaller than the amount already spent" };
  }
  return { error: null };
}

// A delayed sale/cancel must never clear the next player selected by another
// request. The predicate is evaluated by Postgres with the UPDATE, not in JS.
export async function clearPlayerBlock(
  supabase: Client,
  playerId: string,
): Promise<AuctionMutationResult> {
  const { data, error } = await supabase
    .from("auction_state")
    .update(emptyBlock)
    .eq("id", "current")
    .eq("current_player_id", playerId)
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  return { error: null, ...(data ? { state: data } : {}) };
}

export async function selectAuctionPlayer(
  supabase: Client,
  playerId: string,
): Promise<AuctionMutationResult> {
  const [stateResult, playerResult] = await Promise.all([
    supabase.from("auction_state").select("*").eq("id", "current").single(),
    supabase.from("players").select("id, sold_at, team_id").eq("id", playerId).single(),
  ]);
  if (stateResult.error) return { error: stateResult.error.message };
  if (playerResult.error) return { error: playerResult.error.message };
  const state = stateResult.data;
  const player = playerResult.data;
  if (player.sold_at || player.team_id) {
    return { error: "This player is no longer available in the auction pool" };
  }
  if (state.current_player_id === playerId) return { error: null, state };
  if (state.current_player_id) return { error: "Another player is already on the block" };

  const { data, error } = await supabase
    .from("auction_state")
    .update({
      current_player_id: playerId,
      current_bid: state.base_price,
      current_bidder_team_id: null,
    })
    .eq("id", "current")
    .is("current_player_id", null)
    .eq("updated_at", state.updated_at)
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Auction changed while selecting this player. Please try again." };
  return { error: null, state: data };
}

export async function completePlayerSale(
  supabase: Client,
  playerId: string,
  teamId: string,
  price: number,
): Promise<AuctionMutationResult> {
  if (!playerId || !teamId) return { error: "Player and team are required" };
  if (!Number.isSafeInteger(price) || price <= 0 || price > 2_147_483_647) return { error: "Invalid price" };

  // Keep the existing UI's eligibility rules enforced at the write boundary.
  // Independent reads run concurrently rather than waiting for each other.
  const [allocation, stateResult] = await Promise.all([
    checkTeamAllocation(supabase, teamId, price),
    supabase.from("auction_state").select("current_player_id").eq("id", "current").single(),
  ]);
  if (allocation.error) return allocation;
  if (stateResult.error) return { error: stateResult.error.message };
  if (stateResult.data.current_player_id !== playerId) {
    return { error: "This player is no longer on the block" };
  }
  const { data: player, error } = await supabase
    .from("players")
    .update({ team_id: teamId, sold_price: price, sold_at: new Date().toISOString() })
    .eq("id", playerId)
    .is("sold_at", null)
    .is("team_id", null)
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!player) return { error: "This player has already been auctioned or is no longer eligible" };

  const cleared = await clearPlayerBlock(supabase, playerId);
  // Return the committed player even if clearing failed, so a resync never
  // mistakes a persisted sale for an uncommitted optimistic change.
  return { ...cleared, player };
}

export async function completeUnsoldPlayer(
  supabase: Client,
  expectedPlayerId?: string,
): Promise<AuctionMutationResult> {
  const { data: state, error: stateError } = await supabase
    .from("auction_state")
    .select("current_player_id")
    .eq("id", "current")
    .single();
  if (stateError) return { error: stateError.message };
  if (!state.current_player_id) return { error: "No player on the block" };
  if (expectedPlayerId !== undefined && state.current_player_id !== expectedPlayerId) {
    return { error: "This player is no longer on the block" };
  }
  const playerId = state.current_player_id;
  const { data: player, error } = await supabase
    .from("players")
    .update({ team_id: null, sold_price: null, sold_at: new Date().toISOString() })
    .eq("id", playerId)
    .is("sold_at", null)
    .is("team_id", null)
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!player) return { error: "This player has already been auctioned or is no longer eligible" };
  return { ...(await clearPlayerBlock(supabase, playerId)), player };
}

export async function recallAuctionPlayer(
  supabase: Client,
  playerId: string,
): Promise<AuctionMutationResult> {
  const { data: current, error: readError } = await supabase
    .from("players")
    .select("sold_at, team_id, updated_at")
    .eq("id", playerId)
    .single();
  if (readError) return { error: readError.message };
  if (!current.sold_at && !current.team_id) return { error: "This player is already in the available pool" };
  const { data: player, error } = await supabase
    .from("players")
    .update({ team_id: null, sold_price: null, sold_at: null })
    .eq("id", playerId)
    .eq("updated_at", current.updated_at)
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!player) return { error: "This player's sale changed before it could be recalled. Please try again." };
  return { error: null, player };
}
