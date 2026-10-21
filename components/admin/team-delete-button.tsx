"use client";

import * as React from "react";
import { useAsyncAction } from "@/lib/use-async-action";
import { Trash2, Loader2 } from "lucide-react";

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
import { useToast } from "@/components/ui/use-toast";
import { deleteTeam } from "@/app/admin/auction-actions";
import { broadcastReload } from "@/lib/realtime/broadcast-client";

export function TeamDeleteButton({
  id,
  name,
  playerCount,
}: {
  id: string;
  name: string;
  playerCount: number;
}) {
  const { toast } = useToast();
  const [pending, runAction] = useAsyncAction();
  const [open, setOpen] = React.useState(false);

  function handleDelete() {
    if (playerCount > 0) return;
    void runAction(async () => {
      const result = await deleteTeam(id);
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: result.error,
        });
      } else {
        broadcastReload();
        toast({ variant: "success", title: `Deleted ${name}` });
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!pending) setOpen(value); }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${name}`}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            {playerCount > 0
              ? `This team has ${playerCount} player${playerCount === 1 ? "" : "s"}. Transfer or remove them in Squad management before deleting this team.`
              : "This team has no players. Deletion is permanent."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending || playerCount > 0}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
