"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { createTeam, updateTeam } from "@/app/admin/auction-actions";
import type { Team } from "@/lib/types/database";

export function TeamFormDialog({
  team,
  trigger,
  defaultBudget = 10000,
}: {
  team?: Team;
  trigger: React.ReactNode;
  defaultBudget?: number;
}) {
  const editing = Boolean(team);
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const input = {
      name: String(data.get("name") || "").trim(),
      short_name: (String(data.get("short_name") || "").trim() || null) as
        | string
        | null,
      owner_name: (String(data.get("owner_name") || "").trim() || null) as
        | string
        | null,
      color: (String(data.get("color") || "").trim() || null) as string | null,
      budget_total: Number(data.get("budget_total") || 0),
      squad_size: Number(data.get("squad_size") || 11),
    };
    if (!input.name) {
      toast({ variant: "destructive", title: "Name is required" });
      return;
    }
    if (!input.budget_total || input.budget_total <= 0) {
      toast({ variant: "destructive", title: "Budget must be > 0" });
      return;
    }
    startTransition(async () => {
      const result = team
        ? await updateTeam(team.id, input)
        : await createTeam(input);
      if (result.error) {
        toast({
          variant: "destructive",
          title: editing ? "Update failed" : "Create failed",
          description: result.error,
        });
      } else {
        toast({
          variant: "success",
          title: editing ? `Updated ${input.name}` : `Added ${input.name}`,
        });
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${team!.name}` : "Add team"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update team details and budget."
                : "Create a new team that can bid in the auction."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Team name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={team?.name ?? ""}
                placeholder="e.g. Independence Warriors"
              />
            </div>
            <div>
              <Label htmlFor="short_name">Short name (3-4 chars)</Label>
              <Input
                id="short_name"
                name="short_name"
                maxLength={6}
                defaultValue={team?.short_name ?? ""}
                placeholder="ATG"
              />
            </div>
            <div>
              <Label htmlFor="owner_name">Owner / captain</Label>
              <Input
                id="owner_name"
                name="owner_name"
                defaultValue={team?.owner_name ?? ""}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="color">Color (hex)</Label>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue={team?.color ?? "#1e3a8a"}
                className="h-11 cursor-pointer p-1"
              />
            </div>
            <div>
              <Label htmlFor="budget_total">Budget (₹)</Label>
              <Input
                id="budget_total"
                name="budget_total"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={team?.budget_total ?? defaultBudget}
              />
            </div>
            <div>
              <Label htmlFor="squad_size">Squad size (max players)</Label>
              <Input
                id="squad_size"
                name="squad_size"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={team?.squad_size ?? 11}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
