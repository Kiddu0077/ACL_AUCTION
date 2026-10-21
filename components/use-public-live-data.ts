"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/browser";
import { AUCTION_CHANNEL } from "@/lib/realtime/broadcast";
import { upsertLiveRow } from "@/lib/realtime/rows";
import { realtimeStatus, type ConnectionStatus } from "@/components/connection-indicator";
import type { AuctionState, Player, Team } from "@/lib/types/database";

export function usePublicLiveData({
  channelName,
  initialTeams,
  initialPlayers,
  initialState,
}: {
  channelName: string;
  initialTeams: Team[];
  initialPlayers?: Player[];
  initialState?: AuctionState | null;
}) {
  const [teams, setTeams] = React.useState(initialTeams);
  const [players, setPlayers] = React.useState(initialPlayers ?? []);
  const [state, setState] = React.useState(initialState ?? null);
  const [connection, setConnection] = React.useState<ConnectionStatus>("connecting");
  const [syncError, setSyncError] = React.useState(false);
  const withPlayers = initialPlayers !== undefined;
  const withState = initialState !== undefined;

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;
    let refreshing = false;
    let refreshAgain = false;
    let revision = 0;
    const controller = new AbortController();

    async function refresh() {
      if (!active || document.visibilityState === "hidden") return;
      if (refreshing) { refreshAgain = true; return; }
      refreshing = true;
      const startedAt = revision;
      const requestController = new AbortController();
      const abortRequest = () => requestController.abort();
      controller.signal.addEventListener("abort", abortRequest, { once: true });
      const timeout = window.setTimeout(abortRequest, 10_000);
      try {
        const [teamResult, playerResult, stateResult] = await Promise.all([
          supabase.from("teams").select("*").order("name").abortSignal(requestController.signal),
          withPlayers ? supabase.from("players").select("*").abortSignal(requestController.signal) : null,
          withState ? supabase.from("auction_state").select("*").eq("id", "current").abortSignal(requestController.signal).maybeSingle() : null,
        ]);
        if (!active) return;
        if (teamResult.error || playerResult?.error || stateResult?.error) {
          setSyncError(true);
          return;
        }
        // A row event that arrived while this snapshot was in flight wins.
        // Repeat once the request settles rather than reverting the screen.
        if (revision !== startedAt) { refreshAgain = true; return; }
        setTeams(teamResult.data ?? []);
        if (playerResult) setPlayers(playerResult.data ?? []);
        if (stateResult) setState(stateResult.data);
        setSyncError(false);
      } catch {
        if (active) setSyncError(true);
      } finally {
        window.clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abortRequest);
        refreshing = false;
        if (refreshAgain && active) { refreshAgain = false; void refresh(); }
      }
    }

    const channel = supabase.channel(channelName).on(
      "postgres_changes", { event: "*", schema: "public", table: "teams" }, (payload) => {
        revision++;
        if (payload.eventType === "DELETE") setTeams((rows) => rows.filter((row) => row.id !== payload.old.id));
        else setTeams((rows) => upsertLiveRow(rows, payload.new as Team));
      },
    );
    if (withPlayers) channel.on(
      "postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
        revision++;
        if (payload.eventType === "DELETE") setPlayers((rows) => rows.filter((row) => row.id !== payload.old.id));
        else setPlayers((rows) => upsertLiveRow(rows, payload.new as Player));
      },
    );
    if (withState) channel.on(
      "postgres_changes", { event: "*", schema: "public", table: "auction_state", filter: "id=eq.current" }, (payload) => {
        revision++;
        if (payload.eventType === "DELETE") setState(null);
        else setState((current) => current && Date.parse(current.updated_at) > Date.parse((payload.new as AuctionState).updated_at) ? current : payload.new as AuctionState);
      },
    );
    channel.subscribe((status) => {
      if (!active) return;
      setConnection(realtimeStatus(status));
      if (status === "SUBSCRIBED") void refresh();
    });
    // Broadcasts are public and unauthenticated. Use them only as refresh
    // hints; roster and purse values come from the database.
    const broadcast = supabase.channel(AUCTION_CHANNEL)
      .on("broadcast", { event: "reload" }, () => { revision++; void refresh(); })
      .subscribe();
    const recover = () => { void refresh(); };
    const offline = () => setConnection("disconnected");
    window.addEventListener("online", recover);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", recover);
    const poll = window.setInterval(recover, 30_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(poll);
      window.removeEventListener("online", recover);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", recover);
      void supabase.removeChannel(channel);
      void supabase.removeChannel(broadcast);
    };
  }, [channelName, withPlayers, withState]);

  const sortedTeams = React.useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  return { teams: sortedTeams, players, state, connection, syncError };
}
