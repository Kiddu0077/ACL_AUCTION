"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { updatePlayerStatus } from "@/app/admin/actions";
import type { PlayerStatus } from "@/lib/types/database";

const STATUS_COLORS: Record<PlayerStatus, string> = {
  Pending: "text-yellow-700 bg-yellow-100 border-yellow-300",
  Verified: "text-emerald-700 bg-emerald-100 border-emerald-300",
  Rejected: "text-red-700 bg-red-100 border-red-300",
};

export function StatusToggle({
  id,
  status,
  name,
}: {
  id: string;
  status: PlayerStatus;
  name?: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = React.useState<PlayerStatus>(status);

  function onChange(next: string) {
    const target = next as PlayerStatus;
    const prev = local;
    setLocal(target);
    startTransition(async () => {
      const result = await updatePlayerStatus(id, target);
      if (result.error) {
        setLocal(prev);
        toast({
          variant: "destructive",
          title: "Update failed",
          description: result.error,
        });
      } else {
        toast({
          variant: "success",
          title: name ? `${name} → ${target}` : `Marked ${target}`,
        });
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={local} onValueChange={onChange} disabled={pending}>
        <SelectTrigger
          className={`h-8 w-28 border text-xs font-medium ${STATUS_COLORS[local]}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Pending">Pending</SelectItem>
          <SelectItem value="Verified">Verified</SelectItem>
          <SelectItem value="Rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
      {pending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}
