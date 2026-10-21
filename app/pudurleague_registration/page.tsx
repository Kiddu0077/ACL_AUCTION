import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Trophy } from "lucide-react";

import { RegistrationForm } from "@/components/registration-form";
import { TOURNAMENT_NAME } from "@/lib/tournament";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-[#f4f2e8] text-[#12352b]">
      <header className="border-b border-[#12352b]/10">
        <div className="container flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-3 font-bold tracking-tight">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#12352b] text-[#d8ef87]">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="max-w-40 text-sm leading-tight sm:max-w-none sm:text-base">{TOURNAMENT_NAME}</span>
          </Link>
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition hover:bg-[#12352b]/5">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Home
          </Link>
        </div>
      </header>

      <div className="container grid max-w-6xl gap-6 px-5 py-6 sm:gap-10 sm:px-8 sm:py-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:py-20">
        <section className="lg:py-5" aria-labelledby="registration-heading">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#12352b]/15 bg-white/50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em]">
            <span className="h-2 w-2 rounded-full bg-[#467447]" aria-hidden="true" /> Registration open
          </span>
          <h1 id="registration-heading" className="mt-6 text-5xl font-black leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Pudur<br />Premier<br />
            <span className="relative inline-block mt-1 bg-[#d8ef87] px-2 pb-1">League</span>
          </h1>
          <p className="mt-5 text-lg font-bold tracking-tight sm:text-xl">Your next innings starts here.</p>
          <Link href="/players" className="mt-4 inline-flex items-center gap-2 text-sm font-bold underline decoration-[#12352b]/25 underline-offset-4 transition hover:decoration-[#12352b] sm:mt-6">
            Explore the player list <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <section className="self-start rounded-3xl border border-[#12352b]/10 bg-[#fffef9] p-6 shadow-[0_18px_70px_-35px_rgba(18,53,43,0.3)] sm:p-8" aria-labelledby="form-heading">
          <div className="mb-7 border-b border-[#12352b]/10 pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#12352b]/55">Player registration</p>
            <h2 id="form-heading" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Let’s get you on the list.</h2>
            <p className="mt-2 text-sm text-[#12352b]/65">All fields are required. One registration per player.</p>
          </div>
          <RegistrationForm />
        </section>
      </div>

      <footer className="border-t border-[#12352b]/10 px-5 py-6 text-center text-xs font-medium text-[#12352b]/55">
        {TOURNAMENT_NAME} · A fresh season of cricket.
      </footer>
    </main>
  );
}
