"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

import { getPaymentSignedUrl } from "@/app/admin/actions";
import { useToast } from "@/components/ui/use-toast";
import { useAsyncAction } from "@/lib/use-async-action";

export function PaymentLink({ path }: { path: string | null }) {
  const { toast } = useToast();
  const [loading, runAction] = useAsyncAction();

  if (!path) return <span className="text-xs text-muted-foreground">—</span>;

  function open() {
    void runAction(async () => {
      // Open during the click event; opening after a network await is blocked
      // as an unsolicited popup by many mobile browsers.
      const popup = window.open("about:blank", "_blank");
      if (!popup) {
        toast({ variant: "destructive", title: "Allow pop-ups to view the screenshot" });
        return;
      }
      popup.opener = null;
      try {
        const res = await getPaymentSignedUrl(path!);
        if (res.error || !res.url) throw new Error(res.error ?? "Screenshot unavailable");
        popup.location.replace(res.url);
      } catch (error) {
        popup.close();
        throw error;
      }
    });
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
