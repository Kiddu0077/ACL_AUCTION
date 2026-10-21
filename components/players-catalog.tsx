"use client";

import * as React from "react";
import { PlayerAvatar } from "@/components/player-avatar";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePublicLiveData } from "@/components/use-public-live-data";
import { ConnectionIndicator } from "@/components/connection-indicator";
import { contrastText } from "@/lib/utils";
import { REGISTRATION_PATH } from "@/lib/tournament";
import type { AuctionState, Player, PlayerRole, Team } from "@/lib/types/database";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

type RoleFilter = "all" | PlayerRole;
type AvailFilter = "all" | "available" | "sold" | "unsold";

export function PlayersCatalog({
  initialPlayers,
  initialTeams,
  initialState,
}: {
  initialPlayers: Player[];
  initialTeams: Team[];
  initialState: AuctionState | null;
}) {
  const { teams, players, state, connection, syncError } = usePublicLiveData({
    channelName: "players-catalog", initialTeams, initialPlayers, initialState,
  });
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState<RoleFilter>("all");
  const [avail, setAvail] = React.useState<AvailFilter>("all");

  const teamById = React.useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => p.status !== "Rejected")
      // Icon players are pre-assigned marquee picks — not part of the
      // public auction pool. Hide them from this catalog entirely.
      .filter((p) => !p.is_icon)
      .filter((p) => (role === "all" ? true : p.role === role))
      .filter((p) => {
        if (avail === "available") return !p.sold_at && !p.team_id;
        if (avail === "sold") return !!p.team_id;
        if (avail === "unsold") return !!p.sold_at && !p.team_id;
        return true;
      })
      .filter((p) =>
        q ? `${p.full_name} ${p.city}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [players, query, role, avail]);

  const counts = React.useMemo(() => {
    // Also exclude icons here so the counters match the visible list
    const pool = players.filter(
      (p) => p.status !== "Rejected" && !p.is_icon,
    );
    return {
      total: pool.length,
      available: pool.filter((p) => !p.sold_at && !p.team_id).length,
      sold: pool.filter((p) => p.team_id).length,
      unsold: pool.filter((p) => p.sold_at && !p.team_id).length,
    };
  }, [players]);

  return (
    <div className="space-y-4">
      <ConnectionIndicator status={connection} />
      {syncError && <p role="status" className="text-sm text-amber-700">Latest updates are temporarily unavailable. Reconnecting automatically.</p>}
      {/* Summary chips */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Total", value: counts.total, tone: "bg-muted text-foreground" },
          { label: "Available", value: counts.available, tone: "bg-emerald-100 text-emerald-800" },
          { label: "Sold", value: counts.sold, tone: "bg-blue-100 text-blue-800" },
          { label: "Unsold", value: counts.unsold, tone: "bg-orange-100 text-orange-800" },
        ].map((c) => (
          <div key={c.label} className={`rounded-lg px-3 py-2 text-center ${c.tone}`}>
            <div className="text-xl font-black tabular-nums sm:text-2xl">
              {c.value}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or city…"
            aria-label="Search players by name or city"
            className="h-10 pl-8"
          />
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
          <SelectTrigger aria-label="Filter by playing role" className="h-10 w-full sm:w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="Batsman">Batsman</SelectItem>
            <SelectItem value="Bowler">Bowler</SelectItem>
            <SelectItem value="All-rounder">All-rounder</SelectItem>
          </SelectContent>
        </Select>
        <Select value={avail} onValueChange={(v) => setAvail(v as AvailFilter)}>
          <SelectTrigger aria-label="Filter by auction status" className="h-10 w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All players</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="unsold">Unsold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {visible.length} of {counts.total} players
      </p>

      {/* Grid of player cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((p) => {
          const onBlock = state?.current_player_id === p.id;
          const team = p.team_id ? teamById.get(p.team_id) : null;
          return (
            <div
              key={p.id}
              className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                onBlock ? "ring-2 ring-secondary" : ""
              }`}
            >
              <div className="relative aspect-square bg-muted">
                {p.profile_picture_url ? (
                  <PlayerAvatar
                    src={p.profile_picture_url}
                    name={p.full_name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No photo
                  </div>
                )}
                {onBlock && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-black uppercase text-secondary-foreground">
                    On block
                  </span>
                )}
                {p.is_icon && (
                  <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded bg-gradient-to-r from-yellow-400 to-amber-500 px-1.5 py-0.5 text-[10px] font-black uppercase text-cricket-pitch shadow-md">
                    ★ Icon
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-bold leading-tight">
                  {p.full_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.role} · {p.city}
                </p>
                {/* Status line */}
                {team ? (
                  <div
                    className="mt-1.5 truncate rounded px-1.5 py-0.5 text-[11px] font-bold"
                    style={{
                      background: team.color ?? "#1e3a8a",
                      color: contrastText(team.color),
                    }}
                  >
                    {team.name} · ₹{inr(p.sold_price ?? 0)}
                  </div>
                ) : p.sold_at ? (
                  <div className="mt-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-800">
                    Unsold
                  </div>
                ) : (
                  <div className="mt-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    Available
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <h2 className="text-xl font-bold text-foreground">
            {players.length === 0 ? "A new season starts with you." : "No players match your filters."}
          </h2>
          {players.length === 0 && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">Player registration is open. Be part of the first squad of new talent.</p>
              <Link href={REGISTRATION_PATH} className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90">Register as a player</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
