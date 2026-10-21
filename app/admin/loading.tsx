import { TOURNAMENT_NAME } from "@/lib/tournament";

export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-muted/30" aria-busy="true">
      <header className="border-b bg-white">
        <div className="container py-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {TOURNAMENT_NAME}
          </p>
          <p role="status" className="text-sm text-muted-foreground">
            Opening your workspace…
          </p>
        </div>
      </header>
      <div className="container space-y-5 py-6" aria-hidden="true">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl border bg-white motion-reduce:animate-none" />
          ))}
        </div>
        <div className="space-y-4 rounded-xl border bg-white p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </main>
  );
}
