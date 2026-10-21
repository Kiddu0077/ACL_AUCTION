import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Gavel, Layers, ShieldCheck, Trophy, Users } from "lucide-react";
import { REGISTRATION_PATH, TOURNAMENT_NAME } from "@/lib/tournament";

const explore = [
  { href: "/players", icon: Users, number: "01", title: "The player pool", description: "Meet the talent stepping up for the new season.", label: "Explore players" },
  { href: "/auction", icon: Gavel, number: "02", title: "The live auction", description: "Follow every bid as the teams take shape.", label: "View auction" },
  { href: "/teams", icon: ShieldCheck, number: "03", title: "The team squads", description: "Find your team. Get to know your next favourites.", label: "See the squads" },
  { href: "/pools", icon: Layers, number: "04", title: "The group draw", description: "See who lines up in Pool A and Pool B.", label: "View pools" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f5ed] text-[#103c32]">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" aria-label={`${TOURNAMENT_NAME} home`} className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#103c32] text-[#d7f568]"><Trophy className="h-6 w-6" strokeWidth={1.7} /></span>
          <span className="text-sm font-extrabold leading-tight tracking-tight sm:text-base">Pudur<br /><span className="font-medium">Premier League</span></span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm font-semibold sm:gap-7">
          <Link className="hidden transition hover:text-emerald-700 sm:block" href="/players">Players</Link>
          <Link className="hidden transition hover:text-emerald-700 sm:block" href="/teams">Teams</Link>
          <Link className="inline-flex items-center gap-1.5 text-[#52645b] transition hover:text-[#103c32]" href="/admin/login"><ShieldCheck className="h-4 w-4" /> Admin</Link>
        </nav>
      </header>

      <section className="relative mx-3 overflow-hidden rounded-[1.75rem] bg-[#103c32] text-[#f6f5ed] sm:mx-5 sm:rounded-[2.5rem]">
        <div className="pitch-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.12fr_1fr] lg:gap-10 lg:py-20">
          <div>
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[#d7f568]/25 bg-[#d7f568]/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.17em] text-[#d7f568]">
              <span className="h-2 w-2 rounded-full bg-[#d7f568]" /> Player registration is open
            </div>
            <h1 className="font-display text-[clamp(3.4rem,7.6vw,7rem)] uppercase leading-[0.94]">Pudur<br /><span className="text-[#d7f568]">Premier</span><br />League<span className="text-[#d7f568]">.</span></h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-[#d7e3dc] sm:text-lg">New season. Fresh ambition. Same love for the game. Your next innings starts here.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={REGISTRATION_PATH} className="group inline-flex min-h-14 items-center justify-center gap-6 rounded-full bg-[#d7f568] px-7 py-4 text-sm font-extrabold text-[#103c32] transition hover:bg-[#e3ff8a] hover:shadow-lg">Register as a player <ArrowUpRight className="h-5 w-5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
              <Link href="#league" className="inline-flex min-h-12 items-center gap-2 px-2 text-sm font-semibold text-white/85 transition hover:text-[#d7f568]">Explore the league <ArrowDown className="h-4 w-4" /></Link>
            </div>
            <p className="mt-5 text-xs text-[#b6c9be]">Register now. Entry fee is collected after the auction.</p>
          </div>

          <div className="relative mx-auto w-full max-w-[470px] py-5 lg:py-0">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#d7f568]/20 bg-[#194b3c] p-5 shadow-2xl sm:p-7">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7f568]"><span>The stage is yours</span><span>PPL / Cricket</span></div>
              <svg viewBox="0 0 400 350" role="img" aria-label="Cricket bat and ball on a green cricket field" className="my-3 w-full">
                <defs>
                  <linearGradient id="field" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2b6b4d" /><stop offset="1" stopColor="#174b39" /></linearGradient>
                  <linearGradient id="bat" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#e1d49d" /><stop offset=".5" stopColor="#fff1bd" /><stop offset="1" stopColor="#c8b77d" /></linearGradient>
                  <linearGradient id="ball" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff956c" /><stop offset="1" stopColor="#cf492f" /></linearGradient>
                  <filter id="shadow"><feDropShadow dx="7" dy="12" stdDeviation="10" floodColor="#06271b" floodOpacity=".5" /></filter>
                </defs>
                <ellipse cx="200" cy="180" rx="183" ry="153" fill="url(#field)" stroke="#8da870" strokeWidth="1" />
                <ellipse cx="200" cy="180" rx="151" ry="123" fill="none" stroke="#d7f568" strokeOpacity=".3" strokeDasharray="4 6" />
                <path d="M65 96L335 96M34 143L366 143M20 190L380 190M39 237L361 237M78 284L322 284" stroke="#d7f568" strokeWidth="22" opacity=".025" />
                <rect x="163" y="96" width="74" height="167" rx="4" fill="#c4ba89" fillOpacity=".28" />
                <path d="M148 115H252M148 244H252M167 104V125M233 104V125M167 233V254M233 233V254" fill="none" stroke="#eff1d6" strokeOpacity=".65" strokeWidth="2" />
                <g transform="rotate(32 200 175)" filter="url(#shadow)">
                  <rect x="190" y="31" width="20" height="91" rx="7" fill="#103c32" stroke="#d7f568" strokeWidth="2" />
                  <path d="M191 44H209M191 54H209M191 64H209M191 74H209M191 84H209" stroke="#d7f568" strokeOpacity=".6" strokeWidth="3" />
                  <path d="M190 109Q173 119 173 135V279Q200 293 227 279V135Q227 119 210 109Z" fill="url(#bat)" />
                  <path d="M200 122V277" stroke="#b8a56e" strokeOpacity=".4" />
                  <path d="M175 157H225V195H175Z" fill="#103c32" />
                  <text x="200" y="182" textAnchor="middle" fill="#d7f568" fontSize="18" fontFamily="Arial,sans-serif" fontWeight="900">PPL</text>
                </g>
                <g transform="rotate(-25 295 250)" filter="url(#shadow)"><circle cx="295" cy="250" r="34" fill="url(#ball)" /><path d="M282 220Q301 250 282 280M290 217Q310 250 290 283" fill="none" stroke="#fff2d9" strokeWidth="2" strokeDasharray="3 3" /></g>
                <path d="M325 72V88M317 80H333M78 256V268M72 262H84" stroke="#d7f568" strokeWidth="2" />
              </svg>
              <div className="flex items-end justify-between gap-4 border-t border-white/15 pt-5"><p className="text-[11px] font-semibold uppercase leading-relaxed tracking-[0.14em] text-[#b6c9be]">Local talent.<br /><span className="text-[#f6f5ed]">Big league energy.</span></p><Trophy className="h-8 w-8 text-[#d7f568]" strokeWidth={1.3} /></div>
            </div>
            <div className="absolute -bottom-1 -right-1 flex -rotate-3 items-center gap-3 rounded-2xl bg-[#d7f568] px-5 py-4 text-[#103c32] shadow-lg sm:-right-3"><span className="font-display text-3xl leading-none">YOU</span><span className="text-[10px] font-extrabold uppercase leading-tight tracking-wider">Belong on<br />the pitch.</span></div>
          </div>
        </div>
      </section>

      <section id="league" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#607266]">Follow every innings</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">One league. Every moment.</h2></div><p className="max-w-xs text-sm leading-relaxed text-[#647469]">From the first registration to the final squad. It all happens here.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {explore.map(({ href, icon: Icon, number, title, description, label }) => (
            <Link key={href} href={href} className="group flex flex-col rounded-2xl border border-[#dbe1d4] bg-[#fdfdf7] p-6 transition hover:-translate-y-1 hover:border-[#103c32]/30 hover:shadow-xl hover:shadow-[#103c32]/5">
              <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e9eddf]"><Icon className="h-5 w-5" strokeWidth={1.7} /></span><span className="text-xs font-semibold text-[#84917e]">/{number}</span></div>
              <h3 className="mt-7 text-lg font-bold tracking-tight">{title}</h3><p className="mb-7 mt-2 text-sm leading-relaxed text-[#647469]">{description}</p><div className="mt-auto flex items-center justify-between text-xs font-bold">{label}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-3 border-t border-[#dbe1d4] px-5 py-7 text-xs text-[#647469] sm:flex-row sm:px-8"><p>© {new Date().getFullYear()} {TOURNAMENT_NAME}</p><p>Made for the love of cricket.</p><Link href={REGISTRATION_PATH} className="font-bold text-[#103c32] hover:underline">Your innings starts here ↗</Link></footer>
    </main>
  );
}
