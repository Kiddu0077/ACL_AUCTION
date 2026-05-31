"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Plus, Trash2, ArrowRightLeft, IndianRupee } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { AddIconPlayerDialog } from "@/components/admin/add-icon-player-dialog";
import { contrastText } from "@/lib/utils";
import {
  forceAssignPlayer,
  removeFromTeam,
  transferPlayer,
  editSoldPrice,
} from "@/app/admin/auction-actions";
import type { Player, Team } from "@/lib/types/database";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function SquadManager({
  teams,
  players,
}: {
  teams: Team[];
  players: Player[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(label: string, fn: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.error) {
        toast({ variant: "destructive", title: label, description: r.error });
      } else {
        toast({ variant: "success", title: label });
        router.refresh();
      }
    });
  }

  const available = players
    .filter((p) => p.status !== "Rejected" && !p.team_id)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="space-y-6">
      {pending && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md bg-cricket-pitch px-3 py-2 text-sm text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" /> Saving…
        </div>
      )}

      {teams.map((team) => {
        const squad = players
          .filter((p) => p.team_id === team.id)
          .sort((a, b) => (b.sold_at ?? "").localeCompare(a.sold_at ?? ""));
        const spent = squad.reduce((sum, p) => sum + (p.sold_price ?? 0), 0);
        const remaining = team.budget_total - spent;
        const accent = team.color ?? "#1e3a8a";

        return (
          <Card key={team.id} className="overflow-hidden">
            <CardHeader
              className="flex-row items-center justify-between gap-2 space-y-0 py-3"
              style={{ background: accent, color: contrastText(accent) }}
            >
              <CardTitle className="text-base">{team.name}</CardTitle>
              <div className="text-right text-xs font-semibold">
                {squad.length}/{team.squad_size} players · ₹{inr(spent)} spent ·
                ₹{inr(remaining)} left
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {squad.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No players yet.
                </p>
              ) : (
                squad.map((p) => (
                  <SquadRow
                    key={p.id}
                    player={p}
                    teams={teams}
                    pending={pending}
                    onEditPrice={(price) =>
                      run("Price updated", () => editSoldPrice(p.id, price))
                    }
                    onRemove={() =>
                      run(`Removed ${p.full_name}`, () => removeFromTeam(p.id))
                    }
                    onTransfer={(toTeamId) =>
                      run("Transferred", () => transferPlayer(p.id, toTeamId))
                    }
                  />
                ))
              )}

              {/* Force-assign control */}
              <AssignRow
                available={available}
                basePrice={0}
                pending={pending}
                onAssign={(playerId, price) =>
                  run("Player assigned", () =>
                    forceAssignPlayer(playerId, team.id, price),
                  )
                }
              />

              {/* Add a brand-new icon player (not from registration) */}
              <div className="flex justify-end">
                <AddIconPlayerDialog team={team} />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {teams.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          No teams yet. Add teams first in{" "}
          <a href="/admin/teams" className="font-medium text-primary underline">
            Teams
          </a>
          .
        </p>
      )}
    </div>
  );
}

function SquadRow({
  player,
  teams,
  pending,
  onEditPrice,
  onRemove,
  onTransfer,
}: {
  player: Player;
  teams: Team[];
  pending: boolean;
  onEditPrice: (price: number) => void;
  onRemove: () => void;
  onTransfer: (toTeamId: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [price, setPrice] = React.useState(String(player.sold_price ?? 0));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
      {player.profile_picture_url ? (
        <Image
          src={player.profile_picture_url}
          alt={player.full_name}
          width={36}
          height={36}
          className="h-9 w-9 rounded bg-muted object-contain"
        />
      ) : (
        <div className="h-9 w-9 rounded bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{player.full_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {player.role} · {player.city}
        </p>
      </div>

      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-8 w-24"
          />
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              onEditPrice(Number(price));
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            ✕
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
          title="Edit price"
        >
          <IndianRupee className="h-3 w-3" />
          {inr(player.sold_price ?? 0)}
        </button>
      )}

      {/* Transfer dropdown */}
      <select
        defaultValue=""
        disabled={pending}
        onChange={(e) => {
          if (e.target.value) {
            onTransfer(e.target.value);
            e.target.value = "";
          }
        }}
        className="h-8 rounded-md border border-input bg-background px-1.5 text-xs"
        title="Transfer to another team"
      >
        <option value="">
          ⇄ Move…
        </option>
        {teams
          .filter((t) => t.id !== player.team_id)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </select>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={pending}
        onClick={onRemove}
        title="Remove from team (back to pool)"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AssignRow({
  available,
  basePrice,
  pending,
  onAssign,
}: {
  available: Player[];
  basePrice: number;
  pending: boolean;
  onAssign: (playerId: string, price: number) => void;
}) {
  const [playerId, setPlayerId] = React.useState("");
  const [price, setPrice] = React.useState(String(basePrice));

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border bg-muted/30 p-2">
      <div className="flex-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Add a player to this team
        </label>
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Choose available player…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} ({p.role} · {p.city})
            </option>
          ))}
        </select>
      </div>
      <Input
        type="number"
        min={0}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Price"
        className="h-9 w-24"
      />
      <Button
        size="sm"
        disabled={pending || !playerId}
        onClick={() => {
          if (!playerId) return;
          onAssign(playerId, Number(price) || 0);
          setPlayerId("");
          setPrice(String(basePrice));
        }}
      >
        <Plus className="h-4 w-4" /> Assign
      </Button>
    </div>
  );
}
