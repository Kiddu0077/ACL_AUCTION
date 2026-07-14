import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PoolManager } from "@/components/admin/pool-manager";
import type { Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function PoolsAdminPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("teams")
    .select("*")
    .order("name");
  const teams = (data ?? []) as Team[];

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="container flex flex-wrap items-center justify-between gap-2 py-4">
          <div>
            <Link
              href="/admin/dashboard"
              className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold text-cricket-pitch">
              <Layers className="h-5 w-5" /> Group-stage pools
            </h1>
            <p className="text-xs text-muted-foreground">
              Draw + edit the two pools. Public view at{" "}
              <Link
                href="/pools"
                target="_blank"
                className="text-primary underline"
              >
                /pools
              </Link>
            </p>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <PoolManager teams={teams} />
      </div>
    </main>
  );
}
