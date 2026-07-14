import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PublicPools } from "@/components/public-pools";
import type { Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  const supabase = createClient();
  const { data } = await supabase.from("teams").select("*").order("name");
  const teams = (data ?? []) as Team[];
  const tournament =
    process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "Cricket League";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-blue-100 pb-12">
      <header className="bg-cricket-pitch px-4 py-5 text-white shadow">
        <div className="container">
          <Link
            href="/"
            className="mb-1 inline-flex items-center gap-1 text-xs text-blue-200 hover:text-white"
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
