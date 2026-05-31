import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Gavel,
  ListChecks,
  ShieldCheck,
  Trophy,
  UserPlus,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TOURNAMENT_DATE = "13 & 14 June";

// Simple inline cricket-themed SVGs — keeps everything self-contained.
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
      <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" opacity="0.95" />
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
      <path d="M16 4 L20 8 L10 18 Q8 20 6 18 Q4 16 6 14 Z" fill="currentColor" opacity="0.9" />
      <path d="M16 4 L20 8" stroke="currentColor" />
      <line x1="16" y1="4" x2="22" y2="-2" strokeWidth="2" />
    </svg>
  );
}

export default async function Home() {
  const tournament =
    process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "Cricket League";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-cricket-pitch via-blue-900 to-slate-950 text-white">
      {/* Decorative background — cricket pitch markings + dot grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_2px_2px,white_1px,transparent_0)] [background-size:40px_40px]" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
        {/* Floating decorative cricket icons */}
        <CricketBallIcon className="absolute right-6 top-24 h-10 w-10 text-red-500/60 sm:right-12 sm:top-32 sm:h-16 sm:w-16" />
        <CricketBatIcon className="absolute -left-2 top-1/3 h-16 w-16 -rotate-12 text-secondary/40 sm:left-8 sm:h-24 sm:w-24" />
        <Trophy className="absolute bottom-32 right-8 h-12 w-12 text-secondary/40 sm:h-20 sm:w-20" />
      </div>

      {/* Small admin link — top right, low-key since only the organiser uses it */}
      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-5">
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-blue-100/80 backdrop-blur transition hover:bg-white/15 hover:text-white"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin
        </Link>
      </div>

      <div className="container relative z-10 mx-auto max-w-5xl px-4 py-10 sm:py-16">
        {/* Status pill */}
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent ring-1 ring-accent/40 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Registration open
          </span>
        </div>

        {/* Hero title */}
        <header className="text-center">
          <h1 className="bg-gradient-to-b from-white to-blue-200 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent sm:text-6xl md:text-7xl">
            {tournament}
          </h1>

          {/* Date badge */}
          <div className="mt-5 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/15 px-4 py-2 backdrop-blur">
              <Calendar className="h-4 w-4 text-secondary" />
              <span className="text-sm font-bold uppercase tracking-wider text-secondary sm:text-base">
                {TOURNAMENT_DATE}
              </span>
            </div>
          </div>

          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-blue-100/90 sm:text-lg">
            Register, get drafted in the live auction, and play the season.
            Built for players, captains, and the auction night.
          </p>
        </header>

        {/* Action cards */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            href="/register"
            primary
            icon={<UserPlus className="h-6 w-6" />}
            title="Register as Player"
            subtitle="Join the player pool for the upcoming auction"
            cta="Register now"
          />
          <ActionCard
            href="/players"
            icon={<ListChecks className="h-6 w-6" />}
            title="Players List"
            subtitle="Browse the full pool & plan your picks"
            cta="View players"
          />
          <ActionCard
            href="/auction"
            icon={<Gavel className="h-6 w-6" />}
            title="Live Auction Board"
            subtitle="Watch the auction unfold in real time"
            cta="Open the board"
          />
          <ActionCard
            href="/teams"
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Team Squads"
            subtitle="See every team's players and contacts"
            cta="View squads"
          />
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-blue-200/60">
          <p>
            © {new Date().getFullYear()} {tournament}
          </p>
          <p className="mt-1">
            Built from{" "}
            <span className="font-semibold text-blue-200">Praveen&apos;s Air</span>
          </p>
        </footer>
      </div>
    </main>
  );
}

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
      className={`group relative flex flex-col rounded-xl border p-5 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-2xl ${
        primary
          ? "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/95"
          : "border-white/10 bg-white/5 text-white hover:bg-white/10"
      }`}
    >
      <div
        className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg ${
          primary ? "bg-cricket-pitch text-secondary" : "bg-white/10 text-secondary"
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
