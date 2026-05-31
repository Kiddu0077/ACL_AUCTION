import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { RegistrationForm } from "@/components/registration-form";

export default function RegisterPage() {
  const tournament =
    process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "ACL Cricket League";

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-16">
      <header className="bg-cricket-pitch px-4 py-5 text-white shadow">
        <div className="container max-w-lg">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1 text-xs text-blue-100 hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </Link>
          <h1 className="text-xl font-bold">{tournament}</h1>
          <p className="text-sm text-blue-100">Player registration</p>
        </div>
      </header>

      <div className="container max-w-lg space-y-6 pt-6">
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-cricket-pitch">
            Your details
          </h2>
          <RegistrationForm />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          By submitting, you agree your details will be used for tournament
          coordination only.
        </p>
      </div>
    </main>
  );
}
