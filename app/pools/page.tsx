import Link from "next/link";
import { PublicDataError } from "@/components/public-data-error";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TOURNAMENT_NAME } from "@/lib/tournament";
import { PublicPools } from "@/components/public-pools";
import type { Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").select("*").order("name");
  if (error) return <PublicDataError />;
  const teams = (data ?? []) as Team[];
  const tournament = TOURNAMENT_NAME;

  return (
    <main className="min-h-screen bg-background pb-12">
      <header className="bg-cricket-pitch px-4 py-5 text-white shadow">
        <div className="container">
          <Link
            href="/"
            className="mb-1 inline-flex items-center gap-1 text-xs text-white/65 hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <h1 className="text-xl font-black uppercase tracking-wider sm:text-2xl">
            {tournament}
          </h1>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-secondary">
            Group-stage pools
          </p>
        </div>
      </header>

      <div className="container px-4 py-6">
        <PublicPools initialTeams={teams} />
      </div>
    </main>
  );
}
