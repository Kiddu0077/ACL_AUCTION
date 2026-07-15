"use client";

import * as React from "react";
import Image from "next/image";
import { Phone, MessageCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/browser";
import { AUCTION_CHANNEL } from "@/lib/realtime/broadcast";
import { contrastText } from "@/lib/utils";
import type { AuctionState, Player, Team } from "@/lib/types/database";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

// Normalise an Indian phone number for WhatsApp / tel links.
function digits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}
function waNumber(phone: string) {
  const d = digits(phone);
  // If it's a bare 10-digit number, assume India (+91).
  if (d.length === 10) return `91${d}`;
  return d;
}

export function AllTeamsBoard({
  initialTeams,
  initialPlayers,
}: {
  initialTeams: Team[];
  initialPlayers: Player[];
}) {
  const teams = initialTeams;
  const [players, setPlayers] = React.useState(initialPlayers);

  // Live updates so the page reflects the auction as it completes.
  React.useEffect(() => {
    const supabase = createClient();

    const broadcast = supabase
      .channel(AUCTION_CHANNEL)
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
        const { data } = await supabase.from("players").select("*");
        if (data) setPlayers(data as Player[]);
      })
      .subscribe();

    const pgChanges = supabase
      .channel("all-teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const u = payload.new as Player;
            setPlayers((prev) =>
              prev.map((p) => (p.id === u.id ? u : p)),
            );
          } else if (payload.eventType === "INSERT" && payload.new) {
            setPlayers((prev) => [...prev, payload.new as Player]);
          } else if (payload.eventType === "DELETE" && payload.old) {
            const id = (payload.old as { id?: string }).id;
            if (id) setPlayers((prev) => prev.filter((p) => p.id !== id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcast);
      supabase.removeChannel(pgChanges);
    };
  }, []);

  const byTeam = React.useMemo(() => {
    const m = new Map<string, Player[]>();
    for (const p of players) {
      if (!p.team_id) continue;
      const arr = m.get(p.team_id) ?? [];
      arr.push(p);
      m.set(p.team_id, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0));
    }
    return m;
  }, [players]);

  const unsold = React.useMemo(
    () =>
      players
        .filter((p) => !p.team_id && p.status !== "Rejected")
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [players],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => {
          const roster = byTeam.get(t.id) ?? [];
          const spent = roster.reduce((s, p) => s + (p.sold_price ?? 0), 0);
          const remaining = t.budget_total - spent;
          const accent = t.color ?? "#1e3a8a";
          const fg = contrastText(accent);
          return (
            <div
              key={t.id}
              className="overflow-hidden rounded-xl border bg-white shadow-md"
            >
              {/* Team header */}
              <div
                className="p-4"
                style={{ background: accent, color: fg }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      {t.short_name ?? "TEAM"}
                    </p>
                    <h2 className="truncate text-xl font-black">{t.name}</h2>
                    {t.owner_name && (
                      <p className="text-xs opacity-90">Owner: {t.owner_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black tabular-nums">
                      {roster.length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider opacity-80">
                      players
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex justify-between text-[11px] font-semibold tabular-nums opacity-90">
                  <span>Spent ₹{inr(spent)}</span>
                  <span>₹{inr(remaining)} left</span>
                </div>
              </div>

              {/* Roster */}
              <ul className="divide-y">
                {roster.length === 0 ? (
                  <li className="p-5 text-center text-sm text-muted-foreground">
                    No players yet.
                  </li>
                ) : (
                  roster.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/40"
                    >
                      <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      {p.profile_picture_url ? (
                        <Image
                          src={p.profile_picture_url}
                          alt={p.full_name}
                          width={40}
                          height={40}
                          className="h-10 w-10 flex-shrink-0 rounded-md bg-muted object-contain"
                        />
                      ) : (
                        <div className="h-10 w-10 flex-shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold leading-tight">
                          {p.full_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.role} · {p.city}
                          {p.sold_price != null && (
                            <span className="ml-1 font-semibold text-emerald-700">
                              · ₹{inr(p.sold_price)}
                            </span>
                          )}
                        </p>
                        {/* Selectable phone number — long-press / select to copy */}
                        {p.phone ? (
                          <p className="mt-0.5 select-all font-mono text-xs font-medium text-foreground">
                            {p.phone}
                          </p>
                        ) : p.is_icon ? (
                          <p className="mt-0.5 text-xs font-semibold text-secondary">
                            ★ Icon player
                          </p>
                        ) : null}
                      </div>
                      {/* Contact actions — only when there's a phone */}
                      {p.phone && (
                        <div className="flex flex-shrink-0 gap-1">
                          <a
                            href={`tel:${p.phone}`}
                            aria-label={`Call ${p.full_name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-primary transition hover:bg-primary hover:text-white"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <a
                            href={`https://wa.me/${waNumber(p.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`WhatsApp ${p.full_name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-emerald-600 transition hover:bg-emerald-600 hover:text-white"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Unsold / unassigned players */}
      {unsold.length > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-md">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">
            Not in any team ({unsold.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {unsold.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
              >
                {p.full_name}
                <span className="text-muted-foreground">· {p.role}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {teams.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          No teams set up yet.
        </p>
      )}
    </div>
  );
}
