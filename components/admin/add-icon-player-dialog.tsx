"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star, Upload } from "lucide-react";

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
import { createIconPlayer } from "@/app/admin/auction-actions";
import { createClient } from "@/lib/supabase/browser";
import type { PlayerRole, Team } from "@/lib/types/database";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 5 * 1024 * 1024;

export function AddIconPlayerDialog({ team }: { team: Team }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<PlayerRole>("Batsman");
  const [city, setCity] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [price, setPrice] = React.useState("0");
  const [photo, setPhoto] = React.useState<File | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setRole("Batsman");
      setCity("");
      setPhone("");
      setPrice("0");
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
        const key = `icon/${Date.now()}-${slug(photo.name)}`;
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

      const r = await createIconPlayer({
        full_name: name,
        role,
        city,
        team_id: team.id,
        sold_price: Number(price) || 0,
        phone: phone || null,
        profile_picture_url,
      });
      if (r.error) {
        toast({
          variant: "destructive",
          title: "Could not add icon player",
          description: r.error,
        });
      } else {
        toast({ variant: "success", title: `${name.trim()} added to ${team.name}` });
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Star className="h-4 w-4" /> Add icon player
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-secondary" /> Add icon player to{" "}
              {team.name}
            </DialogTitle>
            <DialogDescription>
              Create a star player who didn&apos;t register. They go straight
              into this team&apos;s squad. Phone &amp; photo are optional.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="icon-name">Full name</Label>
              <Input
                id="icon-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Star Player"
              />
            </div>
            <div>
              <Label htmlFor="icon-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as PlayerRole)}>
                <SelectTrigger id="icon-role">
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
              <Label htmlFor="icon-city">City</Label>
              <Input
                id="icon-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                placeholder="City"
              />
            </div>
            <div>
              <Label htmlFor="icon-price">Price (₹)</Label>
              <Input
                id="icon-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="icon-phone">Phone (optional)</Label>
              <Input
                id="icon-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="icon-photo" className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {photo ? photo.name : "Upload photo (optional)"}
                </span>
              </Label>
              <input
                id="icon-photo"
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
              Add icon player
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
