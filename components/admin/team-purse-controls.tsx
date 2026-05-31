"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Plus, Minus, RotateCcw, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  adjustPurse,
  resetPurse,
  setTeamLocked,
} from "@/app/admin/auction-actions";
import type { Team } from "@/lib/types/database";

export function TeamPurseControls({ team }: { team: Team }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("1000");

  function run(label: string, fn: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.error) {
        toast({ variant: "destructive", title: label, description: r.error });
      } else {
        toast({ variant: "success", title: label });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Lock / unlock */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={pending}
        title={team.is_locked ? "Unlock team (allow bidding)" : "Lock team (block bidding)"}
        onClick={() =>
          run(
            team.is_locked ? `${team.name} unlocked` : `${team.name} locked`,
            () => setTeamLocked(team.id, !team.is_locked),
          )
        }
      >
        {team.is_locked ? (
          <Lock className="h-4 w-4 text-destructive" />
        ) : (
          <Unlock className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {/* Purse adjust dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>₹ Purse</>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust purse — {team.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Amount
              </label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={pending}
                onClick={() =>
                  run("Bonus added", () =>
                    adjustPurse(team.id, Number(amount) || 0),
                  )
                }
              >
                <Plus className="h-4 w-4" /> Add bonus
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() =>
                  run("Purse deducted", () =>
                    adjustPurse(team.id, -(Number(amount) || 0)),
                  )
                }
              >
                <Minus className="h-4 w-4" /> Deduct
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => run("Purse reset", () => resetPurse(team.id))}
              >
                <RotateCcw className="h-4 w-4" /> Reset to default
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Current total purse: ₹
              {new Intl.NumberFormat("en-IN").format(team.budget_total)}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
