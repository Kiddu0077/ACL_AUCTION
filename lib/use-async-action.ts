"use client";

import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { createActionRunner } from "@/lib/async-action";

/** React 18 transitions do not track an async callback after its first await. */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const runner = useMemo(() => createActionRunner(setPending), []);
  const runAction = useCallback(
    (action: () => Promise<void>, onError?: () => void) =>
      runner(action, (error) => {
        onError?.();
        toast({
          variant: "destructive",
          title: "Action could not be completed",
          description: error instanceof Error ? error.message : "Check your connection and try again.",
        });
      }),
    [runner, toast],
  );
  return [pending, runAction] as const;
}
