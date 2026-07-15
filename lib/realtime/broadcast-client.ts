"use client";

/**
 * Small helper for firing broadcasts from admin components (AuctionLifecycle,
 * RestartAuctionButton, etc.) that don't have direct access to the cockpit's
 * broadcast channel.
 *
 * We reuse a single channel per browser tab (module-cached) so repeated calls
 * don't churn WebSocket connections.
 *
 * Events emitted:
 *   - "state"  : { state } — public board setState directly
 *   - "reload" : {}         — public board re-fetches all state from DB.
 *                              Use after bulk mutations (Restart, Re-pool) where
 *                              Supabase Realtime may drop individual UPDATE
 *                              events under rate-limiting.
 */

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { AUCTION_CHANNEL } from "@/lib/realtime/broadcast";
import type { AuctionState } from "@/lib/types/database";

let channel: RealtimeChannel | null = null;
let subscribing = false;

function getChannel(): RealtimeChannel {
  if (channel) return channel;
  const supabase = createClient();
  channel = supabase.channel(AUCTION_CHANNEL, {
    config: { broadcast: { self: false } },
  });
  if (!subscribing) {
    subscribing = true;
    channel.subscribe();
  }
  return channel;
}

export function broadcastAuctionState(state: AuctionState) {
  try {
    getChannel().send({
      type: "broadcast",
      event: "state",
      payload: { state },
    });
  } catch {
    // Best-effort — the postgres_changes fallback will still catch it.
  }
}

export function broadcastReload() {
  try {
    getChannel().send({
      type: "broadcast",
      event: "reload",
      payload: { ts: 0 }, // recipient re-fetches; payload content not used
    });
  } catch {
    // Best-effort — the postgres_changes fallback will still catch it.
  }
}
