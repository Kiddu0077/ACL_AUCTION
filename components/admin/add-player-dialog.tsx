"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Upload } from "lucide-react";

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
import { adminAddPlayer } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/browser";
import type { PlayerRole } from "@/lib/types/database";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 5 * 1024 * 1024;

export function AddPlayerDialog() {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<PlayerRole>("Batsman");
  const [city, setCity] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [photo, setPhoto] = React.useState<File | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setRole("Batsman");
      setCity("");
      setPhone("");
      setPhoto(null);
    }
  }, [open]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      toast({ variant: "destructive", title: "Use JPG/PNG/WEBP/HEIC" });
      return;
    }
    if (f.size > MAX_BYTES) {
      toast({ variant: "destructive", title: "Image must be ≤ 5MB" });
      return;
    }
    setPhoto(f);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !city.trim()) {
      toast({ variant: "destructive", title: "Name and city are required" });
      return;
    }
    startTransition(async () => {
      let profile_picture_url: string | null = null;
      if (photo) {
        const supabase = createClient();
        const slug = (s: string) =>
          s.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
        const key = `admin-add/${Date.now()}-${slug(photo.name)}`;
        const { error: upErr } = await supabase.storage
          .from("profile-pictures")
          .upload(key, photo, { contentType: photo.type, upsert: false });
        if (upErr) {
          toast({
            variant: "destructive",
            title: "Photo upload failed",
            description: upErr.message,
          });
          return;
        }
        profile_picture_url = supabase.storage
          .from("profile-pictures")
          .getPublicUrl(key).data.publicUrl;
      }

      const r = await adminAddPlayer({
        full_name: name,
        role,
        city,
        phone: phone || null,
        profile_picture_url,
      });
      if (r.error) {
        toast({
          variant: "destructive",
          title: "Could not add player",
          description: r.error,
        });
      } else {
        toast({ variant: "success", title: `${name.trim()} added` });
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <UserPlus className="h-4 w-4" /> Add Player
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Add player manually
            </DialogTitle>
            <DialogDescription>
              Public registration is closed. Use this to add a player directly
              to the pool with Verified status. Photo &amp; phone are optional.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="add-name">Full name</Label>
              <Input
                id="add-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Rahul Kumar"
              />
            </div>
            <div>
              <Label htmlFor="add-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as PlayerRole)}>
                <SelectTrigger id="add-role">
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
              <Label htmlFor="add-city">City</Label>
              <Input
                id="add-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                placeholder="City"
              />
            </div>
            <div>
              <Label htmlFor="add-phone">Phone (optional)</Label>
              <Input
                id="add-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="add-photo" className="cursor-pointer">
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {photo ? photo.name.slice(0, 20) : "Upload photo (optional)"}
                </span>
              </Label>
              <input
                id="add-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="hidden"
                onChange={onPickPhoto}
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
              Add player
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
