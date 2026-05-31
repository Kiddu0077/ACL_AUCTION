"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

import { getPaymentSignedUrl } from "@/app/admin/actions";
import { useToast } from "@/components/ui/use-toast";

export function PaymentLink({ path }: { path: string | null }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  if (!path) return <span className="text-xs text-muted-foreground">—</span>;

  async function open() {
    setLoading(true);
    const res = await getPaymentSignedUrl(path!);
    setLoading(false);
    if (res.error || !res.url) {
      toast({
        variant: "destructive",
        title: "Could not load screenshot",
        description: res.error ?? "Unknown error",
      });
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      <ExternalLink className="h-3 w-3" />
      {loading ? "Loading…" : "View"}
    </button>
  );
}
