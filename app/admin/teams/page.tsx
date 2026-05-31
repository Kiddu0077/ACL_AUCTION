import Link from "next/link";
import { ArrowLeft, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamFormDialog } from "@/components/admin/team-form-dialog";
import { TeamDeleteButton } from "@/components/admin/team-delete-button";
import { TeamShareLink } from "@/components/admin/team-share-link";
import { TeamPurseControls } from "@/components/admin/team-purse-controls";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export default async function TeamsAdminPage() {
  const supabase = createClient();

  const [teamsRes, playersRes, stateRes] = await Promise.all([
    supabase.from("teams").select("*").order("name", { ascending: true }),
    supabase
      .from("players")
      .select("team_id, sold_price")
      .not("team_id", "is", null),
    supabase
      .from("auction_state")
      .select("default_team_budget")
      .eq("id", "current")
      .single(),
  ]);

  const teams = teamsRes.data ?? [];
  const players = playersRes.data ?? [];
  const defaultBudget = stateRes.data?.default_team_budget ?? 10000;

  const stats = new Map<string, { count: number; spent: number }>();
  for (const p of players) {
    if (!p.team_id) continue;
    const cur = stats.get(p.team_id) ?? { count: 0, spent: 0 };
    cur.count += 1;
    cur.spent += p.sold_price ?? 0;
    stats.set(p.team_id, cur);
  }

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
              <Users className="h-5 w-5" /> Teams
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage franchises that bid in the auction.
            </p>
          </div>
          <TeamFormDialog
            defaultBudget={defaultBudget}
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Add team
              </Button>
            }
          />
        </div>
      </header>

      <div className="container py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {teams.length} team{teams.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Budget = total they can spend in the auction. Spent and remaining
              update live as players are sold.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Short</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Players</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No teams yet. Click <strong>Add team</strong> to start.
                    </TableCell>
                  </TableRow>
                )}
                {teams.map((t) => {
                  const s = stats.get(t.id) ?? { count: 0, spent: 0 };
                  const remaining = t.budget_total - s.spent;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div
                          className="h-6 w-6 rounded-full border"
                          style={{ background: t.color ?? "#1e3a8a" }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.short_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.owner_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ₹{inr(t.budget_total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ₹{inr(s.spent)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          remaining < 0 ? "text-destructive" : "text-emerald-700"
                        }`}
                      >
                        ₹{inr(remaining)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <TeamPurseControls team={t} />
                          <TeamShareLink id={t.id} name={t.name} />
                          <TeamFormDialog
                            team={t}
                            defaultBudget={defaultBudget}
                            trigger={
                              <Button variant="ghost" size="sm">
                                Edit
                              </Button>
                            }
                          />
                          <TeamDeleteButton
                            id={t.id}
                            name={t.name}
                            playerCount={s.count}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
