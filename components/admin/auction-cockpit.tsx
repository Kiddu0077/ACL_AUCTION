"use client";

import * as React from "react";
import { useTransition } from "react";
import Image from "next/image";
import {
  Check,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Shuffle,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  clearBlock,
  markUnsold,
  putPlayerOnBlock,
  repoolUnsold,
  sellPlayer,
  undoSale,
} from "@/app/admin/auction-actions";
import { createClient } from "@/lib/supabase/browser";
import { AUCTION_CHANNEL } from "@/lib/realtime/broadcast";
import { broadcastReload } from "@/lib/realtime/broadcast-client";
import {
  ConnectionIndicator,
  realtimeStatus,
  type ConnectionStatus,
} from "@/components/connection-indicator";
import type { AuctionState, Player, Team } from "@/lib/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function AuctionCockpit({
  players: initialPlayers,
  teams,
  state: initialState,
}: {
  players: Player[];
  teams: Team[];
  state: AuctionState;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = React.useState("");
  const [confirmSaleOpen, setConfirmSaleOpen] = React.useState(false);
  const [conn, setConn] = React.useState<ConnectionStatus>("connecting");

  // Local optimistic state — applied instantly on click; rolled back on error.
  const [state, setState] = React.useState(initialState);
  const [players, setPlayers] = React.useState(initialPlayers);

  // Direct-entry sale state: type the final price + pick winning team
  const [salePrice, setSalePrice] = React.useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
  const priceInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setState(initialState), [initialState]);
  React.useEffect(() => setPlayers(initialPlayers), [initialPlayers]);

  // Reset the sale entry whenever the player on the block changes.
  // Default the price to the configured base_price for fast common case.
  React.useEffect(() => {
    setSalePrice(state.current_player_id ? String(state.base_price) : "");
    setSelectedTeamId(null);
    if (state.current_player_id) {
      // Focus after the next paint — snappier than a setTimeout delay.
      requestAnimationFrame(() => priceInputRef.current?.focus());
    }
  }, [state.current_player_id, state.base_price]);

  // Broadcast channel — pushes updates to public viewers in <100ms.
  // Also tracks connection status so admin sees a red badge on hotspot drops.
  const broadcastRef = React.useRef<RealtimeChannel | null>(null);
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(AUCTION_CHANNEL, { config: { broadcast: { self: false } } })
      .subscribe((status) => setConn(realtimeStatus(status)));
    broadcastRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      broadcastRef.current = null;
    };
  }, []);

  function broadcastState(s: AuctionState) {
    broadcastRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: { state: s },
    });
  }
  function broadcastPlayer(p: Player) {
    broadcastRef.current?.send({
      type: "broadcast",
      event: "player",
      payload: { player: p },
    });
  }
  function broadcastSold(payload: {
    playerName: string;
    photo: string | null;
    role: string;
    teamName: string;
    teamColor: string | null;
    price: number;
  }) {
    broadcastRef.current?.send({
      type: "broadcast",
      event: "sold",
      payload,
    });
  }

  // Team sale stats
  const teamStats = React.useMemo(() => {
    const m = new Map<string, { count: number; spent: number }>();
    for (const p of players) {
      if (!p.team_id) continue;
      const cur = m.get(p.team_id) ?? { count: 0, spent: 0 };
      cur.count += 1;
      cur.spent += p.sold_price ?? 0;
      m.set(p.team_id, cur);
    }
    return m;
  }, [players]);

  // Pool: not Rejected, not sold, not currently on block
  const pool = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter(
        (p) =>
          p.status !== "Rejected" &&
          !p.sold_at &&
          p.id !== state.current_player_id,
      )
      .filter((p) => {
        if (!q) return true;
        return `${p.full_name} ${p.phone ?? ""} ${p.city}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [players, query, state.current_player_id]);

  const fullPool = React.useMemo(
    () =>
      players.filter(
        (p) =>
          p.status !== "Rejected" &&
          !p.sold_at &&
          p.id !== state.current_player_id,
      ),
    [players, state.current_player_id],
  );

  const recentSales = React.useMemo(
    () =>
      players
        .filter((p) => p.team_id && p.sold_at)
        .sort((a, b) => (b.sold_at ?? "").localeCompare(a.sold_at ?? ""))
        .slice(0, 5),
    [players],
  );

  const unsoldCount = React.useMemo(
    () =>
      players.filter((p) => p.status !== "Rejected" && p.sold_at && !p.team_id)
        .length,
    [players],
  );

  const currentPlayer = state.current_player_id
    ? players.find((p) => p.id === state.current_player_id)
    : null;
  const selectedTeam = selectedTeamId
    ? teams.find((t) => t.id === selectedTeamId)
    : null;

  // Computed: is the entered price affordable for the selected team?
  // Strip non-digits first — guards against "3,000" / "3000abc" etc. that
  // would NaN out to 0 and cause an accidental ₹0 sale.
  const cleanPrice = salePrice.replace(/[^0-9]/g, "");
  const priceNumber = cleanPrice ? Number(cleanPrice) : 0;
  const sellerRemaining = selectedTeam
    ? selectedTeam.budget_total -
      (teamStats.get(selectedTeam.id)?.spent ?? 0)
    : 0;
  const canSell =
    !!currentPlayer &&
    !!selectedTeam &&
    !selectedTeam.is_locked &&
    (teamStats.get(selectedTeam.id)?.count ?? 0) < selectedTeam.squad_size &&
    priceNumber > 0 && // ← must be > 0; prevents accidental ₹0 sales
    priceNumber <= sellerRemaining;

  // ── Optimistic helpers ────────────────────────────────────────────────────
  function runOptimistic<T>(
    apply: () => T,
    rollback: (snap: T) => void,
    server: () => Promise<{ error: string | null }>,
    errorTitle: string,
  ) {
    const snapshot = apply();
    startTransition(async () => {
      const r = await server();
      if (r.error) {
        rollback(snapshot);
        toast({
          variant: "destructive",
          title: errorTitle,
          description: r.error,
        });
      }
    });
  }

  function doPutOnBlock(playerId: string) {
    runOptimistic(
      () => {
        const prev = state;
        const next: AuctionState = {
          ...state,
          current_player_id: playerId,
          current_bid: 0,
          current_bidder_team_id: null,
        };
        setState(next);
        broadcastState(next);
        return prev;
      },
      (prev) => setState(prev),
      () => putPlayerOnBlock(playerId),
      "Could not put player on block",
    );
  }

  // ── Reserved auction positions ─────────────────────────────────────────────
  // Certain players must land at a fixed position in the random draw, no matter
  // how many times the auction is restarted. Position = (already-auctioned
  // count) + 1, i.e. the pick about to be made. These players are held back
  // from every earlier random pick, then force-selected at/after their slot.
  const RESERVED_POSITIONS: {
    position: number;
    match: (p: Player) => boolean;
  }[] = [
    // Manikandan M — matched by phone (most reliable): +91 96454 74152
    {
      position: 110,
      match: (p) => (p.phone ?? "").replace(/\D/g, "").endsWith("9645474152"),
    },
    // Akhil Ravi — matched by name tokens
    {
      position: 130,
      match: (p) => {
        const n = p.full_name.trim().toLowerCase();
        return n.includes("akhil") && n.includes("ravi");
      },
    },
  ];

  function doPickRandom() {
    if (currentPlayer) return;
    if (fullPool.length === 0) {
      toast({ variant: "destructive", title: "No eligible players left" });
      return;
    }

    // How many players have already been auctioned (sold or unsold).
    const auctionedCount = players.filter(
      (p) => p.status !== "Rejected" && p.sold_at,
    ).length;
    const position = auctionedCount + 1; // the pick we're about to make

    // Which reserved players are still available in the pool right now.
    const reservedInPool = RESERVED_POSITIONS.map((r) => ({
      ...r,
      player: fullPool.find(r.match),
    })).filter((r) => r.player);

    // If we've reached (or passed) a reserved slot and that player is still
    // available, force them onto the block. Check the LATEST slot first so
    // Akhil (130) wins over Manikandan (110) if both are somehow pending.
    const due = reservedInPool
      .filter((r) => position >= r.position)
      .sort((a, b) => b.position - a.position)[0];
    if (due?.player) {
      doPutOnBlock(due.player.id);
      return;
    }

    // Otherwise pick randomly, but EXCLUDE any not-yet-due reserved players so
    // they stay held back for their slot. Fallback to the full pool if only
    // reserved players remain (so the auction can still finish).
    const reservedIds = new Set(reservedInPool.map((r) => r.player!.id));
    let candidates = fullPool.filter((p) => !reservedIds.has(p.id));
    if (candidates.length === 0) candidates = fullPool;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    doPutOnBlock(pick.id);
  }

  function doSell() {
    if (!currentPlayer || !selectedTeam) return;
    if (!canSell) {
      toast({
        variant: "destructive",
        title: "Cannot sell",
        description: selectedTeam.is_locked
          ? `${selectedTeam.name} is locked`
          : priceNumber > sellerRemaining
            ? `${selectedTeam.name} only has ₹${inr(sellerRemaining)} left`
            : "Squad full or invalid price",
      });
      return;
    }

    const playerId = currentPlayer.id;
    const teamId = selectedTeam.id;
    const price = priceNumber;
    // Capture display values BEFORE we wipe currentPlayer/selectedTeam state.
    const splashPayload = {
      playerName: currentPlayer.full_name,
      photo: currentPlayer.profile_picture_url,
      role: currentPlayer.role,
      teamName: selectedTeam.name,
      teamColor: selectedTeam.color,
      price,
    };

    // Fire server first; only broadcast SOLD splash if it succeeds. This
    // prevents the public board from celebrating a sale that errored out.
    // Local optimistic UI still updates immediately for the admin.
    const snapshot = { state, players };
    const nextState: AuctionState = {
      ...state,
      current_player_id: null,
      current_bid: 0,
      current_bidder_team_id: null,
    };
    setState(nextState);
    broadcastState(nextState);
    const updated: Player = {
      ...currentPlayer,
      team_id: teamId,
      sold_price: price,
      sold_at: new Date().toISOString(),
    };
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? updated : p)));
    broadcastPlayer(updated);

    startTransition(async () => {
      const r = await sellPlayer(playerId, teamId, price);
      if (r.error) {
        setState(snapshot.state);
        setPlayers(snapshot.players);
        toast({
          variant: "destructive",
          title: "SOLD failed — rolled back",
          description: r.error,
        });
      } else {
        // Only celebrate on a confirmed sale
        broadcastSold(splashPayload);
      }
    });
  }

  function doMarkUnsold() {
    if (!currentPlayer) return;
    const playerId = currentPlayer.id;
    runOptimistic(
      () => {
        const snapshot = { state, players };
        const nextState: AuctionState = {
          ...state,
          current_player_id: null,
          current_bid: 0,
          current_bidder_team_id: null,
        };
        setState(nextState);
        broadcastState(nextState);
        const updated: Player = {
          ...currentPlayer,
          team_id: null,
          sold_price: null,
          sold_at: new Date().toISOString(),
        };
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? updated : p)),
        );
        broadcastPlayer(updated);
        return snapshot;
      },
      (snap) => {
        setState(snap.state);
        setPlayers(snap.players);
      },
      () => markUnsold(),
      "Unsold failed",
    );
  }

  function doClearBlock() {
    runOptimistic(
      () => {
        const prev = state;
        const next: AuctionState = {
          ...state,
          current_player_id: null,
          current_bid: 0,
          current_bidder_team_id: null,
        };
        setState(next);
        broadcastState(next);
        return prev;
      },
      (prev) => setState(prev),
      () => clearBlock(),
      "Cancel failed",
    );
  }

  function doRecallSale(playerId: string) {
    runOptimistic(
      () => {
        const snapshot = players;
        const original = players.find((p) => p.id === playerId);
        if (original) {
          const u: Player = {
            ...original,
            team_id: null,
            sold_price: null,
            sold_at: null,
          };
          setPlayers((prev) =>
            prev.map((p) => (p.id === playerId ? u : p)),
          );
          broadcastPlayer(u);
        }
        return snapshot;
      },
      (snap) => setPlayers(snap),
      () => undoSale(playerId),
      "Recall failed",
    );
  }

  function doRepoolUnsold() {
    if (unsoldCount === 0) return;
    const snapshot = players;
    setPlayers((prev) =>
      prev.map((p) =>
        p.status !== "Rejected" && p.sold_at && !p.team_id
          ? { ...p, sold_at: null }
          : p,
      ),
    );
    startTransition(async () => {
      const r = await repoolUnsold();
      if (r.error) {
        setPlayers(snapshot);
        toast({
          variant: "destructive",
          title: "Re-pool failed",
          description: r.error,
        });
      } else {
        // Bulk UPDATE — tell public displays to re-fetch (Realtime may
        // rate-limit the burst of individual row events).
        broadcastReload();
        toast({
          variant: "success",
          title: `${r.count} unsold player${r.count === 1 ? "" : "s"} back in the pool`,
        });
      }
    });
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // 1-9 → pick team N (only when NOT inside an input/textarea)
      if (!inField && /^[1-9]$/.test(key) && currentPlayer) {
        const idx = Number(key) - 1;
        const team = teams[idx];
        if (team) {
          e.preventDefault();
          setSelectedTeamId(team.id);
        }
        return;
      }
      // S = open confirm dialog (works even while focused in price input)
      if (key === "s" && !inField && currentPlayer && selectedTeamId && priceNumber > 0) {
        e.preventDefault();
        setConfirmSaleOpen(true);
      } else if (key === "u" && !inField && currentPlayer) {
        e.preventDefault();
        doMarkUnsold();
      } else if (key === "r" && !inField && !currentPlayer) {
        e.preventDefault();
        doPickRandom();
      } else if (key === "escape" && currentPlayer) {
        e.preventDefault();
        if (confirmSaleOpen) setConfirmSaleOpen(false);
        else doClearBlock();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPlayer,
    selectedTeamId,
    priceNumber,
    confirmSaleOpen,
    teams,
    fullPool.length,
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {/* Connection + manual resync — top of cockpit, always visible */}
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
          <ConnectionIndicator status={conn} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            title="Force re-fetch from DB (use after a network blip)"
          >
            <RefreshCcw className="h-4 w-4" /> Resync
          </Button>
        </div>
        {/* HERO */}
        <Card className="overflow-hidden border-2 border-cricket-pitch/30">
          <div className="bg-gradient-to-br from-cricket-pitch to-blue-900 p-6 text-white">
            {currentPlayer ? (
              <div className="flex items-start gap-4">
                {currentPlayer.profile_picture_url ? (
                  <Image
                    src={currentPlayer.profile_picture_url}
                    alt={currentPlayer.full_name}
                    width={140}
                    height={140}
                    className="h-32 w-32 rounded-lg border-4 border-secondary bg-white/10 object-contain"
                  />
                ) : (
                  <div className="h-32 w-32 rounded-lg border-4 border-secondary bg-white/10" />
                )}
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-secondary">
                    Now on the block
                  </p>
                  <h2 className="text-3xl font-bold">
                    {currentPlayer.full_name}
                  </h2>
                  <p className="text-sm text-blue-100">
                    {currentPlayer.role} · {currentPlayer.city}
                  </p>
                  {currentPlayer.is_icon && (
                    <span className="mt-2 inline-block rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1 text-[11px] font-black uppercase text-cricket-pitch">
                      ★ Icon
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
                <p className="text-sm uppercase tracking-wider text-secondary">
                  Block is empty
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {/* Both buttons intentionally NOT disabled by `pending` —
                      each action already applies its state change optimistically
                      + broadcasts to public displays. A stale server write in
                      flight from the previous SOLD/UNSOLD doesn't need to
                      block the auctioneer from picking the next player. */}
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={doPickRandom}
                    disabled={fullPool.length === 0}
                  >
                    <Shuffle className="h-5 w-5" /> 🎲 Random pick (R)
                  </Button>
                  {fullPool.length === 0 && unsoldCount > 0 && (
                    <Button
                      variant="default"
                      size="lg"
                      className="bg-white text-cricket-pitch hover:bg-white/90"
                      onClick={doRepoolUnsold}
                    >
                      <RefreshCw className="h-5 w-5" /> Re-pool {unsoldCount}{" "}
                      unsold
                    </Button>
                  )}
                </div>
                <p className="text-xs text-blue-200">
                  {fullPool.length === 0 && unsoldCount > 0
                    ? "Pool empty — bring unsold players back for another round."
                    : "…or scroll down and tap a player from the pool."}
                </p>
              </div>
            )}
          </div>

          {/* SALE PANEL — direct entry */}
          {currentPlayer && (
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                {/* Price input */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Final sale price (₹)
                  </label>
                  <Input
                    ref={priceInputRef}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && selectedTeamId && priceNumber > 0) {
                        e.preventDefault();
                        setConfirmSaleOpen(true);
                      }
                    }}
                    placeholder={String(state.base_price)}
                    className="mt-1 h-14 text-2xl font-bold tabular-nums"
                  />
                </div>

                {/* Team selector */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Winning team · tap to pick (or press 1–
                    {Math.min(teams.length, 9)})
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {teams.map((t, i) => {
                      const s =
                        teamStats.get(t.id) ?? { count: 0, spent: 0 };
                      const remaining = t.budget_total - s.spent;
                      const isFull = s.count >= t.squad_size;
                      const blocked = t.is_locked || isFull;
                      const isSelected = selectedTeamId === t.id;
                      const hot = i < 9 ? i + 1 : null;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTeamId(t.id)}
                          disabled={blocked}
                          className={`group relative flex flex-col items-start gap-0.5 rounded-md border-2 px-2.5 py-1.5 text-left text-xs transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSelected
                              ? "border-secondary bg-secondary/25 ring-2 ring-secondary/40"
                              : "border-border bg-white hover:border-secondary"
                          }`}
                          style={{
                            borderLeftColor: t.color ?? undefined,
                            borderLeftWidth: 6,
                          }}
                        >
                          {hot && !blocked && (
                            <span className="absolute right-1 top-1 rounded bg-muted px-1 py-0.5 text-[9px] font-mono font-semibold text-muted-foreground">
                              {hot}
                            </span>
                          )}
                          <span className="text-xs font-bold leading-tight">
                            {t.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {s.count}/{t.squad_size} · ₹{inr(remaining)}
                          </span>
                          {t.is_locked ? (
                            <span className="text-[10px] font-semibold text-destructive">
                              🔒 Locked
                            </span>
                          ) : isFull ? (
                            <span className="text-[10px] font-semibold text-blue-700">
                              Squad full
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    {teams.length === 0 && (
                      <p className="col-span-full rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        No teams yet — add teams first.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Button
                  size="lg"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={!canSell}
                  onClick={() => setConfirmSaleOpen(true)}
                >
                  <Check className="h-5 w-5" /> SOLD
                  {selectedTeam && priceNumber > 0 && (
                    <span className="ml-1 opacity-90">
                      → {selectedTeam.name} · ₹{inr(priceNumber)}
                    </span>
                  )}
                </Button>
                <Button variant="outline" onClick={doMarkUnsold}>
                  Unsold (U)
                </Button>
                <Button variant="ghost" onClick={doClearBlock}>
                  <RotateCcw className="h-4 w-4" /> Cancel (Esc)
                </Button>
                {pending && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> syncing…
                  </span>
                )}
              </div>
              {!canSell && selectedTeam && priceNumber > sellerRemaining && (
                <p className="text-xs text-destructive">
                  {selectedTeam.name} only has ₹{inr(sellerRemaining)} left.
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* Player pool */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">
              Player pool ({pool.length}
              {query && ` of ${fullPool.length}`})
            </CardTitle>
            <div className="flex gap-2">
              {unsoldCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={doRepoolUnsold}
                  title="Bring unsold players back into the pool"
                >
                  <RefreshCw className="h-4 w-4" /> Re-pool {unsoldCount}
                </Button>
              )}
              {!currentPlayer && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={doPickRandom}
                  disabled={fullPool.length === 0}
                >
                  <Shuffle className="h-4 w-4" /> Random
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players…"
                className="h-9 pl-8"
              />
            </div>
            <div className="max-h-[440px] space-y-1 overflow-y-auto pr-1">
              {pool.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {query
                    ? "No players match your search."
                    : players.length === 0
                      ? "No registered players yet."
                      : "All eligible players have been auctioned."}
                </p>
              ) : (
                pool.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => doPutOnBlock(p.id)}
                    disabled={!!currentPlayer}
                    className="flex w-full items-center gap-3 rounded-md border border-border p-2 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {p.profile_picture_url ? (
                      <Image
                        src={p.profile_picture_url}
                        alt={p.full_name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md bg-muted object-contain"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.role} · {p.city}
                      </p>
                    </div>
                    {p.is_icon && (
                      <span className="rounded bg-gradient-to-r from-yellow-400 to-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cricket-pitch">
                        ★ Icon
                      </span>
                    )}
                    {p.status === "Pending" && (
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800">
                        Pending
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right sidebar */}
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teams. Add some in{" "}
                <a
                  href="/admin/teams"
                  className="font-medium text-primary underline"
                >
                  /admin/teams
                </a>
                .
              </p>
            ) : (
              teams.map((t) => {
                const s = teamStats.get(t.id) ?? { count: 0, spent: 0 };
                const remaining = t.budget_total - s.spent;
                const pct = Math.max(
                  0,
                  Math.min(100, (s.spent / t.budget_total) * 100),
                );
                return (
                  <div
                    key={t.id}
                    className="rounded-md border border-border p-2"
                    style={{
                      borderLeftColor: t.color ?? "#1e3a8a",
                      borderLeftWidth: 4,
                    }}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.count}/{t.squad_size}
                      </span>
                    </div>
                    <div className="my-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-secondary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] tabular-nums">
                      <span className="text-muted-foreground">
                        ₹{inr(s.spent)}
                      </span>
                      <span
                        className={
                          remaining < 0
                            ? "font-semibold text-destructive"
                            : "font-semibold text-emerald-700"
                        }
                      >
                        ₹{inr(remaining)} left
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {recentSales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 5 sales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentSales.map((p) => {
                const team = teams.find((t) => t.id === p.team_id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {p.profile_picture_url && (
                        <Image
                          src={p.profile_picture_url}
                          alt={p.full_name}
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded bg-muted object-contain"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.full_name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {team?.name ?? "—"} · ₹{inr(p.sold_price ?? 0)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Recall this sale (return to pool)"
                      onClick={() => doRecallSale(p.id)}
                      className="h-7 w-7"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-1.5 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">Keyboard shortcuts</p>
            <p>
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">1</kbd>–
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">9</kbd>{" "}
              pick team N
            </p>
            <p>
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Enter</kbd>{" "}
              in price field → confirm
            </p>
            <p>
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">S</kbd>{" "}
              open SOLD confirm ·{" "}
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">U</kbd>{" "}
              Unsold
            </p>
            <p>
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">R</kbd>{" "}
              random pick ·{" "}
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Esc</kbd>{" "}
              cancel
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Confirm sale dialog */}
      <Dialog open={confirmSaleOpen} onOpenChange={setConfirmSaleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm sale</DialogTitle>
            <DialogDescription>
              {currentPlayer && selectedTeam ? (
                <>
                  Sell{" "}
                  <span className="font-semibold text-foreground">
                    {currentPlayer.full_name}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {selectedTeam.name}
                  </span>{" "}
                  for{" "}
                  <span className="font-semibold text-emerald-700">
                    ₹{inr(priceNumber)}
                  </span>
                  ?
                </>
              ) : (
                "No active sale."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmSaleOpen(false)}
            >
              Cancel
            </Button>
            <Button
              autoFocus
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!canSell}
              onClick={() => {
                setConfirmSaleOpen(false);
                doSell();
              }}
            >
              <Check className="h-4 w-4" /> Confirm SOLD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
