"use client";

import * as React from "react";

// Deterministic color from a name — same player always gets the same tile hue
const PALETTE = [
  "from-cricket-pitch to-blue-800",
  "from-emerald-600 to-green-800",
  "from-saffron to-amber-600",
  "from-purple-600 to-purple-800",
  "from-rose-600 to-pink-800",
  "from-cyan-600 to-cyan-800",
  "from-india-jersey to-blue-900",
  "from-indigo-600 to-indigo-800",
];

function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

/**
 * Player photo with a colored-initials fallback.
 *
 * Uses a plain <img> (not Next.js Image) so we skip the /_next/image proxy
 * — Vercel's free-tier image optimization quota is finite and once exhausted
 * returns HTTP 402 for every player photo, breaking the entire site.
 *
 * If the src is missing or errors, we render a gradient tile with the
 * player's initials — same visual language everywhere.
 */
export function PlayerAvatar({
  src,
  name,
  className,
  style,
}: {
  src: string | null | undefined;
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = React.useState(false);
  const hasSrc = Boolean(src) && !failed;

  if (!hasSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br font-black text-white ${colorFor(
          name,
        )} ${className ?? ""}`}
        style={style}
        aria-label={name}
      >
        <span className="tracking-tight" style={{ fontSize: "40%" }}>
          {initials(name)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src!}
      alt={name}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
