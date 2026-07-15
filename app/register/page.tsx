import Link from "next/link";
import { ArrowLeft, Layers, ListChecks, Lock, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const tournament =
    process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "ICL Cricket League";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-cricket-pitch to-blue-950 pb-16 text-white">
      {/* Tricolor stripe */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-saffron via-white to-india-green" />

      <header className="px-4 pb-2 pt-6">
        <div className="container max-w-lg">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-blue-200 hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" />
            Home
          </Link>
        </div>
      </header>

      <div className="container relative z-10 max-w-lg px-4 pt-6">
        <div className="rounded-2xl border-2 border-secondary/40 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 ring-2 ring-secondary/40">
            <Lock className="h-8 w-8 text-secondary" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            Registration closed
          </h1>
          <p className="mt-3 text-base text-blue-100/90">
            Player registration for{" "}
            <span className="font-semibold text-white">{tournament}</span> is
            now closed. Thank you to everyone who signed up.
          </p>
          <p className="mt-2 text-sm text-blue-200/80">
            Follow the auction live and see squads below.
          </p>

          <div className="mt-6 flex justify-center gap-1.5">
            <span className="h-1 w-8 rounded-full bg-saffron" />
            <span className="h-1 w-8 rounded-full bg-white" />
            <span className="h-1 w-8 rounded-full bg-india-green" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Link
              href="/players"
              className="flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              <ListChecks className="h-4 w-4" /> Players
            </Link>
            <Link
              href="/teams"
              className="flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              <ShieldCheck className="h-4 w-4" /> Squads
            </Link>
            <Link
              href="/pools"
              className="flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              <Layers className="h-4 w-4" /> Pools
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
