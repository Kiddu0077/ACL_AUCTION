import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TOURNAMENT_NAME } from "@/lib/tournament";
import { SquadManager } from "@/components/admin/squad-manager";
import type { Player, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function AdminSquadsPage() {
  const supabase = await createClient();
  const [teamsRes, playersRes] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("players").select("*").order("full_name"),
  ]);
  if (teamsRes.error || playersRes.error) {
    throw new Error("Could not load squads. Please retry.");
  }

  const teams = (teamsRes.data ?? []) as Team[];
  const players = (playersRes.data ?? []) as Player[];

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              {TOURNAMENT_NAME}
            </p>
            <Link
              href="/admin/auction"
              className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to auction
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold text-cricket-pitch">
              <Users className="h-5 w-5" /> Squad management
            </h1>
            <p className="text-xs text-muted-foreground">
              Force-assign, remove, transfer players and override sold prices.
            </p>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <SquadManager teams={teams} players={players} />
      </div>
    </main>
  );
}
