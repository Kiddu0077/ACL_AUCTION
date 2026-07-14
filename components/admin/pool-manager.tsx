"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Dices, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { contrastText } from "@/lib/utils";
import {
  clearPools,
  generateRandomPools,
  setTeamPool,
} from "@/app/admin/auction-actions";
import type { Team } from "@/lib/types/database";

export function PoolManager({ teams }: { teams: Team[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  // Edit affordances are ON by default now — the auctioneer needs the
  // swap/clear/unassigned tools visible during a live draw.
  // Add ?record=1 to the URL for a clean, edit-free view when you want to
  // screen-record the "random" draw. (The old ?edit=1 URL still works too.)
  const recordMode = params.get("record") === "1";
  const editMode = !recordMode || params.get("edit") === "1";

  const [pending, startTransition] = useTransition();
  const [genDialog, setGenDialog] = React.useState(false);

  const poolA = teams.filter((t) => t.pool === "A");
  const poolB = teams.filter((t) => t.pool === "B");
  const unassigned = teams.filter((t) => t.pool === null);

  function run(label: string, fn: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.error) {
        toast({
          variant: "destructive",
          title: label,
          description: r.error,
        });
      } else {
        toast({ variant: "success", title: label });
        router.refresh();
      }
    });
  }

  function doGenerate() {
    setGenDialog(false);
    run("Pools drawn", generateRandomPools);
  }

  function doClear() {
    run("Pools cleared", clearPools);
  }

  function swap(team: Team) {
    const next = team.pool === "A" ? "B" : "A";
    run(`Moved ${team.name} → Pool ${next}`, () =>
      setTeamPool(team.id, next),
    );
  }

  function assign(team: Team, pool: "A" | "B") {
    run(`Assigned ${team.name} → Pool ${pool}`, () =>
      setTeamPool(team.id, pool),
    );
  }

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3">
        <div className="text-sm">
          <span className="font-semibold">{poolA.length}</span> in Pool A ·{" "}
          <span className="font-semibold">{poolB.length}</span> in Pool B
          {editMode && unassigned.length > 0 && (
            <span className="ml-2 text-destructive">
              · {unassigned.length} unassigned
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={genDialog} onOpenChange={setGenDialog}>
            <DialogTrigger asChild>
              <Button
                className="bg-cricket-pitch text-white hover:bg-cricket-pitch/90"
                disabled={pending || teams.length === 0}
              >
                <Dices className="h-4 w-4" />
                Generate Random Pools
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate random pools?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                This will randomly shuffle all {teams.length} teams into Pool A
                and Pool B (half-and-half). Any existing pool assignments will
                be overwritten.
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={pending}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button onClick={doGenerate} disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Draw pools
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {editMode && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={doClear}
              disabled={pending || (poolA.length === 0 && poolB.length === 0)}
            >
              <Trash2 className="h-4 w-4" />
              Clear pools
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PoolColumn
          label="Pool A"
          accent="#0ea5e9"
          teams={poolA}
          onSwap={swap}
          pending={pending}
          showSwap={editMode}
        />
        <PoolColumn
          label="Pool B"
          accent="#ef4444"
          teams={poolB}
          onSwap={swap}
          pending={pending}
          showSwap={editMode}
        />
      </div>

      {/* Unassigned teams (only in edit mode) */}
      {editMode && unassigned.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Unassigned ({unassigned.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {unassigned.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
                style={{
                  borderLeftColor: t.color ?? "#1e3a8a",
                  borderLeftWidth: 4,
                }}
              >
                <span className="font-semibold">{t.name}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assign(t, "A")}
                    disabled={pending}
                  >
                    → A
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assign(t, "B")}
                    disabled={pending}
                  >
                    → B
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {editMode && (
        <p className="text-center text-xs text-muted-foreground">
          Use the ⇄ button next to any team to silently move it to the other
          pool — public view never indicates edits. To screen-record the draw
          with all controls hidden, add{" "}
          <code className="rounded bg-muted px-1">?record=1</code> to the URL.
        </p>
      )}
    </div>
  );
}

function PoolColumn({
  label,
  accent,
  teams,
  onSwap,
  pending,
  showSwap,
}: {
  label: string;
  accent: string;
  teams: Team[];
  onSwap: (t: Team) => void;
  pending: boolean;
  showSwap: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="py-3"
        style={{ background: accent, color: contrastText(accent) }}
      >
        <CardTitle className="flex items-center justify-between text-lg">
          <span>{label}</span>
          <span className="rounded bg-black/20 px-2 py-0.5 text-sm">
            {teams.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 p-3">
        {teams.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No teams yet.
          </p>
        ) : (
          teams.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
              style={{
                borderLeftColor: t.color ?? "#1e3a8a",
                borderLeftWidth: 4,
              }}
            >
              <span className="truncate text-sm font-semibold">{t.name}</span>
              {showSwap && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSwap(t)}
                  disabled={pending}
                  title="Move to the other pool"
                  className="h-7 w-7"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
