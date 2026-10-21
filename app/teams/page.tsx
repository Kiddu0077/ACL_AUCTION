import Link from "next/link";
import { PublicDataError } from "@/components/public-data-error";
import { ArrowLeft, Gavel } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TOURNAMENT_NAME } from "@/lib/tournament";
import { AllTeamsBoard } from "@/components/all-teams-board";
import type { Player, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function TeamsSquadsPage() {
  const supabase = await createClient();
  const [teamsRes, playersRes] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("players").select("*"),
  ]);

  if (playersRes.error || teamsRes.error) return <PublicDataError />;

  const teams = (teamsRes.data ?? []) as Team[];
  const players = (playersRes.data ?? []) as Player[];
  const tournament = TOURNAMENT_NAME;

  return (
    <main className="min-h-screen bg-background pb-12">
      <header className="border-b bg-cricket-pitch text-white shadow">
        <div className="container flex flex-wrap items-center justify-between gap-2 px-4 py-4">
          <div>
            <Link
              href="/"
              className="mb-1 inline-flex items-center gap-1 text-xs text-white/65 hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" /> Home
            </Link>
            <h1 className="text-xl font-black uppercase tracking-wider sm:text-2xl">
              {tournament}
            </h1>
            <p className="text-sm text-white/75">Team Squads</p>
          </div>
          <Link
            href="/auction"
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"
          >
            <Gavel className="h-4 w-4" /> Live auction
          </Link>
        </div>
      </header>

      <div className="container px-4 py-6">
        <AllTeamsBoard initialTeams={teams} initialPlayers={players} />
      </div>
    </main>
  );
}
