"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function PublicDataError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div role="alert" className="max-w-md rounded-2xl border bg-card p-8 text-center text-card-foreground">
        <h1 className="text-xl font-bold">We couldn’t load the latest information.</h1>
        <p className="my-4 text-sm text-muted-foreground">Please check your connection and try again.</p>
        <Button disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          {pending ? "Retrying…" : "Try again"}
        </Button>
      </div>
    </main>
  );
}
