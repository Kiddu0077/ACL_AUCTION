"use client";

import * as React from "react";
import { useTransition } from "react";
import { Pause, Play, Square, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { setAuctionStatus } from "@/app/admin/auction-actions";
import { broadcastAuctionState } from "@/lib/realtime/broadcast-client";
import type { AuctionStatus } from "@/lib/types/database";

const LABEL: Record<AuctionStatus, string> = {
  idle: "Not started",
  live: "Live",
  paused: "Paused",
  ended: "Ended",
};

const DOT: Record<AuctionStatus, string> = {
  idle: "bg-gray-400",
  live: "bg-emerald-500",
  paused: "bg-yellow-500",
  ended: "bg-red-500",
};

export function AuctionLifecycle({
  status,
  currentState,
}: {
  status: AuctionStatus;
  currentState?: {
    id: "current";
    current_player_id: string | null;
    current_bid: number;
    current_bidder_team_id: string | null;
    base_price: number;
    bid_increment: number;
    default_team_budget: number;
    updated_at: string;
  };
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = React.useState<AuctionStatus>(status);

  React.useEffect(() => setLocal(status), [status]);

  function go(next: AuctionStatus, label: string) {
    const prev = local;
    setLocal(next);
    // Fire the broadcast immediately so the public TV flips to paused/ended
    // in <100ms — much faster than waiting for postgres_changes which can
    // drop events over a flaky hotspot connection.
    if (currentState) {
      broadcastAuctionState({ ...currentState, status: next });
    }
    startTransition(async () => {
      const r = await setAuctionStatus(next);
      if (r.error) {
        setLocal(prev);
        // Roll the broadcast back too so the public TV returns to prev state.
        if (currentState) {
          broadcastAuctionState({ ...currentState, status: prev });
        }
        toast({ variant: "destructive", title: label, description: r.error });
      } else {
        toast({ variant: "success", title: label });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold">
        <span className={`h-2 w-2 rounded-full ${DOT[local]} ${local === "live" ? "animate-pulse" : ""}`} />
        {LABEL[local]}
      </span>

      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      {(local === "idle" || local === "ended") && (
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => go("live", "Auction started")}>
          <Play className="h-4 w-4" /> Start
        </Button>
      )}
      {local === "live" && (
        <Button size="sm" variant="outline" onClick={() => go("paused", "Auction paused")}>
          <Pause className="h-4 w-4" /> Pause
        </Button>
      )}
      {local === "paused" && (
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => go("live", "Auction resumed")}>
          <Play className="h-4 w-4" /> Resume
        </Button>
      )}
      {(local === "live" || local === "paused") && (
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => go("ended", "Auction ended")}>
          <Square className="h-4 w-4" /> End
        </Button>
      )}
    </div>
  );
}
