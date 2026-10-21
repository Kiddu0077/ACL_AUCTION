"use client";

import { useCallback } from "react";
import { useAsyncAction } from "@/lib/use-async-action";
import { isAuctionBusy, setAuctionManagementBusy } from "@/lib/auction/activity";

/** Keep resets/settings/status changes separate from queued player mutations. */
export function useAuctionManagementAction() {
  const [pending, runAction] = useAsyncAction();
  const runManagementAction = useCallback(
    (action: () => Promise<void>, onError?: () => void) => {
      if (isAuctionBusy()) return Promise.resolve();
      return runAction(async () => {
        setAuctionManagementBusy(true);
        try {
          await action();
        } finally {
          setAuctionManagementBusy(false);
        }
      }, onError);
    },
    [runAction],
  );
  return [pending, runManagementAction] as const;
}
