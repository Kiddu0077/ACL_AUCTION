"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/browser";
import { contrastText } from "@/lib/utils";
import type { Team } from "@/lib/types/database";

export function PublicPools({ initialTeams }: { initialTeams: Team[] }) {
  const [teams, setTeams] = React.useState(initialTeams);

  // Live updates if the admin tweaks pools
  React.useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("pools-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const u = payload.new as Team;
            setTeams((prev) => prev.map((t) => (t.id === u.id ? u : t)));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const poolA = teams.filter((t) => t.pool === "A");
  const poolB = teams.filter((t) => t.pool === "B");
  const drawn = poolA.length > 0 || poolB.length > 0;

  if (!drawn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-white p-10 text-center shadow-sm">
        <div className="text-6xl">🎲</div>
        <h2 className="text-2xl font-bold text-cricket-pitch sm:text-3xl">
          Pool draw pending
        </h2>
        <p className="text-base text-muted-foreground">
          The group-stage pools haven&apos;t been drawn yet. Check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <PoolCard label="Pool A" accent="#0ea5e9" teams={poolA} />
      <PoolCard label="Pool B" accent="#ef4444" teams={poolB} />
    </div>
  );
}

function PoolCard({
  label,
  accent,
  teams,
}: {
  label: string;
  accent: string;
  teams: Team[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 bg-white shadow-xl">
      <div
        className="px-5 py-3"
        style={{ background: accent, color: contrastText(accent) }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-wider sm:text-2xl">
            {label}
          </h2>
          <span className="rounded-full bg-black/20 px-3 py-0.5 text-sm font-semibold">
            {teams.length} teams
          </span>
        </div>
      </div>
      <ol className="space-y-1.5 p-3 sm:p-4">
        {teams.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition hover:bg-muted/40 sm:p-3"
            style={{
              borderLeftColor: t.color ?? "#1e3a8a",
              borderLeftWidth: 6,
            }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-bold sm:text-base">
                {t.name}
              </p>
              {t.owner_name && (
                <p className="truncate text-xs text-muted-foreground">
                  {t.owner_name}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
