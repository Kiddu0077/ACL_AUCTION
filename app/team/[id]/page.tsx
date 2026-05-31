import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gavel } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TeamLiveView } from "@/components/team-live-view";
import type { AuctionState, Player, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const [teamRes, playersRes, stateRes] = await Promise.all([
    supabase.from("teams").select("*").eq("id", params.id).single(),
    supabase.from("players").select("*"),
    supabase.from("auction_state").select("*").eq("id", "current").single(),
  ]);

  if (teamRes.error || !teamRes.data) {
    notFound();
  }

  const team = teamRes.data as Team;
  const players = (playersRes.data ?? []) as Player[];
  const state = (stateRes.data ?? null) as AuctionState | null;
  const tournament =
    process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "Cricket League";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-blue-100 pb-10">
      <header className="bg-cricket-pitch px-4 py-3 text-white shadow">
        <div className="container flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-secondary">
              {tournament}
            </p>
            <p className="text-sm font-semibold">Team Manager View</p>
          </div>
          <Link
            href="/auction"
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
          >
            <Gavel className="h-3 w-3" /> Live auction
          </Link>
        </div>
      </header>

      <div className="container py-4">
        <TeamLiveView
          team={team}
          initialPlayers={players}
          initialState={state}
        />
      </div>
    </main>
  );
}
