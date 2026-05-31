import Link from "next/link";
import { Gavel, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ExportButtons } from "@/components/admin/export-buttons";
import { PlayersTable } from "@/components/admin/players-table";
import { SignOutButton } from "@/components/admin/signout-button";
import type { Player } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("created_at", { ascending: false });

  const players: Player[] = data ?? [];

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <h1 className="text-xl font-bold text-cricket-pitch">
              Admin Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage registrations, track payments, export reports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/teams"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
            >
              <Users className="h-4 w-4" /> Teams
            </Link>
            <Link
              href="/admin/auction"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-cricket-pitch px-3 text-sm font-medium text-white hover:bg-cricket-pitch/90"
            >
              <Gavel className="h-4 w-4" /> Auction
            </Link>
            <Link
              href="/players"
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
            >
              <Users className="h-4 w-4" /> Players
            </Link>
            <Link
              href="/teams"
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
            >
              <Users className="h-4 w-4" /> Squads
            </Link>
            <ExportButtons players={players} />
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="container py-6">
        {error && (
          <Card className="mb-4 border-destructive">
            <CardContent className="pt-6 text-sm text-destructive">
              Error loading players: {error.message}
            </CardContent>
          </Card>
        )}
        <PlayersTable players={players} />
      </div>
    </main>
  );
}
