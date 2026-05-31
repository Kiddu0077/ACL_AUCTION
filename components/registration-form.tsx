"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { createClient } from "@/lib/supabase/browser";
import {
  registrationSchema,
  type RegistrationInput,
} from "@/lib/validations/player";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function RegistrationForm() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
  });

  const role = watch("role");
  const profilePicture = watch("profile_picture");

  async function onSubmit(values: RegistrationInput) {
    const supabase = createClient();

    try {
      // Pre-check: fail fast on duplicate phone before uploading the photo,
      // so we don't pile up orphaned storage objects on rejected submits.
      const { data: phoneTaken, error: phoneCheckErr } = await supabase.rpc(
        "phone_exists",
        { p_phone: values.phone },
      );
      if (phoneCheckErr) throw new Error(phoneCheckErr.message);
      if (phoneTaken) {
        toast({
          variant: "destructive",
          title: "This phone number is already registered",
          description:
            "Each player can register only once. If you didn't register, contact the organisers.",
        });
        return;
      }

      const playerId = crypto.randomUUID();
      const slug = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");

      const profileKey = `${playerId}/${slug(values.profile_picture.name)}`;

      const { error: profileErr } = await supabase.storage
        .from("profile-pictures")
        .upload(profileKey, values.profile_picture, {
          contentType: values.profile_picture.type,
          upsert: false,
        });
      if (profileErr) throw new Error(`Profile upload: ${profileErr.message}`);

      const { data: pubProfile } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(profileKey);

      const { error: insertErr } = await supabase.from("players").insert({
        id: playerId,
        full_name: values.full_name,
        role: values.role,
        phone: values.phone,
        city: values.city,
        profile_picture_url: pubProfile.publicUrl,
        // utr_number and payment_screenshot_url are left null on registration —
        // they get filled by admins after the auction when payment is collected.
        status: "Pending",
      });
      if (insertErr) {
        // Race condition guard: someone registered the same phone between
        // the pre-check and insert. The unique index catches it; surface a
        // friendly message instead of the raw Postgres violation text.
        const isDuplicate =
          insertErr.code === "23505" ||
          /phone/i.test(insertErr.message);
        if (isDuplicate) {
          toast({
            variant: "destructive",
            title: "This phone number is already registered",
            description: "Each player can register only once.",
          });
          return;
        }
        throw new Error(insertErr.message);
      }

      toast({
        variant: "success",
        title: "Registration submitted",
        description: "You're in! Payment will be collected after the auction.",
      });
      setSubmitted(true);
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed";
      toast({
        variant: "destructive",
        title: "Could not submit",
        description: message,
      });
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-accent" />
        <h2 className="text-lg font-semibold">You're registered</h2>
        <p className="text-sm text-muted-foreground">
          Your details have been received. The ₹149 entry fee will be collected
          after the auction is completed.
        </p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Register another player
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          autoComplete="name"
          placeholder="e.g. Virat Kohli"
          {...register("full_name")}
        />
        <FieldError message={errors.full_name?.message} />
      </div>

      <div>
        <Label htmlFor="role">Playing role</Label>
        <Select
          value={role}
          onValueChange={(v) =>
            setValue("role", v as RegistrationInput["role"], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="role">
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Batsman">Batsman</SelectItem>
            <SelectItem value="Bowler">Bowler</SelectItem>
            <SelectItem value="All-rounder">All-rounder</SelectItem>
          </SelectContent>
        </Select>
        <FieldError message={errors.role?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 9XXXXXXXXX"
            {...register("phone")}
          />
          <FieldError message={errors.phone?.message} />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            autoComplete="address-level2"
            placeholder="Bengaluru"
            {...register("city")}
          />
          <FieldError message={errors.city?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="profile_picture">Profile photo</Label>
        <Input
          id="profile_picture"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              setValue("profile_picture", file, { shouldValidate: true });
          }}
        />
        {profilePicture && (
          <p className="mt-1 text-xs text-muted-foreground">
            {profilePicture.name} ·{" "}
            {(profilePicture.size / 1024).toFixed(0)} KB
          </p>
        )}
        <FieldError message={errors.profile_picture?.message as string} />
      </div>

      <Button
        type="submit"
        size="lg"
        variant="secondary"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? "Submitting…" : "Submit Registration"}
      </Button>
    </form>
  );
}
