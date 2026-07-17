"use client";

import * as React from "react";
import Image from "next/image";

import { createClient } from "@/lib/supabase/browser";
import { AUCTION_CHANNEL } from "@/lib/realtime/broadcast";
import { contrastText } from "@/lib/utils";
import {
  ConnectionIndicator,
  realtimeStatus,
  type ConnectionStatus,
} from "@/components/connection-indicator";
import type { AuctionState, Player, Team } from "@/lib/types/database";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function AuctionLiveBoard({
  initialState,
  initialPlayers,
  initialTeams,
}: {
  initialState: AuctionState;
  initialPlayers: Player[];
  initialTeams: Team[];
}) {
  const [state, setState] = React.useState(initialState);
  const [players, setPlayers] = React.useState(initialPlayers);
  // Teams must be stateful too — admin can change budget/lock/squad_size
  // mid-auction (bonus purse, deduct, reset, lock/unlock). Without this
  // subscription, the public board shows a stale budget_total and the
  // "remaining points" numbers drift out of sync from the cockpit.
  const [teams, setTeams] = React.useState(initialTeams);
  React.useEffect(() => setTeams(initialTeams), [initialTeams]);

  // SOLD celebration splash
  type SoldSplash = {
    playerName: string;
    photo: string | null;
    role: string;
    teamName: string;
    teamColor: string | null;
    price: number;
  };
  const [soldSplash, setSoldSplash] = React.useState<SoldSplash | null>(null);
  const splashTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track realtime channel health — surfaces to viewers when network drops
  const [conn, setConn] = React.useState<ConnectionStatus>("connecting");
  const connBroadcast = React.useRef<ConnectionStatus>("connecting");
  const connPg = React.useRef<ConnectionStatus>("connecting");
  const mergeConn = React.useCallback(() => {
    const a = connBroadcast.current, b = connPg.current;
    // worst-of: any disconnected = disconnected, any connecting = connecting
    if (a === "disconnected" || b === "disconnected") setConn("disconnected");
    else if (a === "connecting" || b === "connecting") setConn("connecting");
    else setConn("connected");
  }, []);

  React.useEffect(() => {
    const supabase = createClient();

    const broadcast = supabase
      .channel(AUCTION_CHANNEL)
      .on("broadcast", { event: "state" }, (msg) => {
        const s = (msg.payload as { state?: AuctionState })?.state;
        if (s) setState(s);
      })
      .on("broadcast", { event: "player" }, (msg) => {
        const u = (msg.payload as { player?: Player })?.player;
        if (!u) return;
        setPlayers((prev) =>
          prev.some((p) => p.id === u.id)
            ? prev.map((p) => (p.id === u.id ? u : p))
            : [...prev, u],
        );
      })
      .on("broadcast", { event: "sold" }, (msg) => {
        const s = msg.payload as SoldSplash | undefined;
        if (!s?.playerName) return;
        setSoldSplash(s);
        if (splashTimer.current) clearTimeout(splashTimer.current);
        splashTimer.current = setTimeout(() => setSoldSplash(null), 2000);
      })
      .on("broadcast", { event: "reload" }, async () => {
        // Full re-fetch — after bulk mutations (Restart, Re-pool) where
        // individual postgres_changes events may have been rate-limited.
        try {
          const [pRes, tRes, sRes] = await Promise.all([
            supabase.from("players").select("*"),
            supabase.from("teams").select("*").order("name"),
            supabase
              .from("auction_state")
              .select("*")
              .eq("id", "current")
              .single(),
          ]);
          if (pRes.data) setPlayers(pRes.data as Player[]);
          if (tRes.data) setTeams(tRes.data as Team[]);
          if (sRes.data) setState(sRes.data as AuctionState);
        } catch {
          /* connection issue — will heal on next event */
        }
      })
      .subscribe((status) => {
        connBroadcast.current = realtimeStatus(status);
        mergeConn();
      });

    const pgChanges = supabase
      .channel("auction-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auction_state" },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            setState(payload.new as AuctionState);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const u = payload.new as Player;
            setPlayers((prev) => prev.map((p) => (p.id === u.id ? u : p)));
          } else if (payload.eventType === "INSERT" && payload.new) {
            setPlayers((prev) => [...prev, payload.new as Player]);
          } else if (payload.eventType === "DELETE" && payload.old) {
            const id = (payload.old as { id?: string }).id;
            if (id) setPlayers((prev) => prev.filter((p) => p.id !== id));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const u = payload.new as Team;
            setTeams((prev) =>
              prev.some((t) => t.id === u.id)
                ? prev.map((t) => (t.id === u.id ? u : t))
                : [...prev, u],
            );
          } else if (payload.eventType === "INSERT" && payload.new) {
            setTeams((prev) => [...prev, payload.new as Team]);
          } else if (payload.eventType === "DELETE" && payload.old) {
            const id = (payload.old as { id?: string }).id;
            if (id) setTeams((prev) => prev.filter((t) => t.id !== id));
          }
        },
      )
      .subscribe((status) => {
        connPg.current = realtimeStatus(status);
        mergeConn();
      });

    return () => {
      supabase.removeChannel(broadcast);
      supabase.removeChannel(pgChanges);
      if (splashTimer.current) clearTimeout(splashTimer.current);
    };
  }, []);

  const currentPlayer = state.current_player_id
    ? players.find((p) => p.id === state.current_player_id)
    : null;

  // Paused / ended overlay
  if (state.status === "paused" || state.status === "ended") {
    const ended = state.status === "ended";
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-secondary bg-gradient-to-br from-cricket-pitch to-blue-950 p-10 text-center text-white shadow-2xl">
        <Trophy />
        <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl md:text-6xl">
          {ended ? "Auction Complete" : "Auction Paused"}
        </h2>
        <p className="text-base text-blue-100/80 sm:text-lg">
          {ended
            ? "Thanks for watching — see the final squads."
            : "We'll be back in a moment…"}
        </p>
        {ended && (
          <a
            href="/teams"
            className="mt-2 rounded-md bg-secondary px-6 py-3 text-base font-bold text-secondary-foreground shadow-lg hover:brightness-110"
          >
            View final squads →
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      {/* SOLD celebration splash */}
      {soldSplash && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative mx-4 flex w-full max-w-2xl flex-col items-center gap-4 rounded-3xl border-4 p-6 text-center shadow-2xl animate-in zoom-in-90 duration-300 sm:p-10"
            style={{
              borderColor: soldSplash.teamColor ?? "#fbbf24",
              background:
                "linear-gradient(135deg, #0a1226 0%, #1e3a8a 60%, #0f1e47 100%)",
            }}
          >
            <div className="animate-in slide-in-from-top-4 zoom-in-75 duration-300">
              <span
                className="inline-block -rotate-6 rounded-xl border-4 px-6 py-2 text-4xl font-black uppercase tracking-widest shadow-lg sm:text-6xl"
                style={{
                  borderColor: soldSplash.teamColor ?? "#fbbf24",
                  color: soldSplash.teamColor ?? "#fbbf24",
                }}
              >
                Sold!
              </span>
            </div>

            {soldSplash.photo && (
              <Image
                src={soldSplash.photo}
                alt={soldSplash.playerName}
                width={200}
                height={200}
                className="h-32 w-32 rounded-2xl border-4 bg-white/10 object-contain shadow-xl sm:h-40 sm:w-40"
                style={{ borderColor: soldSplash.teamColor ?? "#fbbf24" }}
              />
            )}

            <div className="text-white">
              <p className="text-2xl font-black uppercase sm:text-4xl">
                {soldSplash.playerName}
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-blue-200">
                {soldSplash.role}
              </p>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-xs uppercase tracking-widest text-blue-200">
                Sold to
              </span>
              <span
                className="rounded-full px-6 py-2 text-lg font-black uppercase shadow-lg sm:text-2xl"
                style={{
                  background: soldSplash.teamColor ?? "#fbbf24",
                  color: contrastText(soldSplash.teamColor),
                }}
              >
                {soldSplash.teamName}
              </span>
              <span className="mt-1 text-3xl font-black tabular-nums text-secondary sm:text-5xl">
                ₹{inr(soldSplash.price)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main board — single full-bleed player panel, no side rail.
          h-full so it fills the flex-1 parent on any TV/monitor. */}
      <div className="h-full">
        {/* ── Current player — fills the entire screen ─────────────────── */}
        <div
          className="relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-secondary shadow-2xl"
          style={{
            background:
              "linear-gradient(135deg, #0a1226 0%, #1e3a8a 55%, #0f1e47 100%)",
          }}
        >
          {/* Pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_2px_2px,white_1px,transparent_0)] [background-size:32px_32px]" />
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-secondary/30 blur-3xl" />

          {/* Status strip — just the live indicator + connection health */}
          <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-4 py-2 text-white">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] sm:text-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span>{currentPlayer ? "Auctioning Now" : "On Hold"}</span>
            </div>
            <ConnectionIndicator status={conn} />
          </div>

          {currentPlayer ? (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-4 p-4 text-white sm:gap-6 sm:p-6 md:flex-row md:items-center md:gap-8 md:p-8">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-secondary/40 blur-2xl" />
                {currentPlayer.profile_picture_url ? (
                  <Image
                    src={currentPlayer.profile_picture_url}
                    alt={currentPlayer.full_name}
                    width={600}
                    height={600}
                    className="relative aspect-square w-56 rounded-2xl border-4 border-secondary bg-white/10 object-contain shadow-2xl sm:w-72 md:w-80 lg:w-96 xl:w-[28rem] 2xl:w-[36rem]"
                    priority
                  />
                ) : (
                  <div className="relative flex aspect-square w-56 items-center justify-center rounded-2xl border-4 border-secondary bg-white/10 text-sm sm:w-72 md:w-80 lg:w-96 xl:w-[28rem] 2xl:w-[36rem]">
                    No photo
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 text-center md:text-left">
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-secondary sm:text-base md:text-lg">
                  {currentPlayer.role}
                </p>
                <h1 className="mt-2 break-words text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl xl:text-[7rem] 2xl:text-[9rem]">
                  {currentPlayer.full_name}
                </h1>
                <p className="mt-3 text-lg text-blue-100/90 sm:text-xl md:text-2xl lg:text-3xl">
                  {currentPlayer.city}
                </p>
                {currentPlayer.is_icon && (
                  <span className="mt-4 inline-block rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-1.5 text-sm font-black uppercase text-cricket-pitch shadow-lg sm:text-base">
                    ★ Icon Player
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-10 text-center text-white">
              {/* Big animated trophy centerpiece */}
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-secondary/20 blur-2xl" />
                <div className="relative rounded-full bg-gradient-to-br from-secondary/30 to-transparent p-6 sm:p-10">
                  <Trophy className="h-16 w-16 text-secondary sm:h-24 sm:w-24 md:h-32 md:w-32 lg:h-40 lg:w-40" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-4xl font-black uppercase leading-tight tracking-wide text-white sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">
                  Ready for the next player
                </p>
                <p className="text-base uppercase tracking-[0.3em] text-secondary sm:text-lg md:text-xl">
                  ● The auctioneer is picking ●
                </p>
              </div>
              {/* Tricolor accent bars */}
              <div className="mt-4 flex gap-2">
                <span className="h-1.5 w-16 rounded-full bg-saffron sm:h-2 sm:w-20" />
                <span className="h-1.5 w-16 rounded-full bg-white sm:h-2 sm:w-20" />
                <span className="h-1.5 w-16 rounded-full bg-india-green sm:h-2 sm:w-20" />
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}

function Trophy({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-16 w-16 text-secondary sm:h-20 sm:w-20"}
      aria-hidden="true"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
