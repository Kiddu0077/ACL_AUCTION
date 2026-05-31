"use client";

/**
 * Auction broadcast channel — peer-to-peer updates between the admin cockpit
 * and any public displays (live auction board, team manager pages).
 *
 * Why this exists alongside postgres_changes:
 *   • postgres_changes goes admin → server action → Supabase WAL → realtime
 *     publisher → subscribers. Reliable but adds 200-500ms of latency.
 *   • This broadcast goes admin browser → Supabase realtime → subscribers
 *     directly. Sub-100ms. Doesn't touch the database.
 *
 * The DB write still happens in the admin's server action so state is
 * durable; the broadcast just gets the visual update there faster.
 *
 * Trust model: anyone with the page can technically send. Public board
 * never sends, only listens, so worst case a malicious sender produces
 * a transient flash that the next real postgres_changes event overrides.
 */

import type { AuctionState, Player } from "@/lib/types/database";

export const AUCTION_CHANNEL = "auction-broadcast";

export type AuctionBroadcastEvent =
  | {
      type: "state";
      state: AuctionState;
    }
  | {
      type: "player";
      player: Player;
    };
