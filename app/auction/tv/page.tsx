import { createClient } from "@/lib/supabase/server";
import { AuctionLiveBoard } from "@/components/auction-live-board";
import type { AuctionState, Player, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

// Fullscreen, chrome-free display for a TV / projector. No header, no nav —
// just the live board filling the screen. Open this on the big screen and
// press F11 (or use the TV browser's fullscreen) for an edge-to-edge view.
export default async function AuctionTvPage() {
  const supabase = createClient();
  const [playersRes, teamsRes, stateRes] = await Promise.all([
    supabase.from("players").select("*"),
    supabase.from("teams").select("*").order("name"),
    supabase.from("auction_state").select("*").eq("id", "current").single(),
  ]);

  const players = (playersRes.data ?? []) as Player[];
  const teams = (teamsRes.data ?? []) as Team[];
  const state = (stateRes.data ?? {
    id: "current",
    current_player_id: null,
    current_bid: 0,
    current_bidder_team_id: null,
    base_price: 100,
    bid_increment: 100,
    default_team_budget: 10000,
    status: "idle",
    updated_at: new Date().toISOString(),
  }) as AuctionState;

  const tournament =
    process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "Cricket League";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-cricket-pitch to-blue-950">
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_2px_2px,white_1px,transparent_0)] [background-size:56px_56px]" />
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[32rem] w-[32rem] rounded-full bg-secondary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[36rem] w-[36rem] rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex min-h-screen flex-col p-4 sm:p-6 lg:p-8">
        {/* Compact title bar */}
        <div className="mb-4 flex items-center justify-center lg:mb-6">
          <h1 className="text-center text-2xl font-black uppercase tracking-[0.2em] text-white sm:text-3xl lg:text-4xl">
            {tournament}
            <span className="ml-3 text-secondary">· Auction</span>
          </h1>
        </div>

        {/* Board fills remaining height */}
        <div className="flex-1">
          <AuctionLiveBoard
            initialState={state}
            initialPlayers={players}
            initialTeams={teams}
          />
        </div>
      </div>
    </main>
  );
}
