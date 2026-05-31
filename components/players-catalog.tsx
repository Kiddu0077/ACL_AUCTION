"use client";

import * as React from "react";
import Image from "next/image";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/browser";
import { AUCTION_CHANNEL } from "@/lib/realtime/broadcast";
import { contrastText } from "@/lib/utils";
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
  const teams = initialTeams;
  const [players, setPlayers] = React.useState(initialPlayers);
  const [state, setState] = React.useState(initialState);
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState<RoleFilter>("all");
  const [avail, setAvail] = React.useState<AvailFilter>("all");

  // Live updates
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
      .subscribe();

    const pg = supabase
      .channel("players-catalog")
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
      supabase.removeChannel(pg);
    };
  }, []);

  const teamById = React.useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => p.status !== "Rejected")
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
    const pool = players.filter((p) => p.status !== "Rejected");
    return {
      total: pool.length,
      available: pool.filter((p) => !p.sold_at && !p.team_id).length,
      sold: pool.filter((p) => p.team_id).length,
      unsold: pool.filter((p) => p.sold_at && !p.team_id).length,
    };
  }, [players]);

  return (
    <div className="space-y-4">
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
            className="h-10 pl-8"
          />
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
          <SelectTrigger className="h-10 w-full sm:w-40">
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
          <SelectTrigger className="h-10 w-full sm:w-40">
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
                  <Image
                    src={p.profile_picture_url}
                    alt={p.full_name}
                    fill
                    sizes="(max-width:640px) 50vw, 20vw"
                    className="object-contain"
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
        <p className="py-12 text-center text-muted-foreground">
          No players match your filters.
        </p>
      )}
    </div>
  );
}
