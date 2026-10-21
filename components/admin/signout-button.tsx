"use client";

import { useFormStatus } from "react-dom";
import { LogOut, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/app/admin/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <SubmitSignOut />
    </form>
  );
}

function SubmitSignOut() {
  const { pending } = useFormStatus();
  return (
    <Button variant="ghost" size="sm" type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
