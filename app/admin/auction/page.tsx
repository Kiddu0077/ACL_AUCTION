import Link from "next/link";
import { ArrowLeft, Gavel } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AuctionCockpit } from "@/components/admin/auction-cockpit";
import { AuctionSettingsDialog } from "@/components/admin/auction-settings-dialog";
import { AuctionLifecycle } from "@/components/admin/auction-lifecycle";
import { RestartAuctionButton } from "@/components/admin/restart-auction-button";
import { createClient } from "@/lib/supabase/server";
import type { AuctionState, Player, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function AuctionAdminPage() {
  const supabase = createClient();
  const [playersRes, teamsRes, stateRes] = await Promise.all([
    supabase.from("players").select("*").order("full_name"),
    supabase.from("teams").select("*").order("name"),
    supabase.from("auction_state").select("*").eq("id", "current").single(),
  ]);

  const players = (playersRes.data ?? []) as Player[];
  const teams = (teamsRes.data ?? []) as Team[];
  const state = stateRes.data as AuctionState | null;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <Link
              href="/admin/dashboard"
              className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to dashboard
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold text-cricket-pitch">
              <Gavel className="h-5 w-5" /> Auction cockpit
            </h1>
            <p className="text-xs text-muted-foreground">
              Single-auctioneer mode. Public board:{" "}
              <Link
                href="/auction"
                className="font-medium text-primary underline"
                target="_blank"
              >
                /auction
              </Link>{" "}
              · TV/projector:{" "}
              <Link
                href="/auction/tv"
                className="font-medium text-primary underline"
                target="_blank"
              >
                /auction/tv
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state && <AuctionLifecycle status={state.status} />}
            <Link
              href="/admin/squads"
              className="rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
            >
              Squads
            </Link>
            <Link
              href="/admin/teams"
              className="rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
            >
              Teams
            </Link>
            {state && <AuctionSettingsDialog state={state} />}
            <RestartAuctionButton />
          </div>
        </div>
      </header>

      <div className="container py-6">
        {!state ? (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-sm text-destructive">
              auction_state row not found — run migration{" "}
              <code>supabase/migrations/0004_auction.sql</code>.
            </CardContent>
          </Card>
        ) : (
          <AuctionCockpit players={players} teams={teams} state={state} />
        )}
      </div>
    </main>
  );
}
