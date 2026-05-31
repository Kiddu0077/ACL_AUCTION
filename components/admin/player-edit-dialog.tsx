"use client";

import * as React from "react";
import { useTransition } from "react";
import Image from "next/image";
import { Loader2, Pencil, Upload } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { updatePlayer } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/browser";
import type { Player, PlayerRole } from "@/lib/types/database";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function PlayerEditDialog({ player }: { player: Player }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  const [fullName, setFullName] = React.useState(player.full_name);
  const [role, setRole] = React.useState<PlayerRole>(player.role);
  const [phone, setPhone] = React.useState(player.phone ?? "");
  const [city, setCity] = React.useState(player.city);
  const [newPhoto, setNewPhoto] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  // Reset form to the player's values whenever the dialog re-opens.
  React.useEffect(() => {
    if (open) {
      setFullName(player.full_name);
      setRole(player.role);
      setPhone(player.phone ?? "");
      setCity(player.city);
      setNewPhoto(null);
      setPreview(null);
    }
  }, [open, player]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      toast({ variant: "destructive", title: "Use a JPG, PNG, WEBP or HEIC image" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ variant: "destructive", title: "Image must be 5MB or smaller" });
      return;
    }
    setNewPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !city.trim()) {
      toast({ variant: "destructive", title: "Name and city are required" });
      return;
    }

    startTransition(async () => {
      const fields: Parameters<typeof updatePlayer>[1] = {
        full_name: fullName.trim(),
        role,
        // Empty phone → null (icon players may have none). The CHECK
        // constraint rejects empty strings, so never send "".
        phone: phone.trim() || null,
        city: city.trim(),
      };

      // Upload a replacement photo first, if one was chosen.
      if (newPhoto) {
        const supabase = createClient();
        const slug = (s: string) =>
          s.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
        const key = `${player.id}/${Date.now()}-${slug(newPhoto.name)}`;
        const { error: upErr } = await supabase.storage
          .from("profile-pictures")
          .upload(key, newPhoto, {
            contentType: newPhoto.type,
            upsert: false,
          });
        if (upErr) {
          toast({
            variant: "destructive",
            title: "Photo upload failed",
            description: upErr.message,
          });
          return;
        }
        const { data } = supabase.storage
          .from("profile-pictures")
          .getPublicUrl(key);
        fields.profile_picture_url = data.publicUrl;
      }

      const result = await updatePlayer(player.id, fields);
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: result.error,
        });
      } else {
        toast({ variant: "success", title: `Updated ${fields.full_name}` });
        setOpen(false);
      }
    });
  }

  const currentPhoto = preview ?? player.profile_picture_url;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${player.full_name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSave} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit player</DialogTitle>
            <DialogDescription>
              Change any detail. Phone numbers must stay unique across players.
            </DialogDescription>
          </DialogHeader>

          {/* Photo */}
          <div className="flex items-center gap-4">
            {currentPhoto ? (
              <Image
                src={currentPhoto}
                alt={player.full_name}
                width={72}
                height={72}
                className="h-18 w-18 rounded-md bg-muted object-contain"
                style={{ height: 72, width: 72 }}
                unoptimized={Boolean(preview)}
              />
            ) : (
              <div className="h-[72px] w-[72px] rounded-md bg-muted" />
            )}
            <div>
              <Label htmlFor="edit-photo" className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {newPhoto ? "Change again" : "Replace photo"}
                </span>
              </Label>
              <input
                id="edit-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="hidden"
                onChange={onPickPhoto}
              />
              {newPhoto && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {newPhoto.name}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="edit-name">Full name</Label>
              <Input
                id="edit-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as PlayerRole)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Batsman">Batsman</SelectItem>
                  <SelectItem value="Bowler">Bowler</SelectItem>
                  <SelectItem value="All-rounder">All-rounder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="edit-city">City</Label>
              <Input
                id="edit-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
