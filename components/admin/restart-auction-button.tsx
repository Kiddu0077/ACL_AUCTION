"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { restartAuction } from "@/app/admin/auction-actions";
import { broadcastReload } from "@/lib/realtime/broadcast-client";

const CONFIRM_WORD = "RESTART";

export function RestartAuctionButton() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [pending, startTransition] = useTransition();

  function handleRestart() {
    startTransition(async () => {
      const r = await restartAuction();
      if (r.error) {
        toast({
          variant: "destructive",
          title: "Restart failed",
          description: r.error,
        });
      } else {
        // Signal all public displays to re-fetch — a bulk 150+ row update
        // often gets rate-limited by Supabase Realtime, so relying on
        // postgres_changes alone can leave the TV showing stale counts.
        broadcastReload();
        toast({
          variant: "success",
          title: "Auction restarted",
          description: "All sales cleared. All players back in the pool.",
        });
        setOpen(false);
        setConfirm("");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirm("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <RefreshCw className="h-4 w-4" /> Restart auction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">
            Restart the entire auction?
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">This will:</span>
            <ul className="ml-4 list-disc space-y-1 text-sm">
              <li>Clear every regular player's team assignment and sold price</li>
              <li>Return all auctioned players to the pool</li>
              <li>Clear the current player on the block</li>
            </ul>
            <span className="block font-semibold">
              Kept intact: teams, team budgets, registrations, payment status,
              and <span className="text-secondary">★ icon players</span> (they
              stay on their teams).
            </span>
            <span className="block">This cannot be undone.</span>
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="restart-confirm">
            Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to
            confirm
          </Label>
          <Input
            id="restart-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            autoFocus
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleRestart}
            disabled={pending || confirm !== CONFIRM_WORD}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Restart auction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
