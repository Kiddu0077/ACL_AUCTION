"use client";

import * as React from "react";
import { useAuctionManagementAction } from "@/lib/auction/use-management-action";
import { Pause, Play, Square, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { setAuctionStatus } from "@/app/admin/auction-actions";
import { broadcastAuctionState } from "@/lib/realtime/broadcast-client";
import type { AuctionStatus } from "@/lib/types/database";
import { isAuctionBusy, useAuctionBusy } from "@/lib/auction/activity";

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
}: {
  status: AuctionStatus;
}) {
  const { toast } = useToast();
  const [pending, runAction] = useAuctionManagementAction();
  const [local, setLocal] = React.useState<AuctionStatus>(status);
  const auctionBusy = useAuctionBusy();

  React.useEffect(() => setLocal(status), [status]);

  function go(next: AuctionStatus, label: string) {
    if (isAuctionBusy()) return;
    const prev = local;
    void runAction(async () => {
      setLocal(next);
      const r = await setAuctionStatus(next);
      if (r.error) {
        setLocal(prev);
        toast({ variant: "destructive", title: label, description: r.error });
      } else {
        // Broadcast the committed current state, never a stale page snapshot.
        if (r.state) broadcastAuctionState(r.state);
        toast({ variant: "success", title: label });
      }
    }, () => setLocal(prev));
  }

  return (
    <div className="flex flex-wrap items-center gap-2" title={auctionBusy ? "Wait for the current auction changes to finish saving." : undefined}>
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold">
        <span className={`h-2 w-2 rounded-full ${DOT[local]} ${local === "live" ? "animate-pulse" : ""}`} />
        {LABEL[local]}
      </span>

      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      {(local === "idle" || local === "ended") && (
        <Button size="sm" disabled={pending || auctionBusy} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => go("live", "Auction started")}>
          <Play className="h-4 w-4" /> Start
        </Button>
      )}
      {local === "live" && (
        <Button size="sm" disabled={pending || auctionBusy} variant="outline" onClick={() => go("paused", "Auction paused")}>
          <Pause className="h-4 w-4" /> Pause
        </Button>
      )}
      {local === "paused" && (
        <Button size="sm" disabled={pending || auctionBusy} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => go("live", "Auction resumed")}>
          <Play className="h-4 w-4" /> Resume
        </Button>
      )}
      {(local === "live" || local === "paused") && (
        <Button size="sm" disabled={pending || auctionBusy} variant="outline" className="text-destructive hover:text-destructive" onClick={() => go("ended", "Auction ended")}>
          <Square className="h-4 w-4" /> End
        </Button>
      )}
    </div>
  );
}
