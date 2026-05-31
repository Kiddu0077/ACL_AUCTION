"use client";

import * as React from "react";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

/**
 * Tiny corner badge that surfaces the Supabase Realtime channel status.
 * Critical for live events on mobile hotspots — admin instantly sees if the
 * channel drops so they know updates aren't flowing.
 */
export function ConnectionIndicator({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const meta = {
    connected: {
      label: "Live",
      dot: "bg-emerald-500",
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
      pulse: false,
    },
    connecting: {
      label: "Reconnecting…",
      dot: "bg-yellow-500",
      bg: "bg-yellow-50 text-yellow-800 border-yellow-200",
      pulse: true,
    },
    disconnected: {
      label: "Offline — updates paused",
      dot: "bg-red-500",
      bg: "bg-red-50 text-red-800 border-red-200",
      pulse: true,
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${meta.bg} ${className ?? ""}`}
      title={
        status === "connected"
          ? "Realtime connected — bids and sales sync instantly"
          : status === "connecting"
            ? "Reconnecting to realtime — updates will resume shortly"
            : "Realtime disconnected. Refresh once network is back."
      }
    >
      <span className="relative flex h-2 w-2">
        {meta.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${meta.dot}`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${meta.dot}`}
        />
      </span>
      <span>{meta.label}</span>
    </span>
  );
}

/**
 * Hook that derives a ConnectionStatus from Supabase Realtime channel
 * status strings. Pass into channel.subscribe((status) => setRtStatus(status)).
 */
export function realtimeStatus(s: string | null | undefined): ConnectionStatus {
  if (s === "SUBSCRIBED") return "connected";
  if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED")
    return "disconnected";
  return "connecting";
}
