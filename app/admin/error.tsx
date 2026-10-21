"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div role="alert" className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-cricket-pitch">Could not load this page</h1>
        <p className="text-sm text-muted-foreground">
          Check your connection and retry to load the latest league data.
        </p>
        <div className="flex items-center gap-4">
          <Button disabled={pending} onClick={() => startTransition(reset)}>
            {pending ? "Loading…" : "Try again"}
          </Button>
          <Link href="/admin/dashboard" className="text-sm text-primary underline">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
