"use client";

import * as React from "react";
import { useAsyncAction } from "@/lib/use-async-action";
import { IndianRupee, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { togglePaid } from "@/app/admin/actions";

export function PaidToggle({
  id,
  paidAt,
  name,
}: {
  id: string;
  paidAt: string | null;
  name: string;
}) {
  const { toast } = useToast();
  const [pending, runAction] = useAsyncAction();
  const [localPaidAt, setLocalPaidAt] = React.useState<string | null>(paidAt);
  React.useEffect(() => setLocalPaidAt(paidAt), [paidAt]);

  const isPaid = Boolean(localPaidAt);

  function handleToggle() {
    const next = !isPaid;
    const prevValue = localPaidAt;
    void runAction(async () => {
      setLocalPaidAt(next ? new Date().toISOString() : null);
      const result = await togglePaid(id, next);
      if (result.error) {
        setLocalPaidAt(prevValue);
        toast({
          variant: "destructive",
          title: "Update failed",
          description: result.error,
        });
      } else {
        toast({
          variant: "success",
          title: next ? `${name} marked Paid` : `${name} marked Unpaid`,
        });
      }
    }, () => setLocalPaidAt(prevValue));
  }

  return (
    <Button
      variant={isPaid ? "secondary" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={pending}
      className={
        isPaid
          ? "bg-accent text-accent-foreground hover:bg-accent/80"
          : undefined
      }
      title={
        isPaid && localPaidAt
          ? `Paid ${new Date(localPaidAt).toLocaleDateString()}`
          : "Mark as paid"
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <IndianRupee className="h-4 w-4" />
      )}
      {isPaid ? "Paid" : "Unpaid"}
    </Button>
  );
}
