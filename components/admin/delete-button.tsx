"use client";

import * as React from "react";
import { useTransition } from "react";
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
import { deletePlayer } from "@/app/admin/actions";

export function DeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePlayer(id);
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: result.error,
        });
      } else {
        toast({ variant: "success", title: `Deleted ${name}` });
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            This permanently removes the registration and the player's profile
            photo and any payment screenshot from storage. This cannot be
            undone.
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
            disabled={pending}
          >
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
