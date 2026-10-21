import { notFound } from "next/navigation";
import Link from "next/link";
import { PublicDataError } from "@/components/public-data-error";
import { Gavel } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TOURNAMENT_NAME } from "@/lib/tournament";
import { TeamLiveView } from "@/components/team-live-view";
import type { AuctionState, Player, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [teamRes, playersRes, stateRes] = await Promise.all([
    supabase.from("teams").select("*").eq("id", id).maybeSingle(),
    supabase.from("players").select("*"),
    supabase.from("auction_state").select("*").eq("id", "current").single(),
  ]);

  if (teamRes.error || playersRes.error || stateRes.error) return <PublicDataError />;

  if (!teamRes.data) {
    notFound();
  }

  const team = teamRes.data as Team;
  const players = (playersRes.data ?? []) as Player[];
  const state = (stateRes.data ?? null) as AuctionState | null;
  const tournament = TOURNAMENT_NAME;

  return (
    <main className="min-h-screen bg-background pb-10">
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
