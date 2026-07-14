import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Gavel,
  Layers,
  ListChecks,
  ShieldCheck,
  Trophy,
  UserPlus,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TOURNAMENT_DATE = "15 & 16 August";

// ── Iconography ───────────────────────────────────────────────────────────────

function AshokaChakra({ className }: { className?: string }) {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = ((i * 15 - 90) * Math.PI) / 180;
    const x1 = 50 + Math.cos(angle) * 9;
    const y1 = 50 + Math.sin(angle) * 9;
    const x2 = 50 + Math.cos(angle) * 44;
    const y2 = 50 + Math.sin(angle) * 44;
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    );
  });
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle cx="50" cy="50" r="7" fill="currentColor" />
      {spokes}
    </svg>
  );
}

function CricketBallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.95" />
      <path d="M3.5 9.5 Q12 8 20.5 9.5" stroke="white" strokeDasharray="1 2" />
      <path d="M3.5 14.5 Q12 16 20.5 14.5" stroke="white" strokeDasharray="1 2" />
    </svg>
  );
}

function CricketBatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 4 L20 8 L10 18 Q8 20 6 18 Q4 16 6 14 Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M16 4 L20 8" stroke="currentColor" />
      <line x1="16" y1="4" x2="22" y2="-2" strokeWidth="2" />
    </svg>
  );
}

// ── Landing page ───────────────────────────────────────────────────────────────

export default async function Home() {
  const tournament =
    process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "Cricket League";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-cricket-pitch to-blue-950 text-white">
      {/* Tricolor stripe running across the top — subtle celebration */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-saffron via-white to-india-green" />

      {/* Small admin link — top right */}
      <div className="absolute right-3 top-6 z-20 sm:right-5 sm:top-8">
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-blue-100/80 backdrop-blur transition hover:bg-white/15 hover:text-white"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin
        </Link>
      </div>

      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_2px_2px,white_1px,transparent_0)] [background-size:40px_40px]" />
        <div className="absolute -top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-saffron/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-india-green/15 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />

        {/* Ashoka Chakra decoration — slowly rotates */}
        <AshokaChakra
          className="absolute -right-16 top-16 h-56 w-56 animate-[spin_60s_linear_infinite] text-white/10 sm:right-8 sm:top-24 sm:h-72 sm:w-72"
        />
        <AshokaChakra
          className="absolute -left-24 bottom-16 h-64 w-64 animate-[spin_90s_linear_infinite_reverse] text-white/[0.06] sm:left-4 sm:bottom-24 sm:h-80 sm:w-80"
        />

        {/* Cricket iconography */}
        <CricketBallIcon className="absolute right-8 top-1/3 h-10 w-10 text-saffron/70 sm:right-16 sm:h-14 sm:w-14" />
        <CricketBatIcon className="absolute -left-2 top-1/4 h-14 w-14 -rotate-12 text-india-green/50 sm:left-10 sm:h-20 sm:w-20" />
        <Trophy className="absolute bottom-40 right-10 h-12 w-12 text-saffron/50 sm:h-16 sm:w-16" />
      </div>

      <div className="container relative z-10 mx-auto max-w-6xl px-4 py-12 sm:py-16">
        {/* Status pill — tricolor themed */}
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white ring-1 ring-white/20 backdrop-blur">
            <span className="flex h-2 w-2 rounded-full bg-saffron" />
            <span className="flex h-2 w-2 rounded-full bg-white" />
            <span className="flex h-2 w-2 rounded-full bg-india-green" />
            <span className="ml-1">Registration open</span>
          </span>
        </div>

        {/* Hero title — tricolor gradient */}
        <header className="text-center">
          <h1 className="bg-gradient-to-r from-saffron via-white to-india-green bg-clip-text text-4xl font-black uppercase leading-tight tracking-tight text-transparent drop-shadow-2xl sm:text-6xl md:text-7xl lg:text-8xl">
            {tournament}
          </h1>

          {/* Date badge with Ashoka Chakra */}
          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-5 py-2 backdrop-blur">
              <AshokaChakra className="h-5 w-5 text-chakra-blue" />
              <Calendar className="h-4 w-4 text-saffron" />
              <span className="text-sm font-bold uppercase tracking-wider text-white sm:text-base">
                {TOURNAMENT_DATE}
              </span>
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-base italic text-blue-100/80 sm:text-lg md:text-xl">
            &ldquo;In the spirit of the Tricolor — where every run is a
            heartbeat, every wicket a nation cheering.&rdquo;
          </p>
        </header>

        {/* ── TRICOLOR DIVIDER ─────────────────────────────────────── */}
        <div className="mt-14 flex justify-center gap-1.5 sm:mt-16">
          <span className="h-1.5 w-12 rounded-full bg-saffron shadow-lg shadow-saffron/50" />
          <span className="h-1.5 w-12 rounded-full bg-white shadow-lg shadow-white/50" />
          <span className="h-1.5 w-12 rounded-full bg-india-green shadow-lg shadow-india-green/50" />
        </div>

        {/* ── ACTION CARDS ─────────────────────────────────────────── */}
        <section className="mt-14 sm:mt-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <ActionCard
              href="/register"
              primary
              icon={<UserPlus className="h-6 w-6" />}
              title="Register as Player"
              subtitle="Join the pool for the ICL auction"
              cta="Register now"
            />
            <ActionCard
              href="/players"
              icon={<ListChecks className="h-6 w-6" />}
              title="Players List"
              subtitle="Browse the full pool"
              cta="View players"
            />
            <ActionCard
              href="/auction"
              icon={<Gavel className="h-6 w-6" />}
              title="Live Auction Board"
              subtitle="Watch bids unfold in real time"
              cta="Open the board"
            />
            <ActionCard
              href="/teams"
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Team Squads"
              subtitle="Every team's players and captains"
              cta="View squads"
            />
            <ActionCard
              href="/pools"
              icon={<Layers className="h-6 w-6" />}
              title="Group Pools"
              subtitle="Pool A and Pool B draw"
              cta="View pools"
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-blue-200/60">
          <div className="mb-3 flex justify-center gap-1">
            <span className="h-1 w-8 bg-saffron rounded-full" />
            <span className="h-1 w-8 bg-white rounded-full" />
            <span className="h-1 w-8 bg-india-green rounded-full" />
          </div>
          <p>
            © {new Date().getFullYear()} {tournament} · Independence Day 🇮🇳
          </p>
          <p className="mt-1">
            Built from{" "}
            <span className="font-semibold text-blue-200">
              Praveen&apos;s Air
            </span>
          </p>
        </footer>
      </div>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  cta,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-xl border p-5 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-2xl ${
        primary
          ? "border-saffron bg-gradient-to-br from-saffron to-amber-500 text-cricket-pitch hover:brightness-105"
          : "border-white/10 bg-white/5 text-white hover:bg-white/10"
      }`}
    >
      <div
        className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg ${
          primary
            ? "bg-cricket-pitch text-saffron"
            : "bg-white/10 text-saffron"
        }`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p
        className={`mt-1 text-sm ${
          primary ? "text-cricket-pitch/80" : "text-blue-100/80"
        }`}
      >
        {subtitle}
      </p>
      <div className="mt-4 flex items-center gap-1 text-sm font-semibold">
        {cta}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
