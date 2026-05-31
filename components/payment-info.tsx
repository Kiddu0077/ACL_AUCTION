import { Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function PaymentInfo() {
  const fee = process.env.NEXT_PUBLIC_REG_FEE ?? "149";

  return (
    <Card className="border-2 border-secondary/60 bg-gradient-to-br from-yellow-50 to-amber-100/40">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="rounded-full bg-secondary/30 p-2">
          <Info className="h-5 w-5 text-cricket-pitch" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-cricket-pitch">
            Entry Fee
          </p>
          <p className="text-3xl font-bold text-cricket-pitch">₹{fee}</p>
          <p className="text-sm text-foreground/80">
            Payment will be collected{" "}
            <span className="font-semibold">after the auction is completed</span>
            . No payment is required at registration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
