"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Settings } from "lucide-react";

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
import { updateAuctionSettings } from "@/app/admin/auction-actions";
import type { AuctionState } from "@/lib/types/database";

export function AuctionSettingsDialog({ state }: { state: AuctionState }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const input = {
      base_price: Number(data.get("base_price") || 0),
      bid_increment: Number(data.get("bid_increment") || 0),
      default_team_budget: Number(data.get("default_team_budget") || 0),
    };
    if (input.base_price <= 0 || input.bid_increment <= 0 || input.default_team_budget <= 0) {
      toast({ variant: "destructive", title: "All values must be > 0" });
      return;
    }
    startTransition(async () => {
      const r = await updateAuctionSettings(input);
      if (r.error) {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: r.error,
        });
      } else {
        toast({ variant: "success", title: "Auction settings saved" });
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Auction settings</DialogTitle>
            <DialogDescription>
              These apply to the live bidding. Changing base price or
              increment mid-auction is fine — only new bids use the new value.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="base_price">Base price (₹)</Label>
              <Input
                id="base_price"
                name="base_price"
                type="number"
                min={1}
                step={1}
                defaultValue={state.base_price}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Starting bid when a player goes on the block.
              </p>
            </div>
            <div>
              <Label htmlFor="bid_increment">Bid increment (₹)</Label>
              <Input
                id="bid_increment"
                name="bid_increment"
                type="number"
                min={1}
                step={1}
                defaultValue={state.bid_increment}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                How much each team-tap raises the bid.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="default_team_budget">
                Default team budget (₹)
              </Label>
              <Input
                id="default_team_budget"
                name="default_team_budget"
                type="number"
                min={1}
                step={1}
                defaultValue={state.default_team_budget}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Pre-fills the budget field when you add a new team. Existing
                teams keep their own.
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save settings
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
