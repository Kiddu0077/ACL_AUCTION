"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function TeamShareLink({ id, name }: { id: string; name: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    const url = `${window.location.origin}/team/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        variant: "success",
        title: `Link copied`,
        description: `Manager URL for ${name}`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: open the URL so the user can copy from address bar
      window.open(url, "_blank");
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={copy}
      title="Copy this team's manager URL"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Link2 className="h-4 w-4" />
      )}
      {copied ? "Copied" : "Link"}
    </Button>
  );
}
