import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { AuctionLiveBoard } from "@/components/auction-live-board";
import type { AuctionState, Player, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function AuctionLivePage() {
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
    updated_at: new Date().toISOString(),
  }) as AuctionState;

  const tournament =
    process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "Cricket League";

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-cricket-pitch to-blue-950">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_2px_2px,white_1px,transparent_0)] [background-size:48px_48px]" />
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-secondary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Slim header */}
      <header className="relative flex-shrink-0 border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="container flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <h1 className="truncate text-sm font-black uppercase tracking-wider text-white sm:text-base md:text-lg lg:text-xl">
            {tournament}
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/players"
              className="rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-white/20 sm:text-xs"
            >
              Players
            </Link>
            <Link
              href="/teams"
              className="rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-white/20 sm:text-xs"
            >
              Squads
            </Link>
            <div className="hidden text-xs font-bold uppercase tracking-[0.3em] text-secondary sm:block">
              Auction
            </div>
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        <AuctionLiveBoard
          initialState={state}
          initialPlayers={players}
          initialTeams={teams}
        />
      </div>
    </main>
  );
}
