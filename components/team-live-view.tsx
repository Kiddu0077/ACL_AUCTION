"use client";

import * as React from "react";
import Image from "next/image";

import { createClient } from "@/lib/supabase/browser";
import { AUCTION_CHANNEL } from "@/lib/realtime/broadcast";
import { contrastText } from "@/lib/utils";
import type { AuctionState, Player, Team } from "@/lib/types/database";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function TeamLiveView({
  team,
  initialPlayers,
  initialState,
}: {
  team: Team;
  initialPlayers: Player[];
  initialState: AuctionState | null;
}) {
  const [players, setPlayers] = React.useState(initialPlayers);
  const [state, setState] = React.useState(initialState);

  // Subscribe to live updates — anyone with this link sees their team's
  // roster update in real time as the auction runs.
  // Two channels: instant broadcast (fast path) + postgres_changes (fallback).
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
        setPlayers((prev) => {
          const exists = prev.some((p) => p.id === u.id);
          if (exists) return prev.map((p) => (p.id === u.id ? u : p));
          return [...prev, u];
        });
      })
      .on("broadcast", { event: "reload" }, async () => {
        const [pRes, sRes] = await Promise.all([
          supabase.from("players").select("*"),
          supabase
            .from("auction_state")
            .select("*")
            .eq("id", "current")
            .single(),
        ]);
        if (pRes.data) setPlayers(pRes.data as Player[]);
        if (sRes.data) setState(sRes.data as AuctionState);
      })
      .subscribe();

    const pgChanges = supabase
      .channel(`team-${team.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const u = payload.new as Player;
            setPlayers((prev) => {
              const exists = prev.some((p) => p.id === u.id);
              if (exists) return prev.map((p) => (p.id === u.id ? u : p));
              return [...prev, u];
            });
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
        { event: "*", schema: "public", table: "auction_state" },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            setState(payload.new as AuctionState);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcast);
      supabase.removeChannel(pgChanges);
    };
  }, [team.id]);

  const myPlayers = React.useMemo(
    () =>
      players
        .filter((p) => p.team_id === team.id)
        .sort((a, b) => (b.sold_at ?? "").localeCompare(a.sold_at ?? "")),
    [players, team.id],
  );

  const spent = myPlayers.reduce((sum, p) => sum + (p.sold_price ?? 0), 0);
  const remaining = team.budget_total - spent;
  const pct = Math.max(0, Math.min(100, (spent / team.budget_total) * 100));

  const isBlockMine = state?.current_bidder_team_id === team.id;
  const currentPlayer =
    state?.current_player_id &&
    players.find((p) => p.id === state.current_player_id);

  const accent = team.color ?? "#1e3a8a";

  return (
    <div className="space-y-4">
      {/* Hero — text color auto-contrasts with the team color */}
      <div
        className="overflow-hidden rounded-xl border-4 shadow-lg"
        style={{
          borderColor: accent,
          background: accent,
          color: contrastText(accent),
        }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">
                {team.short_name ?? "TEAM"}
              </p>
              <h1 className="text-3xl font-black sm:text-4xl">{team.name}</h1>
              {team.owner_name && (
                <p className="text-sm opacity-90">
                  Owner: {team.owner_name}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider opacity-80">
                Points left
              </p>
              <p className="text-4xl font-black tabular-nums sm:text-5xl">
                ₹{inr(remaining)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs opacity-90">
              <span>
                Spent ₹{inr(spent)} of ₹{inr(team.budget_total)}
              </span>
              <span>
                {myPlayers.length} player{myPlayers.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full"
                style={{ width: `${pct}%`, background: contrastText(accent) }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* "Bidding now" alert if this team is currently the high bidder */}
      {isBlockMine && currentPlayer && (
        <div className="flex items-center gap-3 rounded-md border-2 border-secondary bg-secondary/20 p-3">
          {currentPlayer.profile_picture_url && (
            <Image
              src={currentPlayer.profile_picture_url}
              alt={currentPlayer.full_name}
              width={56}
              height={56}
              className="h-14 w-14 rounded-md bg-white object-contain"
            />
          )}
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-cricket-pitch">
              You are the high bidder
            </p>
            <p className="font-semibold">{currentPlayer.full_name}</p>
          </div>
          <p className="text-2xl font-black text-cricket-pitch">
            ₹{inr(state.current_bid)}
          </p>
        </div>
      )}

      {/* Roster */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-base font-bold text-cricket-pitch">
            Your squad
          </h2>
          <p className="text-xs text-muted-foreground">
            Updates live as you buy players in the auction.
          </p>
        </div>
        <div className="divide-y">
          {myPlayers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No players bought yet. Your roster will appear here as the auction
              proceeds.
            </p>
          ) : (
            myPlayers.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/40"
              >
                <span className="w-6 text-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                {p.profile_picture_url ? (
                  <Image
                    src={p.profile_picture_url}
                    alt={p.full_name}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-md bg-muted object-contain"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.role} · {p.city}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-bold tabular-nums text-emerald-700">
                    ₹{inr(p.sold_price ?? 0)}
                  </p>
                  {p.sold_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(p.sold_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {myPlayers.length > 0 && (
          <div className="flex justify-between border-t bg-muted/30 px-4 py-2 text-sm font-semibold">
            <span>Total spent</span>
            <span className="font-mono tabular-nums text-emerald-700">
              ₹{inr(spent)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
