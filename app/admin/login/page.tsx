import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOURNAMENT_NAME, TOURNAMENT_SHORT_NAME } from "@/lib/tournament";
import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cricket-pitch px-5 py-12">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full border border-secondary/20" />
      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-9 inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the league
        </Link>
        <div className="mb-7">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-sm font-black tracking-tight text-cricket-pitch">
            {TOURNAMENT_SHORT_NAME}
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white">
            {TOURNAMENT_NAME}
          </h1>
          <p className="mt-2 text-sm text-white/65">The league starts with you.</p>
        </div>
        <Card className="rounded-2xl border-white/15 bg-background shadow-2xl">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <ShieldCheck className="h-4 w-4" /> Organizer access
            </div>
            <CardTitle className="text-cricket-pitch">Welcome back</CardTitle>
            <CardDescription>
              Sign in to manage registrations, teams and the auction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
