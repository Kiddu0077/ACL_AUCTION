"use client";

import * as React from "react";
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
import { RefreshCcw } from "lucide-react";
import { createOptimisticQueue } from "@/lib/auction/optimistic-queue";
import { setAuctionBusy, useAuctionManagementBusy, isAuctionManagementBusy } from "@/lib/auction/activity";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function AuctionCockpit({
  players: initialPlayers,
  teams: initialTeams,
  state: initialState,
}: {
  players: Player[];
  teams: Team[];
  state: AuctionState;
}) {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [confirmSaleOpen, setConfirmSaleOpen] = React.useState(false);
  const [conn, setConn] = React.useState<ConnectionStatus>("connecting");
  type AuctionData = { state: AuctionState; players: Player[]; teams: Team[] };
  type MutationResult = { error: string | null; state?: AuctionState | null; player?: Player; count?: number };

  const [queue] = React.useState(() => createOptimisticQueue<AuctionData>({
    initial: { state: initialState, players: initialPlayers, teams: initialTeams },
    recover: async () => {
      const supabase = createClient();
      const signal = AbortSignal.timeout(15000);
      const [p, t, s] = await Promise.all([
        supabase.from("players").select("*").order("full_name").abortSignal(signal),
        supabase.from("teams").select("*").order("name").abortSignal(signal),
        supabase.from("auction_state").select("*").eq("id", "current").abortSignal(signal).single(),
      ]);
      if (p.error || t.error || s.error || !s.data) throw new Error("Could not reload the auction");
      return { players: p.data ?? [], teams: t.data ?? [], state: s.data };
    },
    onError: (message, cancelled) => toast({
      variant: "destructive",
      title: "Update not confirmed — restoring saved state",
      description: `${message}${cancelled ? ` ${cancelled} queued action(s) cancelled; retry after resync.` : ""}`,
    }),
  }));
  const snapshot = React.useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const { state, players, teams } = snapshot.data;
  const pending = snapshot.pending > 0;
  const managementBusy = useAuctionManagementBusy();
  const blocked = snapshot.recovering || !!snapshot.error || managementBusy;

  const [salePrice, setSalePrice] = React.useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
  const priceInputRef = React.useRef<HTMLInputElement>(null);
  const broadcastRef = React.useRef<RealtimeChannel | null>(null);
  const syncId = React.useRef("");
  const sequence = React.useRef(0);

  React.useEffect(() => {
    if (initialState.updated_at >= queue.getSnapshot().data.state.updated_at) {
      queue.replace({ state: initialState, players: initialPlayers, teams: initialTeams });
    }
  }, [initialState, initialPlayers, initialTeams, queue]);

  React.useEffect(() => {
    setSalePrice(state.current_player_id ? String(state.base_price) : "");
    setSelectedTeamId(null);
    if (state.current_player_id) {
      const frame = requestAnimationFrame(() => priceInputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [state.current_player_id, state.base_price]);

  function send(event: string, payload: Record<string, unknown>) {
    void broadcastRef.current?.send({ type: "broadcast", event, payload }).catch(() => undefined);
  }

  React.useEffect(() => {
    const supabase = createClient();
    syncId.current = crypto.randomUUID();
    let connectedBefore = false;
    const channel = supabase.channel(AUCTION_CHANNEL, { config: { broadcast: { self: false } } });
    broadcastRef.current = channel;
    channel.subscribe((status) => {
      setConn(realtimeStatus(status));
      if (status === "SUBSCRIBED") {
        if (connectedBefore) void queue.resync();
        connectedBefore = true;
        const current = queue.getSnapshot();
        send("state", { state: current.data.state, pending: current.pending > 0 || current.recovering, syncId: syncId.current, sequence: ++sequence.current });
      }
    });
    const unsubscribe = queue.subscribe(() => {
      const current = queue.getSnapshot();
      setAuctionBusy(current.pending > 0 || current.recovering || !!current.error);
      send("state", { state: current.data.state, pending: current.pending > 0 || current.recovering, syncId: syncId.current, sequence: ++sequence.current });
    });
    const resync = () => { if (document.visibilityState === "visible") void queue.resync(); };
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      const current = queue.getSnapshot();
      if (current.pending || current.recovering) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("beforeunload", warnUnsaved);
    return () => {
      unsubscribe();
      setAuctionBusy(false);
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("beforeunload", warnUnsaved);
      void supabase.removeChannel(channel);
      broadcastRef.current = null;
    };
  }, [queue]);

  function mutate(
    apply: (data: AuctionData) => AuctionData,
    execute: () => Promise<MutationResult>,
    onCommit?: (result: MutationResult) => void,
  ) {
    if (isAuctionManagementBusy()) return false;
    return queue.enqueue({
      apply,
      execute: async () => {
        const result = await execute();
        if (result.error) throw new Error(result.error);
        return result;
      },
      commit: (data, result) => {
        const next = apply(data);
        return {
          ...next,
          state: result.state ?? next.state,
          players: result.player ? next.players.map((player) => player.id === result.player!.id ? result.player! : player) : next.players,
        };
      },
      onCommit: (result) => {
        if (result.player) send("player", { player: result.player });
        onCommit?.(result);
      },
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
          !p.is_icon &&
          !p.team_id &&
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
          !p.is_icon &&
          !p.team_id &&
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
  // Accept only a positive integer; malformed input must never become a sale.
  const priceNumber = salePrice.trim() ? Number(salePrice) : 0;
  const sellerRemaining = selectedTeam
    ? selectedTeam.budget_total -
      (teamStats.get(selectedTeam.id)?.spent ?? 0)
    : 0;
  const canSell =
    !blocked &&
    !!currentPlayer &&
    !!selectedTeam &&
    !selectedTeam.is_locked &&
    (teamStats.get(selectedTeam.id)?.count ?? 0) < selectedTeam.squad_size &&
    Number.isSafeInteger(priceNumber) && priceNumber > 0 &&
    priceNumber <= sellerRemaining;

  // Each click projects immediately; only durable writes wait their turn.
  // Re-projecting pending commands over confirmed state prevents an older SOLD
  // response or page refresh from replacing the next player already selected.
  function doPutOnBlock(playerId: string) {
    const current = queue.getSnapshot();
    if (current.data.state.current_player_id || current.recovering || current.error) return;
    mutate(
      (data) => ({ ...data, state: { ...data.state, current_player_id: playerId, current_bid: data.state.base_price, current_bidder_team_id: null } }),
      () => putPlayerOnBlock(playerId),
    );
  }

  const plannedPlayerId = React.useRef<string | null>(null);
  const nextCandidate = React.useMemo(() => {
    const planned = fullPool.find((player) => player.id === plannedPlayerId.current);
    if (planned) return planned;
    const next = fullPool.length ? fullPool[Math.floor(Math.random() * fullPool.length)] : null;
    plannedPlayerId.current = next?.id ?? null;
    return next;
  }, [fullPool]);
  // Fetch the upcoming random pick's image while the current player is being
  // auctioned. Full-resolution photos no longer start downloading on the click.
  React.useEffect(() => {
    const urls = [nextCandidate?.profile_picture_url, currentPlayer?.profile_picture_url].filter(Boolean) as string[];
    const images = urls.map((url) => { const image = new window.Image(); image.src = url; return image; });
    return () => { images.forEach((image) => { image.onload = null; }); };
  }, [nextCandidate?.profile_picture_url, currentPlayer?.profile_picture_url]);

  function doPickRandom() {
    if (queue.getSnapshot().data.state.current_player_id || blocked) return;
    if (!nextCandidate) {
      toast({ variant: "destructive", title: "No eligible players left" });
      return;
    }
    doPutOnBlock(nextCandidate.id);
  }

  function doSell() {
    if (!currentPlayer || !selectedTeam || !canSell || blocked) return;
    // Guard double-clicks using the synchronous queue snapshot, not last render.
    if (queue.getSnapshot().data.state.current_player_id !== currentPlayer.id) return;
    const player = currentPlayer;
    const team = selectedTeam;
    const price = priceNumber;
    const soldAt = new Date().toISOString();
    mutate(
      (data) => ({
        ...data,
        state: { ...data.state, current_player_id: null, current_bid: 0, current_bidder_team_id: null },
        players: data.players.map((p) => p.id === player.id ? { ...p, team_id: team.id, sold_price: price, sold_at: soldAt } : p),
      }),
      () => sellPlayer(player.id, team.id, price),
      () => send("sold", { playerId: player.id, playerName: player.full_name, photo: player.profile_picture_url, role: player.role, teamName: team.name, teamColor: team.color, price }),
    );
  }

  function doMarkUnsold() {
    const playerId = currentPlayer?.id;
    if (!playerId || queue.getSnapshot().data.state.current_player_id !== playerId || blocked) return;
    const soldAt = new Date().toISOString();
    mutate(
      (data) => ({ ...data,
        state: { ...data.state, current_player_id: null, current_bid: 0, current_bidder_team_id: null },
        players: data.players.map((p) => p.id === playerId ? { ...p, team_id: null, sold_price: null, sold_at: soldAt } : p),
      }),
      () => markUnsold(playerId),
    );
  }

  function doClearBlock() {
    const playerId = queue.getSnapshot().data.state.current_player_id;
    if (!playerId || blocked) return;
    mutate(
      (data) => ({ ...data, state: { ...data.state, current_player_id: null, current_bid: 0, current_bidder_team_id: null } }),
      () => clearBlock(playerId),
    );
  }

  function doRecallSale(playerId: string) {
    if (blocked) return;
    mutate(
      (data) => ({ ...data, players: data.players.map((p) => p.id === playerId ? { ...p, team_id: null, sold_price: null, sold_at: null } : p) }),
      () => undoSale(playerId),
    );
  }

  function doRepoolUnsold() {
    if (!unsoldCount || blocked) return;
    mutate(
      (data) => ({ ...data, players: data.players.map((p) => p.status !== "Rejected" && p.sold_at && !p.team_id ? { ...p, sold_at: null } : p) }),
      () => repoolUnsold(),
      (result) => {
        broadcastReload();
        toast({ variant: "success", title: `${result.count ?? 0} unsold players back in the pool` });
      },
    );
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
    blocked,
    nextCandidate,
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {snapshot.error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive lg:col-span-2">{snapshot.error}</p>}
      <div className="space-y-4">
        {/* Connection + manual resync — top of cockpit, always visible */}
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <ConnectionIndicator status={conn} />
            <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
              {snapshot.recovering ? "Restoring saved state…" : pending ? `Saving ${snapshot.pending} update${snapshot.pending === 1 ? "" : "s"}…` : snapshot.error ? "Resync required" : "All changes saved"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void queue.resync()}
            disabled={pending || snapshot.recovering}
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
                    disabled={blocked || fullPool.length === 0}
                  >
                    <Shuffle className="h-5 w-5" /> 🎲 Random pick (R)
                  </Button>
                  {fullPool.length === 0 && unsoldCount > 0 && (
                    <Button
                      variant="default"
                      size="lg"
                      className="bg-white text-cricket-pitch hover:bg-white/90"
                      onClick={doRepoolUnsold}
                      disabled={blocked}
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
                  <label htmlFor="auction-sale-price" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Final sale price (₹)
                  </label>
                  <Input
                    id="auction-sale-price"
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
                      const teamBlocked = blocked || t.is_locked || isFull;
                      const isSelected = selectedTeamId === t.id;
                      const hot = i < 9 ? i + 1 : null;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTeamId(t.id)}
                          disabled={teamBlocked}
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
                          {hot && !teamBlocked && (
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
                <Button variant="outline" onClick={doMarkUnsold} disabled={blocked}>
                  Unsold (U)
                </Button>
                <Button variant="ghost" onClick={doClearBlock} disabled={blocked}>
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
                  disabled={blocked}
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
                  disabled={blocked || fullPool.length === 0}
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
                    disabled={blocked || !!currentPlayer}
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
                      disabled={blocked}
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
