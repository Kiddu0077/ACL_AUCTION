"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/app/admin/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button variant="ghost" size="sm" type="submit">
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </form>
  );
}
